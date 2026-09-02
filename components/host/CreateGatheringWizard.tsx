"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { getBrowserClient } from "@/lib/supabase-browser";
import GatheringLimitNotice from "@/components/host/GatheringLimitNotice";
import {
  countGatheringInvitees,
  finaliseGatheringCreation,
  recordInvitationDecision,
  saveGatheringDraft,
  saveInvitationArtwork,
} from "@/lib/host-actions";
import type { GatheringLimitCode } from "@/lib/gathering-limits";
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
  ARTWORK_ACCEPT_ATTRIBUTE,
  ARTWORK_LIMITS_HINT,
  artworkObjectPath,
  artworkRejectionReason,
  INVITATION_ARTWORK_BUCKET,
  INVITATION_MODES,
  INVITATION_STYLES,
  isRenderableArtwork,
  resolveArtworkMimeType,
  type InvitationDecision,
  type InvitationMode,
} from "@/lib/invitations";

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

function newFileId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampWizardStep(value: number): number {
  return Math.min(TOTAL_STEPS, Math.max(1, Math.round(value)));
}

function formatDateDisplay(value: string | null): string {
  if (!value) return "Choose a date";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTimeDisplay(value: string | null): string {
  if (!value) return "Choose a time";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export interface ResumedDraft {
  id: string;
  step: number;
  furthestStep: number;
  input: CreateGatheringInput;
  decision: InvitationDecision | null;
  mode: InvitationMode | null;
  styleId: string | null;
  artwork: { filename: string; mimeType: string } | null;
  artworkUrl: string | null;
}

export default function CreateGatheringWizard({
  resume = null,
}: {
  resume?: ResumedDraft | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(() => clampWizardStep(resume?.step ?? 1));
  const [furthest, setFurthest] = useState(() =>
    Math.max(
      clampWizardStep(resume?.step ?? 1),
      clampWizardStep(resume?.furthestStep ?? resume?.step ?? 1)
    )
  );
  const [input, setInput] = useState<CreateGatheringInput>(
    () =>
      resume?.input ?? {
        ...EMPTY_GATHERING_INPUT,
        gatheringDate: todayISODate(),
        arrivalTime: DEFAULT_ARRIVAL_TIME,
      }
  );

  const [draftId, setDraftId] = useState<string | null>(resume?.id ?? null);
  const [decision, setDecision] = useState<InvitationDecision | null>(resume?.decision ?? null);
  const [mode, setMode] = useState<InvitationMode | null>(resume?.mode ?? null);
  const [styleId, setStyleId] = useState<string | null>(resume?.styleId ?? null);
  const [inviteeCount, setInviteeCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<GatheringLimitCode | null>(null);
  const [submitting, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const [artwork, setArtwork] = useState<{ filename: string; mimeType: string } | null>(resume?.artwork ?? null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(resume?.artworkUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [artworkError, setArtworkError] = useState<string | null>(null);

  function showRefusal(result: { message: string; limit?: GatheringLimitCode }) {
    setLimit(result.limit ?? null);
    setError(result.limit ? null : result.message);
  }

  function clearRefusal() {
    setError(null);
    setLimit(null);
  }

  function update<K extends keyof CreateGatheringInput>(key: K, value: CreateGatheringInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

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

  async function persistDraft(current: CreateGatheringInput): Promise<string | null> {
    if (!hasEnoughToSaveDraft(current)) return draftId;
    const firstSave = draftId === null;
    const result = await saveGatheringDraft(
      current,
      draftId,
      firstSave ? Intl.DateTimeFormat().resolvedOptions().timeZone : null
    );
    if (result.ok) {
      if (firstSave) setDraftId(result.value);
      return result.value;
    }
    if (firstSave) showRefusal(result);
    return draftId;
  }

  async function persistProgress(gatheringId: string, next: number, nextFurthest: number) {
    const supabase = getBrowserClient();
    await supabase
      .from("gatherings")
      .update({
        creation_step: clampWizardStep(next),
        creation_furthest_step: clampWizardStep(nextFurthest),
      })
      .eq("id", gatheringId)
      .eq("status", "draft");
  }

  async function persistInvitation(gatheringId: string | null) {
    if (!gatheringId || decision === null) return;
    if (decision === "not_yet" && !mode) return;
    await recordInvitationDecision(gatheringId, decision, mode, styleId);
  }

  function go(next: number, commitInvitation: boolean) {
    clearRefusal();
    start(async () => {
      const id = await persistDraft(input);
      const nextStep = clampWizardStep(next);
      const nextFurthest = Math.max(furthest, nextStep);
      if (id) {
        await persistProgress(id, nextStep, nextFurthest);
        if (commitInvitation) await persistInvitation(id);
      }
      setStep(nextStep);
      setFurthest(nextFurthest);
    });
  }

  function goNext() {
    if (!canLeave(step)) return;
    go(Math.min(step + 1, TOTAL_STEPS), step === 5);
  }

  function goBack() {
    go(Math.max(step - 1, 1), false);
  }

  function jumpTo(target: number) {
    if (target === step || target > furthest) return;
    go(target, step === 5 && target > step);
  }

  async function pickStyle(id: string) {
    setStyleId(id);
    if (!draftId) return;
    await recordInvitationDecision(draftId, "not_yet", INVITATION_MODES.PLACE_AND_PLENTY, id);
  }

  async function handleArtworkChosen(file: File | null | undefined) {
    if (!file) return;
    setArtworkError(null);
    const gatheringId = draftId;
    if (!gatheringId) {
      setArtworkError("Answer the first few questions and this will be ready — the file is filed under the gathering.");
      return;
    }
    const rejection = artworkRejectionReason(file);
    if (rejection) {
      setArtworkError(rejection);
      return;
    }
    const mimeType = resolveArtworkMimeType(file.type, file.name) ?? file.type;
    setUploading(true);
    try {
      const supabase = getBrowserClient();
      const path = artworkObjectPath(gatheringId, file.name, newFileId());
      const { error: uploadError } = await supabase.storage
        .from(INVITATION_ARTWORK_BUCKET)
        .upload(path, file, { contentType: mimeType, upsert: false });
      if (uploadError) {
        setArtworkError("That file didn't upload. Check your connection and try again.");
        return;
      }
      const recorded = await saveInvitationArtwork(gatheringId, path, mimeType, file.name);
      if (!recorded.ok) {
        setArtworkError(recorded.message);
        return;
      }
      setArtwork({ filename: file.name, mimeType });
      if (isRenderableArtwork(mimeType)) {
        const { data } = await supabase.storage.from(INVITATION_ARTWORK_BUCKET).createSignedUrl(path, 3600);
        setArtworkUrl(data?.signedUrl ?? null);
      } else {
        setArtworkUrl(null);
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  useEffect(() => {
    const settled = decision === "already_invited" || (decision === "not_yet" && mode !== null);
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

  function handleSubmit() {
    const errors = validateGatheringInput(input);
    if (errors.length > 0) {
      setLimit(null);
      setError(VALIDATION_MESSAGES[errors[0].code]);
      return;
    }
    clearRefusal();
    start(async () => {
      const saved = await saveGatheringDraft(
        input,
        draftId,
        draftId ? null : Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      if (!saved.ok) {
        showRefusal(saved);
        return;
      }
      if (!draftId) setDraftId(saved.value);
      await persistProgress(saved.value, TOTAL_STEPS, TOTAL_STEPS);
      await persistInvitation(saved.value);
      const finalised = await finaliseGatheringCreation(saved.value);
      if (!finalised.ok) {
        showRefusal(finalised);
        return;
      }
      router.replace(`/host/g/${saved.value}`);
    });
  }

  const pastWarning = input.gatheringDate && input.arrivalTime && isArrivalInPast(input.gatheringDate, input.arrivalTime);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[16rem,1fr]">
      <nav aria-label="Creation steps" className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
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
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-body text-sm transition-colors duration-400 disabled:cursor-not-allowed disabled:opacity-45 ${here ? "bg-forest text-offwhite" : "text-forest/75 hover:bg-forest/5"}`}
                >
                  <span aria-hidden className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${here ? "bg-gold text-forest" : done ? "bg-forest/85 text-offwhite" : "border border-sage/50 text-forest/60"}`}>
                    {done ? <Icon name="check" size={13} /> : n}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 px-3 font-body text-xs leading-relaxed text-forest/60">
          Your progress saves as you go. Nothing is shared until you finish.
        </p>
      </nav>

      <div className="max-w-2xl">
        <div className="mb-5 lg:hidden" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] text-forest/55">Step {step} of {TOTAL_STEPS}</p>
          <div className="mt-2 grid grid-cols-8 gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full ${i < step ? "bg-forest" : "bg-sage/25"}`} />
            ))}
          </div>
        </div>
        <p className="hidden font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] text-forest/55 lg:block">Step {step} of {TOTAL_STEPS}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-forest">{STEP_TITLES[step - 1]}</h2>
        <span aria-hidden className="mt-4 block h-[2px] w-14 bg-gold" />

        <fieldset disabled={submitting} className="contents">
          {step === 1 && (
            <div className="mt-7">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">What you&apos;re calling it</span>
                <input autoFocus value={input.name} onChange={(e) => update("name", e.target.value)} placeholder="Barbara's 80th Birthday" className="w-full rounded-card border border-sage/40 bg-white px-4 py-3 font-body text-forest outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" />
              </label>
              <p className="mt-6 mb-2 font-body text-sm font-semibold text-forest">What kind of gathering is it?</p>
              <ChipGrid>
                {GATHERING_TYPES.map((type) => (
                  <Chip key={type} selected={input.gatheringType === type} onClick={() => update("gatheringType", type as GatheringType)}>{gatheringTypeLabel(type)}</Chip>
                ))}
              </ChipGrid>
            </div>
          )}

          {step === 2 && (
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <NativeSelectorField label="Date" displayValue={formatDateDisplay(input.gatheringDate)} inputType="date" value={input.gatheringDate ?? ""} onChange={(value) => update("gatheringDate", value || null)} />
              <NativeSelectorField label="Start time" displayValue={formatTimeDisplay(input.arrivalTime)} inputType="time" value={input.arrivalTime ?? ""} onChange={(value) => update("arrivalTime", value || null)} />
              {pastWarning && <p className="font-body text-sm text-forest/70 sm:col-span-2">That time has already passed — that&apos;s okay if you&apos;re catching up, just double check the date.</p>}
            </div>
          )}

          {step === 3 && (
            <div className="mt-7 space-y-4">
              <CountField label="Adults" value={input.adultCount} onChange={(n) => update("adultCount", n)} />
              <CountField label="Children" value={input.childCount} onChange={(n) => update("childCount", n)} />
              <p className="font-body text-sm text-forest/65">Expected guests is worked out from these two — {input.adultCount + input.childCount} so far.</p>
            </div>
          )}

          {step === 4 && (
            <div className="mt-7">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">Where is it?</span>
                <input value={input.locationName} onChange={(e) => update("locationName", e.target.value)} placeholder="Home" className="w-full rounded-card border border-sage/40 bg-white px-4 py-3 font-body text-forest outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" />
              </label>
              <p className="mt-2 font-body text-sm text-forest/65">A name is enough. Guests see this on the invitation.</p>
            </div>
          )}

          {step === 5 && (
            <div className="mt-7">
              <ChipGrid>
                <Chip selected={decision === "already_invited"} onClick={() => { setDecision("already_invited"); setMode(null); setStyleId(null); }}>Yes, already invited</Chip>
                <Chip selected={decision === "not_yet"} onClick={() => setDecision("not_yet")}>Not yet</Chip>
                <Chip selected={decision === "later"} onClick={() => { setDecision("later"); setMode(null); setStyleId(null); }}>I&apos;ll do this later</Chip>
              </ChipGrid>
              {decision === "already_invited" && <p className="mt-4 font-body text-sm text-forest/70">Noted — Place &amp; Plenty won&apos;t send anything or claim invitations it didn&apos;t send. Everything else works the same.</p>}
              {decision === "later" && <p className="mt-4 font-body text-sm text-forest/70">Nothing is recorded either way. You can decide this any time from the gathering.</p>}
              {decision === "not_yet" && (
                <div className="mt-7">
                  <p className="mb-3 font-body text-sm font-semibold text-forest">How would you like to invite them?</p>
                  <div className="space-y-3">
                    <ModeOption selected={mode === INVITATION_MODES.UPLOADED} onClick={() => setMode(INVITATION_MODES.UPLOADED)} title="Upload my own" body="Already have something from Canva, Etsy, or a designer? That artwork becomes the face of this gathering." />
                    {mode === INVITATION_MODES.UPLOADED && (
                      <div className="rounded-card border border-sage/35 bg-parchment px-4 py-4">
                        {artwork && (
                          <div className="mb-4 flex items-center gap-4">
                            {artworkUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={artworkUrl} alt={`Your invitation artwork for ${input.name.trim() || "this gathering"}`} className="h-28 w-auto max-w-[10rem] rounded-md border border-sage/30 object-contain" />
                            ) : (
                              <span className="flex h-28 w-24 flex-col items-center justify-center gap-1.5 rounded-md border border-sage/30 bg-offwhite text-forest/70"><Icon name="card" size={22} /><span className="font-body text-[0.6rem] font-bold uppercase tracking-[0.14em]">PDF</span></span>
                            )}
                            <div className="min-w-0"><p className="truncate font-body text-sm font-semibold text-forest">{artwork.filename}</p><p className="mt-0.5 font-body text-xs text-forest/65">Saved to this gathering. It&apos;s the face of the gathering everywhere in Place &amp; Plenty, on the phone too.</p></div>
                          </div>
                        )}
                        <input ref={fileInput} type="file" className="sr-only" accept={ARTWORK_ACCEPT_ATTRIBUTE} onChange={(e) => handleArtworkChosen(e.target.files?.[0])} />
                        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading || !draftId} className="rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5 disabled:opacity-50">{uploading ? "Uploading…" : artwork ? "Replace artwork" : "Choose a file"}</button>
                        <p className="mt-2.5 font-body text-xs text-forest/70">{ARTWORK_LIMITS_HINT}</p>
                        <p className="mt-1.5 font-body text-xs leading-relaxed text-forest/60">You can also add or change this later on the gathering&apos;s Invitations screen.</p>
                        {artworkError && <p role="alert" className="mt-2.5 font-body text-sm text-error">{artworkError}</p>}
                      </div>
                    )}
                    <ModeOption selected={mode === INVITATION_MODES.PLACE_AND_PLENTY} onClick={() => setMode(INVITATION_MODES.PLACE_AND_PLENTY)} title="Use a Simple P&P invitation" body="We already have your gathering details. Pick a look." />
                    {mode === INVITATION_MODES.PLACE_AND_PLENTY && (
                      <div>
                        <p className="mb-3 mt-4 font-body text-sm font-semibold text-forest">Pick a look:</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {INVITATION_STYLES.map((s) => (
                            <button key={s.id} type="button" onClick={() => pickStyle(s.id)} className={`rounded-card p-1 text-left transition-colors duration-400 ${styleId === s.id ? "ring-2 ring-forest" : "ring-1 ring-sage/35 hover:ring-sage"}`}>
                              <span className="flex h-24 flex-col justify-center gap-1.5 rounded-md px-3 text-center" style={{ background: s.background, color: s.textColor, border: s.bordered ? `1px solid ${s.accentColor}` : undefined }}>
                                <span className="font-display text-sm leading-tight">{input.name.trim() || "Your gathering"}</span><span aria-hidden className="mx-auto block h-[1px] w-8" style={{ background: s.accentColor }} /><span className="font-body text-[0.62rem] tracking-wide">{input.gatheringDate ?? ""}</span>
                              </span>
                              <span className="mt-1.5 block px-1 font-body text-xs text-forest/75">{s.label}{styleId === s.id ? " ✓" : ""}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <ModeOption selected={mode === INVITATION_MODES.DETAILS_ONLY} onClick={() => setMode(INVITATION_MODES.DETAILS_ONLY)} title="Just send the details" body="No formal invitation needed." />
                  </div>
                </div>
              )}
              {inviteeCount === 0 && draftId && (
                <div className="mt-7 rounded-card border border-sage/35 bg-parchment px-5 py-4">
                  <p className="font-body text-sm font-semibold text-forest">Who are we inviting?</p><p className="mt-1 font-body text-sm text-forest/70">Nobody is on this list yet. You can add people now or after you finish.</p>
                  <Link href={`/host/g/${draftId}/people`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-forest px-4 py-2 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"><Icon name="people" size={15} />Add / select people</Link>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="mt-7">
              <label className="block max-w-xs"><span className="mb-1 block font-body text-sm font-semibold text-forest">Budget</span><input type="number" min={0} step="any" inputMode="decimal" value={input.budgetTarget ?? ""} onChange={(e) => update("budgetTarget", e.target.value === "" ? null : Number(e.target.value))} placeholder="500" className="w-full rounded-card border border-sage/40 bg-white px-4 py-3 font-body text-forest outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" /></label>
              <button type="button" onClick={() => update("budgetTarget", null)} className="mt-3 font-body text-sm text-forest/70 underline underline-offset-4 hover:text-forest">Skip for now</button>
              <p className="mt-4 font-body text-sm text-forest/65">Skipping is a real answer — it stays empty rather than being guessed at, and you can set it later.</p>
            </div>
          )}

          {step === 7 && <div className="mt-7"><ChipGrid>{FOOD_STYLES.map((style) => <Chip key={style} selected={input.foodStyle === style} onClick={() => update("foodStyle", style as FoodStyle)}>{FOOD_STYLE_LABELS[style]}</Chip>)}</ChipGrid></div>}

          {step === 8 && (
            <div className="mt-7">
              <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Anything we should know?</span><textarea rows={5} value={input.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes" className="w-full rounded-card border border-sage/40 bg-white px-4 py-3 font-body text-forest outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" /></label>
              <p className="mt-4 font-body text-sm text-forest/65">Dietary needs, accessibility and what the space is like are asked on the gathering itself, where the plan is made.</p>
            </div>
          )}

          {limit && <GatheringLimitNotice code={limit} onDismiss={clearRefusal} className="mt-6" />}
          {error && !limit && <p role="alert" className="mt-6 font-body text-sm text-error">{error}</p>}

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-sage/30 pt-6">
            {step > 1 && <button type="button" onClick={goBack} className="rounded-full px-4 py-2.5 font-body text-sm font-semibold text-forest/75 transition-colors duration-400 hover:text-forest disabled:opacity-60">Back</button>}
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={goNext} disabled={!canLeave(step)} className="rounded-full bg-forest px-7 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-50">Next</button>
            ) : (
              <button type="button" onClick={handleSubmit} className="rounded-full bg-forest px-7 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60">{submitting ? "Creating…" : "Create gathering"}</button>
            )}
            {draftId && <span className="font-body text-xs text-forest/55">Saved as a draft</span>}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`rounded-full border px-4 py-2 font-body text-sm transition-colors duration-400 ${selected ? "border-forest bg-forest text-offwhite" : "border-sage/45 text-forest hover:bg-forest/5"}`}>{children}</button>;
}

function ModeOption({ selected, onClick, title, body }: { selected: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`block w-full rounded-card border px-5 py-4 text-left transition-colors duration-400 ${selected ? "border-forest bg-forest text-offwhite" : "border-sage/40 bg-offwhite text-forest hover:border-sage"}`}>
      <span className="block font-body text-sm font-semibold">{title}</span><span className={`mt-1 block font-body text-sm ${selected ? "text-offwhite/85" : "text-forest/70"}`}>{body}</span>
    </button>
  );
}

function NativeSelectorField({ label, displayValue, inputType, value, onChange }: { label: string; displayValue: string; inputType: "date" | "time"; value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block cursor-pointer rounded-card border border-sage/40 bg-white px-4 py-3 transition hover:border-sage focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/10">
      <span className="block font-body text-xs font-semibold text-forest/65">{label}</span><span className="mt-1 flex items-center justify-between gap-3 font-body text-base text-forest"><span>{displayValue}</span><span aria-hidden className="text-forest/55">⌄</span></span>
      <input type={inputType} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
}

function CountField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [exact, setExact] = useState(value > 50);
  return (
    <div>
      <label className="block">
        <span className="sr-only">{label}</span>
        <div className="relative rounded-card border border-sage/40 bg-white transition hover:border-sage focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/10">
          <div className="pointer-events-none px-4 py-3"><span className="block font-body text-xs font-semibold text-forest/65">{label}</span><span className="mt-1 flex items-center justify-between gap-3 font-body text-base text-forest"><span>{value}</span><span aria-hidden className="text-forest/55">⌄</span></span></div>
          <select value={exact ? "exact" : String(Math.min(value, 50))} onChange={(e) => { if (e.target.value === "exact") { setExact(true); return; } setExact(false); onChange(Number(e.target.value)); }} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
            {Array.from({ length: 51 }, (_, n) => <option key={n} value={n}>{n}</option>)}<option value="exact">Enter exact number…</option>
          </select>
        </div>
      </label>
      {exact && <label className="mt-2 block max-w-xs"><span className="mb-1 block font-body text-xs font-semibold text-forest/65">Exact {label.toLowerCase()}</span><input autoFocus type="number" min={0} step={1} inputMode="numeric" value={value} onChange={(e) => { const n = Number(e.target.value); onChange(Number.isFinite(n) && n >= 0 ? Math.round(n) : 0); }} className="w-full rounded-card border border-sage/40 bg-white px-4 py-3 font-body text-forest outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10" /></label>}
    </div>
  );
}
