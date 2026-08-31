"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  countGatheringInvitees,
  finaliseGatheringCreation,
  recordInvitationDecision,
  saveGatheringDraft,
  saveInvitationArtwork,
} from "@/lib/host-actions";
import {
  DEFAULT_ARRIVAL_TIME,
  EMPTY_GATHERING_INPUT,
  FOOD_STYLES,
  FOOD_STYLE_LABELS,
  GATHERING_TYPES,
  hasEnoughToSaveDraft,
  isArrivalInPast,
  todayISODate,
  validateGatheringInput,
  VALIDATION_MESSAGES,
  type CreateGatheringInput,
  type FoodStyle,
  type GatheringType,
} from "@/lib/gathering-creation";
import { gatheringTypeLabel } from "@/lib/host-format";
import {
  ALLOWED_ARTWORK_MIME_TYPES,
  ARTWORK_LIMITS_HINT,
  artworkObjectPath,
  artworkRejectionReason,
  INVITATION_ARTWORK_BUCKET,
  INVITATION_MODES,
  INVITATION_STYLES,
  isRenderableArtwork,
  type InvitationDecision,
  type InvitationMode,
} from "@/lib/invitations";

// CREATING A GATHERING ON THE WEB.
//
// THE SAME EIGHT QUESTIONS THE PHONE ASKS, IN THE SAME ORDER, WRITING
// THE SAME ROW. This is a reconciliation, not a new flow: the questions,
// their order, the rule for when each one may be left, the moment the
// draft is first written, the invitation decision and its three modes,
// and the single guarded draft → active transition at the end are all
// the native wizard's, and are the parts that must not drift.
//
//   1  What's happening?              name + kind
//   2  When are people coming?        date + arrival time
//   3  How many people?               adults + children
//   4  Where?                         place
//   5  Have you invited your people?  the invitation decision
//   6  What's your budget?            skippable, and skipping is an answer
//   7  How are you feeding everyone?  the canonical food styles
//   8  Anything we should know?       notes
//
// WHAT IS WEB-APPROPRIATE, AND ONLY THIS. The phone shows one question
// per screen because it has one screen. A desktop has room to show the
// host where they are in the conversation and let them go back to an
// answer without stepping through the ones in between, so the eight
// questions sit in a rail beside the one being answered. The date and
// time use the browser's own pickers instead of the app's scroll
// wheels, and the headcounts are a field with quick chips rather than an
// overflow sheet. Same conversation, furniture that suits the room.
//
// THE DRAFT IS ONE ROW AND IT STAYS A DRAFT. Nothing is written until
// the wizard holds every field the row requires (name, kind, date,
// arrival time, at least one guest). From then on every step transition
// UPDATEs that same id — never inserts a second — and the row remains
// `status = 'draft'` for the whole of the wizard. It becomes active in
// exactly one place: finaliseGatheringCreation(), once, when the host
// finishes. A half-answered gathering is a draft, and the host's Free
// gathering slot is not spent by one.
//
// AUTOSAVE FAILURES ARE MOSTLY SILENT, ON PURPOSE, with one exception.
// A background update that fails leaves the wizard entirely usable and
// the final save is the real safety net. But the FIRST save is the
// insert, and that is the one Postgres can refuse outright — the Free
// tier's one-open-gathering rule lives there — so a failure with no
// draft yet is shown immediately rather than discovered at the end,
// after five more questions.

const TOTAL_STEPS = 8;

const STEP_TITLES = [
  "What's happening?",
  "When are people coming?",
  "How many people?",
  "Where?",
  "Have you invited your people yet?",
  "What's your budget?",
  "How are you feeding everyone?",
  "Anything we should know?",
];

/** The rail's short names. The questions above are the headings. */
const STEP_LABELS = [
  "The gathering",
  "Date & time",
  "Guests",
  "Place",
  "Invitations",
  "Budget",
  "Food",
  "Notes",
];

/** Headcounts almost every home gathering lands inside. */
const QUICK_COUNTS = [0, 2, 4, 6, 8, 10, 12, 16, 20];

/**
 * A unique segment for one artwork upload. `crypto.randomUUID` needs a
 * secure context, which a host on http://localhost or https:// always
 * has — the fallback exists so a stray context cannot turn "choose a
 * file" into a thrown error, which is the shape of the bug the app hit
 * on Hermes.
 */
function newFileId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CreateGatheringWizard() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  // The furthest question the host has legitimately reached. The rail
  // can only go back to somewhere they have already been — otherwise it
  // would be a way around the gates on steps 1, 3 and 5, which the
  // phone's one-question-at-a-time flow has no way to offer.
  const [furthest, setFurthest] = useState(1);
  const [input, setInput] = useState<CreateGatheringInput>(() => ({
    ...EMPTY_GATHERING_INPUT,
    gatheringDate: todayISODate(),
    arrivalTime: DEFAULT_ARRIVAL_TIME,
  }));

  const [draftId, setDraftId] = useState<string | null>(null);
  const [decision, setDecision] = useState<InvitationDecision | null>(null);
  const [mode, setMode] = useState<InvitationMode | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [inviteeCount, setInviteeCount] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, start] = useTransition();

  // The host's own artwork. `artwork` is what is actually recorded on
  // the gathering; `artworkUrl` is a short-lived signed URL for showing
  // it back, and is null for a PDF, which cannot go in an <img>.
  const fileInput = useRef<HTMLInputElement>(null);
  const [artwork, setArtwork] = useState<{
    filename: string;
    mimeType: string;
  } | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [artworkError, setArtworkError] = useState<string | null>(null);

  function update<K extends keyof CreateGatheringInput>(
    key: K,
    value: CreateGatheringInput[K]
  ) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  /* -------------------------------------------------------------- */
  /* When a step may be left                                        */
  /* -------------------------------------------------------------- */

  // The native rules exactly. Steps 2, 4, 6, 7 and 8 are free to leave:
  // a date and time are already filled in, and a place, a budget, a food
  // style and a note are all things a host is allowed not to know yet.
  function canLeave(current: number): boolean {
    switch (current) {
      case 1:
        return input.name.trim().length > 0 && input.gatheringType !== null;
      case 3:
        return input.adultCount + input.childCount > 0;
      case 5:
        if (decision === null) return false;
        if (decision === "not_yet") return mode !== null;
        return true;
      default:
        return true;
    }
  }

  /* -------------------------------------------------------------- */
  /* The one draft row                                              */
  /* -------------------------------------------------------------- */

  async function persistDraft(current: CreateGatheringInput): Promise<string | null> {
    if (!hasEnoughToSaveDraft(current)) return draftId;

    const firstSave = draftId === null;
    const result = await saveGatheringDraft(
      current,
      draftId,
      // The browser's timezone, so the gathering's wall-clock times mean
      // what the host meant — the same value the app reads off the
      // device. Only used on the insert.
      firstSave ? Intl.DateTimeFormat().resolvedOptions().timeZone : null
    );

    if (result.ok) {
      if (firstSave) setDraftId(result.value);
      return result.value;
    }
    // See the header: the insert is the one the database can refuse.
    if (firstSave) setError(result.message);
    return draftId;
  }

  async function persistInvitation(gatheringId: string | null) {
    if (!gatheringId || decision === null) return;
    if (decision === "not_yet" && !mode) return;
    await recordInvitationDecision(gatheringId, decision, mode, styleId);
  }

  function go(next: number) {
    setError(null);
    start(async () => {
      const id = await persistDraft(input);
      await persistInvitation(id);
      setStep(next);
      setFurthest((f) => Math.max(f, next));
    });
  }

  function goNext() {
    if (!canLeave(step)) return;
    go(Math.min(step + 1, TOTAL_STEPS));
  }

  function goBack() {
    go(Math.max(step - 1, 1));
  }

  /** The rail. Only somewhere the host has already been. */
  function jumpTo(target: number) {
    if (target === step || target > furthest) return;
    go(target);
  }

  async function pickStyle(id: string) {
    setStyleId(id);
    if (!draftId) return;
    // Non-blocking. The step transition persists the choice again, so a
    // failure here costs nothing.
    await recordInvitationDecision(
      draftId,
      "not_yet",
      INVITATION_MODES.PLACE_AND_PLENTY,
      id
    );
  }

  /* -------------------------------------------------------------- */
  /* The host's own artwork                                         */
  /* -------------------------------------------------------------- */

  // THE SAME TWO STEPS THE APP TAKES, AGAINST THE SAME BUCKET. The file
  // goes straight from here into `invitation-artwork` under
  // `<gathering_id>/…` as the signed-in user — the bucket's RLS is what
  // permits or refuses it, on the server, exactly as on the phone — and
  // then save_invitation_artwork() records the path and sets
  // invitation_mode='uploaded' atomically. Artwork added here shows up
  // in the app, and artwork added in the app shows up here, because
  // there is only one place either of them looks.
  //
  // Replacing means uploading to a fresh key: the bucket has INSERT and
  // DELETE policies and no UPDATE, so an object cannot be overwritten in
  // place. Removing the superseded object is `remove_invitation_artwork`
  // on the gathering's own Invitations surface — the app's wizard does
  // not do it either, and doing it here would delete the artwork the
  // gathering is still pointing at if the new save failed.
  async function handleArtworkChosen(file: File | null | undefined) {
    if (!file) return;
    setArtworkError(null);

    const gatheringId = draftId;
    if (!gatheringId) {
      setArtworkError(
        "Answer the first few questions and this will be ready — the file is filed under the gathering."
      );
      return;
    }
    // Checked here so a host is told before a ten-megabyte upload rather
    // than after it. The bucket enforces the same limits regardless.
    const rejection = artworkRejectionReason(file);
    if (rejection) {
      setArtworkError(rejection);
      return;
    }

    setUploading(true);
    try {
      const supabase = getBrowserClient();
      const path = artworkObjectPath(gatheringId, file.name, newFileId());

      const { error: uploadError } = await supabase.storage
        .from(INVITATION_ARTWORK_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setArtworkError(
          "That file didn't upload. Check your connection and try again."
        );
        return;
      }

      const recorded = await saveInvitationArtwork(
        gatheringId,
        path,
        file.type,
        file.name
      );
      if (!recorded.ok) {
        setArtworkError(recorded.message);
        return;
      }

      setArtwork({ filename: file.name, mimeType: file.type });

      // A private bucket, so a path is not a URL. An hour is longer than
      // anyone spends on this step and short enough that a URL copied
      // out of devtools stops working the same afternoon.
      if (isRenderableArtwork(file.type)) {
        const { data } = await supabase.storage
          .from(INVITATION_ARTWORK_BUCKET)
          .createSignedUrl(path, 3600);
        setArtworkUrl(data?.signedUrl ?? null);
      } else {
        setArtworkUrl(null);
      }
    } finally {
      setUploading(false);
      // So choosing the same file twice still fires a change event.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /* -------------------------------------------------------------- */
  /* Who is already on the list                                     */
  /* -------------------------------------------------------------- */

  // Once the host has settled on a method, offer the canonical My People
  // flow if the gathering has nobody on it yet — and stay out of the way
  // if it already does. The wizard never builds a guest list itself.
  useEffect(() => {
    const settled =
      decision === "already_invited" || (decision === "not_yet" && mode !== null);
    if (!settled || !draftId) {
      setInviteeCount(null);
      return;
    }
    let cancelled = false;
    countGatheringInvitees(draftId).then((n) => {
      if (!cancelled) setInviteeCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [decision, mode, draftId]);

  /* -------------------------------------------------------------- */
  /* Finishing                                                      */
  /* -------------------------------------------------------------- */

  function handleSubmit() {
    const errors = validateGatheringInput(input);
    if (errors.length > 0) {
      setError(VALIDATION_MESSAGES[errors[0].code]);
      return;
    }

    setError(null);
    start(async () => {
      const saved = await saveGatheringDraft(
        input,
        draftId,
        draftId ? null : Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      if (!saved.ok) {
        setError(saved.message);
        return;
      }
      if (!draftId) setDraftId(saved.value);

      await persistInvitation(saved.value);

      // The one draft → active transition, guarded in the database by
      // `WHERE status = 'draft'`.
      const finalised = await finaliseGatheringCreation(saved.value);
      if (!finalised.ok) {
        setError(finalised.message);
        return;
      }

      router.replace(`/host/g/${saved.value}`);
    });
  }

  const pastWarning =
    input.gatheringDate &&
    input.arrivalTime &&
    isArrivalInPast(input.gatheringDate, input.arrivalTime);

  /* -------------------------------------------------------------- */

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[16rem,1fr]">
      {/* ---- where you are in the conversation --------------------- */}
      <nav aria-label="Creation steps" className="lg:sticky lg:top-8 lg:self-start">
        <ol className="space-y-1">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const here = n === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => jumpTo(n)}
                  disabled={submitting || n > furthest}
                  aria-current={here ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-body text-sm transition-colors duration-400 disabled:cursor-not-allowed disabled:opacity-45 ${
                    here
                      ? "bg-forest text-offwhite"
                      : "text-forest/75 hover:bg-forest/5"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      here
                        ? "bg-gold text-forest"
                        : done
                          ? "bg-forest/85 text-offwhite"
                          : "border border-sage/50 text-forest/60"
                    }`}
                  >
                    {done ? <Icon name="check" size={13} /> : n}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 px-3 font-body text-xs leading-relaxed text-forest/60">
          Nothing is shared with anyone until you finish. Until then this is
          a draft, and it doesn&apos;t use up an active gathering.
        </p>
      </nav>

      {/* ---- the question being answered --------------------------- */}
      <div className="max-w-2xl">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] text-forest/55">
          Step {step} of {TOTAL_STEPS}
        </p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-forest">
          {STEP_TITLES[step - 1]}
        </h2>
        <span aria-hidden className="mt-4 block h-[2px] w-14 bg-gold" />

        <fieldset disabled={submitting} className="contents">
          {step === 1 && (
            <div className="mt-7">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  What you&apos;re calling it
                </span>
                <input
                  autoFocus
                  value={input.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Barbara's 80th Birthday"
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
                />
              </label>

              <p className="mt-6 mb-2 font-body text-sm font-semibold text-forest">
                What kind of gathering is it?
              </p>
              <ChipGrid>
                {GATHERING_TYPES.map((type) => (
                  <Chip
                    key={type}
                    selected={input.gatheringType === type}
                    onClick={() => update("gatheringType", type as GatheringType)}
                  >
                    {gatheringTypeLabel(type)}
                  </Chip>
                ))}
              </ChipGrid>
            </div>
          )}

          {step === 2 && (
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  Date
                </span>
                <input
                  type="date"
                  value={input.gatheringDate ?? ""}
                  onChange={(e) => update("gatheringDate", e.target.value || null)}
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  When people arrive
                </span>
                <input
                  type="time"
                  value={input.arrivalTime ?? ""}
                  onChange={(e) => update("arrivalTime", e.target.value || null)}
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
                />
              </label>

              {pastWarning && (
                <p className="font-body text-sm text-forest/70 sm:col-span-2">
                  That time has already passed — that&apos;s okay if
                  you&apos;re catching up, just double check the date.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="mt-7 space-y-7">
              <CountField
                label="Adults"
                value={input.adultCount}
                onChange={(n) => update("adultCount", n)}
              />
              <CountField
                label="Children"
                value={input.childCount}
                onChange={(n) => update("childCount", n)}
              />
              <p className="font-body text-sm text-forest/65">
                Expected guests is worked out from these two —{" "}
                {input.adultCount + input.childCount} so far.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="mt-7">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  Where is it?
                </span>
                <input
                  value={input.locationName}
                  onChange={(e) => update("locationName", e.target.value)}
                  placeholder="Home"
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
                />
              </label>
              <p className="mt-2 font-body text-sm text-forest/65">
                A name is enough. Guests see this on the invitation.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="mt-7">
              <ChipGrid>
                <Chip
                  selected={decision === "already_invited"}
                  onClick={() => {
                    setDecision("already_invited");
                    setMode(null);
                    setStyleId(null);
                  }}
                >
                  Yes, already invited
                </Chip>
                <Chip
                  selected={decision === "not_yet"}
                  onClick={() => setDecision("not_yet")}
                >
                  Not yet
                </Chip>
                <Chip
                  selected={decision === "later"}
                  onClick={() => {
                    setDecision("later");
                    setMode(null);
                    setStyleId(null);
                  }}
                >
                  I&apos;ll do this later
                </Chip>
              </ChipGrid>

              {decision === "already_invited" && (
                <p className="mt-4 font-body text-sm text-forest/70">
                  Noted — Place &amp; Plenty won&apos;t send anything or claim
                  invitations it didn&apos;t send. Everything else works the
                  same.
                </p>
              )}

              {decision === "later" && (
                <p className="mt-4 font-body text-sm text-forest/70">
                  Nothing is recorded either way. You can decide this any time
                  from the gathering.
                </p>
              )}

              {decision === "not_yet" && (
                <div className="mt-7">
                  <p className="mb-3 font-body text-sm font-semibold text-forest">
                    How would you like to invite them?
                  </p>

                  <div className="space-y-3">
                    <ModeOption
                      selected={mode === INVITATION_MODES.UPLOADED}
                      onClick={() => setMode(INVITATION_MODES.UPLOADED)}
                      title="Upload my own"
                      body="Already have something from Canva, Etsy, or a designer? That artwork becomes the face of this gathering."
                    />
                    {mode === INVITATION_MODES.UPLOADED && (
                      <div className="rounded-card border border-sage/35 bg-parchment px-4 py-4">
                        {artwork && (
                          <div className="mb-3 flex items-center gap-4">
                            {artworkUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={artworkUrl}
                                alt={`Your invitation artwork for ${
                                  input.name.trim() || "this gathering"
                                }`}
                                className="h-28 w-auto max-w-[10rem] rounded-md border border-sage/30 object-contain"
                              />
                            ) : (
                              <span className="flex h-28 w-24 flex-col items-center justify-center gap-1.5 rounded-md border border-sage/30 bg-offwhite text-forest/70">
                                <Icon name="card" size={22} />
                                <span className="font-body text-[0.6rem] font-bold uppercase tracking-[0.14em]">
                                  PDF
                                </span>
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-body text-sm font-semibold text-forest">
                                {artwork.filename}
                              </p>
                              <p className="mt-0.5 font-body text-xs text-forest/65">
                                Saved to this gathering. It&apos;s the face of
                                the gathering everywhere in Place &amp; Plenty,
                                on the phone too.
                              </p>
                            </div>
                          </div>
                        )}

                        <input
                          ref={fileInput}
                          type="file"
                          className="sr-only"
                          accept={ALLOWED_ARTWORK_MIME_TYPES.join(",")}
                          onChange={(e) =>
                            handleArtworkChosen(e.target.files?.[0])
                          }
                        />
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          disabled={uploading || !draftId}
                          className="rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5 disabled:opacity-50"
                        >
                          {uploading
                            ? "Uploading…"
                            : artwork
                              ? "Replace artwork"
                              : "Choose a file"}
                        </button>

                        {/* Directly beneath the control, and present
                            before anything is chosen — the rules are
                            worth more as an instruction than as an
                            error. Same sentence the app shows. */}
                        <p className="mt-2.5 font-body text-xs text-forest/70">
                          {ARTWORK_LIMITS_HINT}
                        </p>
                        <p className="mt-1.5 font-body text-xs leading-relaxed text-forest/60">
                          You can also add or change this later on the
                          gathering&apos;s Invitations screen.
                        </p>

                        {artworkError && (
                          <p
                            role="alert"
                            className="mt-2.5 font-body text-sm text-error"
                          >
                            {artworkError}
                          </p>
                        )}
                      </div>
                    )}

                    <ModeOption
                      selected={mode === INVITATION_MODES.PLACE_AND_PLENTY}
                      onClick={() => setMode(INVITATION_MODES.PLACE_AND_PLENTY)}
                      title="Use a Simple P&P invitation"
                      body="We already have your gathering details. Pick a look."
                    />
                    {mode === INVITATION_MODES.PLACE_AND_PLENTY && (
                      <div>
                        <p className="mb-3 mt-4 font-body text-sm font-semibold text-forest">
                          Pick a look:
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {INVITATION_STYLES.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => pickStyle(s.id)}
                              className={`rounded-card p-1 text-left transition-colors duration-400 ${
                                styleId === s.id
                                  ? "ring-2 ring-forest"
                                  : "ring-1 ring-sage/35 hover:ring-sage"
                              }`}
                            >
                              <span
                                className="flex h-24 flex-col justify-center gap-1.5 rounded-md px-3 text-center"
                                style={{
                                  background: s.background,
                                  color: s.textColor,
                                  border: s.bordered
                                    ? `1px solid ${s.accentColor}`
                                    : undefined,
                                }}
                              >
                                <span className="font-display text-sm leading-tight">
                                  {input.name.trim() || "Your gathering"}
                                </span>
                                <span
                                  aria-hidden
                                  className="mx-auto block h-[1px] w-8"
                                  style={{ background: s.accentColor }}
                                />
                                <span className="font-body text-[0.62rem] tracking-wide">
                                  {input.gatheringDate ?? ""}
                                </span>
                              </span>
                              <span className="mt-1.5 block px-1 font-body text-xs text-forest/75">
                                {s.label}
                                {styleId === s.id ? " ✓" : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <ModeOption
                      selected={mode === INVITATION_MODES.DETAILS_ONLY}
                      onClick={() => setMode(INVITATION_MODES.DETAILS_ONLY)}
                      title="Just send the details"
                      body="No formal invitation needed."
                    />
                  </div>
                </div>
              )}

              {/* The canonical My People flow, never a second guest list. */}
              {inviteeCount === 0 && draftId && (
                <div className="mt-7 rounded-card border border-sage/35 bg-parchment px-5 py-4">
                  <p className="font-body text-sm font-semibold text-forest">
                    Who are we inviting?
                  </p>
                  <p className="mt-1 font-body text-sm text-forest/70">
                    Nobody is on this list yet. You can add people now or
                    after you finish.
                  </p>
                  <Link
                    href={`/host/g/${draftId}/people`}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-forest px-4 py-2 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
                  >
                    <Icon name="people" size={15} />
                    Add / select people
                  </Link>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="mt-7">
              <label className="block max-w-xs">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  Budget
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={input.budgetTarget ?? ""}
                  onChange={(e) =>
                    update(
                      "budgetTarget",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  placeholder="500"
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
                />
              </label>
              <button
                type="button"
                onClick={() => update("budgetTarget", null)}
                className="mt-3 font-body text-sm text-forest/70 underline underline-offset-4 hover:text-forest"
              >
                Skip for now
              </button>
              <p className="mt-4 font-body text-sm text-forest/65">
                Skipping is a real answer — it stays empty rather than being
                guessed at, and you can set it later.
              </p>
            </div>
          )}

          {step === 7 && (
            <div className="mt-7">
              <ChipGrid>
                {FOOD_STYLES.map((style) => (
                  <Chip
                    key={style}
                    selected={input.foodStyle === style}
                    onClick={() => update("foodStyle", style as FoodStyle)}
                  >
                    {FOOD_STYLE_LABELS[style]}
                  </Chip>
                ))}
              </ChipGrid>
            </div>
          )}

          {step === 8 && (
            <div className="mt-7">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  Anything we should know?
                </span>
                <textarea
                  rows={5}
                  value={input.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Optional notes"
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
                />
              </label>
              <p className="mt-4 font-body text-sm text-forest/65">
                Dietary needs, accessibility and what the space is like are
                asked on the gathering itself, where the plan is made.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-6 font-body text-sm text-error">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-sage/30 pt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-full px-4 py-2.5 font-body text-sm font-semibold text-forest/75 transition-colors duration-400 hover:text-forest disabled:opacity-60"
              >
                Back
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canLeave(step)}
                className="rounded-full bg-forest px-7 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-full bg-forest px-7 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create gathering"}
              </button>
            )}

            {draftId && (
              <span className="font-body text-xs text-forest/55">
                Saved as a draft
              </span>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2 font-body text-sm transition-colors duration-400 ${
        selected
          ? "border-forest bg-forest text-offwhite"
          : "border-sage/45 text-forest hover:bg-forest/5"
      }`}
    >
      {children}
    </button>
  );
}

function ModeOption({
  selected,
  onClick,
  title,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`block w-full rounded-card border px-5 py-4 text-left transition-colors duration-400 ${
        selected
          ? "border-forest bg-forest text-offwhite"
          : "border-sage/40 bg-offwhite text-forest hover:border-sage"
      }`}
    >
      <span className="block font-body text-sm font-semibold">{title}</span>
      <span
        className={`mt-1 block font-body text-sm ${
          selected ? "text-offwhite/85" : "text-forest/70"
        }`}
      >
        {body}
      </span>
    </button>
  );
}

/** A number field with the counts a host most often needs, one tap away. */
function CountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="block max-w-[10rem]">
        <span className="mb-1 block font-body text-sm font-semibold text-forest">
          {label}
        </span>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
          }}
          className="w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest"
        />
      </label>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {QUICK_COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label}: ${n}`}
            className={`h-8 min-w-[2rem] rounded-full border px-2 font-body text-sm transition-colors duration-400 ${
              value === n
                ? "border-forest bg-forest text-offwhite"
                : "border-sage/40 text-forest/75 hover:bg-forest/5"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
