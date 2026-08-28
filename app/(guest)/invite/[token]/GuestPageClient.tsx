"use client";

import { useEffect, useState } from "react";
import {
  lookupGuestPage,
  submitRsvp,
  claimContribution,
  respondToContribution,
  submitSongRequest,
  preparePhotoUpload,
  uploadPhotoBytes,
  registerPhoto,
  isSafeExternalUrl,
  type GuestPageData,
  type RsvpResponseInput,
} from "@/lib/guest-api";
import { toUploadableJpeg } from "@/lib/image";

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "loaded"; data: GuestPageData };

interface PerGuestForm {
  status: "yes" | "maybe" | "no" | null;
  dietaryNotes: string;
  allergyNotes: string;
  accessibilityNotes: string;
}

const ARCHIVED_NOTICE =
  "This gathering has been archived and is no longer accepting updates.";

export default function GuestPageClient({
  token,
  initialData,
}: {
  token: string;
  // Rendered on the server so the invitation is visible immediately —
  // this page is opened on a phone, from a message, by someone who has
  // no patience for a spinner. Null when the server fetch failed; the
  // client then retries rather than showing an error it cannot explain.
  initialData?: GuestPageData | null;
}) {
  const [state, setState] = useState<LoadState>(
    initialData ? { kind: "loaded", data: initialData } : { kind: "loading" }
  );
  const [guestForms, setGuestForms] = useState<Record<string, PerGuestForm>>(
    () => (initialData ? buildForms(initialData) : {})
  );
  const [plusOneName, setPlusOneName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songSubmitting, setSongSubmitting] = useState(false);
  const [songSubmitted, setSongSubmitted] = useState(false);
  const [songError, setSongError] = useState<string | null>(null);

  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [openMessageFor, setOpenMessageFor] = useState<string | null>(null);

  const [photoCaption, setPhotoCaption] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoDone, setPhotoDone] = useState(false);

  useEffect(() => {
    if (initialData) return; // already have it from the server
    let cancelled = false;

    async function load() {
      const result = await lookupGuestPage(token);
      if (cancelled) return;

      if (result.status === 404) {
        setState({ kind: "not_found" });
        return;
      }
      if (!result.ok || !result.data) {
        setState({ kind: "error" });
        return;
      }
      setGuestForms(buildForms(result.data));
      setState({ kind: "loaded", data: result.data });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refresh() {
    const refreshed = await lookupGuestPage(token);
    if (refreshed.ok && refreshed.data) {
      setState({ kind: "loaded", data: refreshed.data });
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="mx-auto max-w-prose animate-pulse space-y-4 px-6 py-16">
        <div className="h-8 w-2/3 rounded bg-sage/20" />
        <div className="h-4 w-1/2 rounded bg-sage/20" />
        <div className="h-40 w-full rounded bg-sage/10" />
        <div className="h-4 w-full rounded bg-sage/20" />
        <div className="h-4 w-5/6 rounded bg-sage/20" />
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="mx-auto max-w-prose px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">
          This invitation link isn&rsquo;t valid.
        </p>
        <p className="mt-3 font-body text-forest/70">
          Double-check the link, or reach out to whoever invited you.
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-prose px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">
          Something went wrong loading this invitation.
        </p>
        <p className="mt-3 font-body text-forest/70">
          Please try again in a moment.
        </p>
      </div>
    );
  }

  const data = state.data;
  const isCancelled = !!data.cancellationMessage;
  const canWrite = !isCancelled && !data.isArchived && !readOnly;
  const firstMemberId = data.partyMembers[0]?.gatheringGuestId;

  function updateGuestForm(id: string, patch: Partial<PerGuestForm>) {
    setGuestForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleRsvpSubmit() {
    setRsvpError(null);
    const responses: RsvpResponseInput[] = data.partyMembers
      .filter((m) => guestForms[m.gatheringGuestId]?.status)
      .map((m) => {
        const f = guestForms[m.gatheringGuestId];
        return {
          gatheringGuestId: m.gatheringGuestId,
          status: f.status as "yes" | "maybe" | "no",
          dietaryNotes: f.dietaryNotes || undefined,
          allergyNotes: f.allergyNotes || undefined,
          accessibilityNotes: f.accessibilityNotes || undefined,
        };
      });

    if (responses.length === 0) {
      setRsvpError("Please choose a response for at least one person.");
      return;
    }

    setRsvpSubmitting(true);
    const result = await submitRsvp(
      token,
      responses,
      data.plusOneAllowed ? plusOneName || undefined : undefined,
      !data.contactEmail.has ? contactEmail || undefined : undefined
    );
    setRsvpSubmitting(false);

    if (result.status === 409) {
      setReadOnly(true);
      setRsvpError((result.data as any)?.message || ARCHIVED_NOTICE);
      return;
    }
    if (!result.ok) {
      setRsvpError("That didn't go through. Please try again.");
      return;
    }
    setRsvpSubmitted(true);
  }

  async function handleClaim(
    contributionId: string,
    action: "claim" | "release"
  ) {
    setClaimError(null);
    setClaimingId(contributionId);
    // Household-level claim: no gatheringGuestId. See the note in
    // lib/guest-api.ts — a per-guest claim vanishes from the server's
    // own projection on the next refresh.
    const result = await claimContribution(token, contributionId, action);
    setClaimingId(null);

    if (result.status === 409) {
      setReadOnly(true);
      setClaimError(ARCHIVED_NOTICE);
      return;
    }
    if (!result.ok || result.data?.success === false) {
      if (result.data?.reason === "already_claimed") {
        setClaimError("Someone just claimed that — refreshing the list.");
      } else if (result.data?.reason === "not_your_claim") {
        setClaimError("That claim belongs to someone else.");
      } else {
        setClaimError("That didn't go through. Please try again.");
      }
    }

    await refresh();
  }

  async function handleRespond(
    contributionId: string,
    action: "yes" | "no" | "message"
  ) {
    setRespondError(null);
    const message = messageDrafts[contributionId]?.trim();
    if (action === "message" && !message) {
      setRespondError("Add a note first.");
      return;
    }

    setRespondingId(contributionId);
    const result = await respondToContribution(
      token,
      contributionId,
      action,
      action === "message" ? message : undefined
    );
    setRespondingId(null);

    if (result.status === 409) {
      setReadOnly(true);
      setRespondError(ARCHIVED_NOTICE);
      return;
    }
    if (!result.ok) {
      setRespondError("That didn't go through. Please try again.");
      return;
    }

    if (action === "message") {
      setMessageDrafts((prev) => ({ ...prev, [contributionId]: "" }));
      setOpenMessageFor(null);
    }
    await refresh();
  }

  async function handleSongSubmit() {
    setSongError(null);
    if (!songTitle.trim()) {
      setSongError("Add a song title first.");
      return;
    }
    setSongSubmitting(true);
    const result = await submitSongRequest(
      token,
      songTitle.trim(),
      songArtist.trim() || undefined,
      firstMemberId
    );
    setSongSubmitting(false);

    if (result.status === 409) {
      setReadOnly(true);
      setSongError(ARCHIVED_NOTICE);
      return;
    }
    if (result.status === 403) {
      setSongError("Song requests aren't available for this gathering.");
      return;
    }
    if (!result.ok) {
      setSongError("That didn't go through. Please try again.");
      return;
    }
    setSongSubmitted(true);
    setSongTitle("");
    setSongArtist("");
  }

  async function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);

    const jpeg = await toUploadableJpeg(file);
    if (!jpeg) {
      setPhotoBusy(false);
      setPhotoError("We couldn't read that image. Try a different photo.");
      return;
    }

    const prepared = await preparePhotoUpload(token);
    if (prepared.status === 403) {
      setPhotoBusy(false);
      setPhotoError("Photo sharing isn't switched on for this gathering.");
      return;
    }
    if (!prepared.ok || !prepared.data?.signedUrl) {
      setPhotoBusy(false);
      setPhotoError("That didn't go through. Please try again.");
      return;
    }

    const uploaded = await uploadPhotoBytes(prepared.data.signedUrl, jpeg);
    if (!uploaded) {
      setPhotoBusy(false);
      setPhotoError("The upload didn't finish. Please try again.");
      return;
    }

    const registered = await registerPhoto(
      token,
      prepared.data.storagePath,
      photoCaption.trim() || undefined,
      firstMemberId
    );
    setPhotoBusy(false);

    if (registered.status === 409) {
      setReadOnly(true);
      setPhotoError(ARCHIVED_NOTICE);
      return;
    }
    if (!registered.ok) {
      setPhotoError("That didn't go through. Please try again.");
      return;
    }

    setPhotoCaption("");
    setPhotoDone(true);
  }

  const formattedDate = data.displayDate
    ? new Date(`${data.displayDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;
  const formattedTime = data.displayTime
    ? new Date(`2000-01-01T${data.displayTime}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto max-w-prose px-6 py-12 md:py-16">
      {data.invitationArtwork && (
        <div className="mb-8 overflow-hidden rounded-card border border-sage/30 bg-cream shadow-soft">
          {data.invitationArtwork.mimeType === "application/pdf" ? (
            <a
              href={data.invitationArtwork.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 text-center font-body text-sm font-semibold text-forest underline decoration-gold underline-offset-4"
            >
              View invitation (PDF)
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.invitationArtwork.url}
              alt="Invitation"
              className="h-auto w-full object-contain"
            />
          )}
        </div>
      )}

      <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
        {data.hostDisplayName} invited {data.partyName}
      </p>
      <h1 className="mt-2 font-display text-3xl text-forest md:text-4xl">
        {data.displayName}
      </h1>

      <div className="mt-4 space-y-1 font-body text-forest/80">
        {formattedDate && <p>{formattedDate}</p>}
        {formattedTime && <p>{formattedTime}</p>}
        {data.displayLocation && <p>{data.displayLocation}</p>}
      </div>

      {data.displayDescription && (
        <p className="mt-5 font-body leading-relaxed text-forest/80">
          {data.displayDescription}
        </p>
      )}

      {isCancelled && (
        <div className="mt-8 rounded-card border border-error/40 bg-error/5 p-5">
          <p className="font-display text-lg text-error">
            This gathering was cancelled
          </p>
          <p className="mt-2 font-body text-sm text-forest/80">
            {data.cancellationMessage}
          </p>
        </div>
      )}

      {!isCancelled && data.isArchived && data.archivedMessage && (
        <div className="mt-8 rounded-card border border-gold bg-cream p-5">
          <p className="font-body text-sm text-forest/80">
            {data.archivedMessage}
          </p>
        </div>
      )}

      {data.rsvpDeadline && !isCancelled && (
        <p className="mt-6 font-body text-sm text-forest/60">
          Please respond by{" "}
          {new Date(`${data.rsvpDeadline}T00:00:00`).toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric" }
          )}
          .
        </p>
      )}

      {/* --- RSVP --- */}
      {!isCancelled && !data.isArchived && (
        <section className="mt-10 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">RSVP</h2>

          {rsvpSubmitted ? (
            <p className="mt-4 font-body text-forest/80">
              Thanks — your response has been recorded.
            </p>
          ) : (
            <div className="mt-5 space-y-6">
              {data.partyMembers.map((member) => {
                const form = guestForms[member.gatheringGuestId];
                if (!form) return null;
                return (
                  <div
                    key={member.gatheringGuestId}
                    className="border-b border-sage/20 pb-5 last:border-b-0"
                  >
                    <p className="font-body font-semibold text-forest">
                      {member.firstName}
                      {member.lastName ? ` ${member.lastName}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["yes", "maybe", "no"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            updateGuestForm(member.gatheringGuestId, {
                              status: opt,
                            })
                          }
                          className={`rounded-full border px-4 py-1.5 font-body text-sm capitalize transition-colors duration-400 ${
                            form.status === opt
                              ? "border-forest bg-forest text-offwhite"
                              : "border-sage/40 text-forest hover:bg-sage/10"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {form.status === "yes" && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          aria-label={`Dietary notes for ${member.firstName}`}
                          placeholder="Dietary notes"
                          value={form.dietaryNotes}
                          maxLength={500}
                          onChange={(e) =>
                            updateGuestForm(member.gatheringGuestId, {
                              dietaryNotes: e.target.value,
                            })
                          }
                          className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
                        />
                        <input
                          type="text"
                          aria-label={`Allergies for ${member.firstName}`}
                          placeholder="Allergies"
                          value={form.allergyNotes}
                          maxLength={500}
                          onChange={(e) =>
                            updateGuestForm(member.gatheringGuestId, {
                              allergyNotes: e.target.value,
                            })
                          }
                          className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
                        />
                        <input
                          type="text"
                          aria-label={`Accessibility notes for ${member.firstName}`}
                          placeholder="Accessibility notes"
                          value={form.accessibilityNotes}
                          maxLength={500}
                          onChange={(e) =>
                            updateGuestForm(member.gatheringGuestId, {
                              accessibilityNotes: e.target.value,
                            })
                          }
                          className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {data.plusOneAllowed && (
                <div>
                  <label
                    htmlFor="plus-one"
                    className="mb-1 block font-body text-sm font-semibold text-forest"
                  >
                    Bringing someone? ({data.plusOneLimit} allowed)
                  </label>
                  <input
                    id="plus-one"
                    type="text"
                    placeholder="Guest name"
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
                  />
                </div>
              )}

              {!data.contactEmail.has && (
                <div>
                  <label
                    htmlFor="contact-email"
                    className="mb-1 block font-body text-sm font-semibold text-forest"
                  >
                    Email for updates about this gathering{" "}
                    <span className="font-normal text-forest/50">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
                  />
                </div>
              )}
              {data.contactEmail.has && data.contactEmail.masked && (
                <p className="font-body text-xs text-forest/50">
                  We&rsquo;ll send updates to {data.contactEmail.masked}.
                </p>
              )}

              {rsvpError && (
                <p role="alert" className="font-body text-sm text-error">
                  {rsvpError}
                </p>
              )}

              <button
                type="button"
                onClick={handleRsvpSubmit}
                disabled={rsvpSubmitting || readOnly}
                className="w-full rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
              >
                {rsvpSubmitting ? "Sending…" : "Send RSVP"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* --- Assigned to this party, by name --- */}
      {data.assignedContributions.length > 0 && (
        <section className="mt-8 rounded-card border border-gold bg-cream p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">
            {data.hostDisplayName} asked you to bring
          </h2>

          {respondError && (
            <p role="alert" className="mt-2 font-body text-sm text-error">
              {respondError}
            </p>
          )}

          <ul className="mt-4 space-y-5">
            {data.assignedContributions.map((item) => {
              const busy = respondingId === item.id;
              return (
                <li
                  key={item.id}
                  className="border-b border-sage/20 pb-5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-body font-semibold text-forest">
                      {item.itemName}
                      {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      {item.unit ? ` (${item.unit})` : ""}
                    </p>
                    {item.assignedToName && (
                      <p className="font-body text-xs text-forest/60">
                        for {item.assignedToName}
                      </p>
                    )}
                  </div>

                  {item.hostNote && (
                    <p className="mt-1 font-body text-sm italic text-forest/70">
                      &ldquo;{item.hostNote}&rdquo;
                    </p>
                  )}

                  {item.status === "confirmed" && (
                    <p className="mt-2 font-body text-sm font-semibold text-forest">
                      You said yes to this.
                    </p>
                  )}
                  {item.status === "declined" && (
                    <p className="mt-2 font-body text-sm text-forest/60">
                      You said you can&rsquo;t bring this.
                    </p>
                  )}

                  {item.messages.length > 0 && (
                    <ul className="mt-3 space-y-2 rounded-md bg-offwhite/70 p-3">
                      {item.messages.map((m) => (
                        <li key={m.id} className="font-body text-sm">
                          <span className="font-semibold text-forest">
                            {m.senderType === "host"
                              ? data.hostDisplayName
                              : "You"}
                            :
                          </span>{" "}
                          <span className="text-forest/80">{m.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {canWrite && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRespond(item.id, "yes")}
                        className={`rounded-full border px-4 py-1.5 font-body text-sm transition-colors duration-400 disabled:opacity-60 ${
                          item.status === "confirmed"
                            ? "border-forest bg-forest text-offwhite"
                            : "border-forest text-forest hover:bg-forest/5"
                        }`}
                      >
                        I&rsquo;ve got it
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRespond(item.id, "no")}
                        className={`rounded-full border px-4 py-1.5 font-body text-sm transition-colors duration-400 disabled:opacity-60 ${
                          item.status === "declined"
                            ? "border-forest bg-forest/80 text-offwhite"
                            : "border-sage/40 text-forest hover:bg-sage/10"
                        }`}
                      >
                        I can&rsquo;t
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setOpenMessageFor(
                            openMessageFor === item.id ? null : item.id
                          )
                        }
                        className="rounded-full border border-sage/40 px-4 py-1.5 font-body text-sm text-forest/80 hover:bg-sage/10 disabled:opacity-60"
                      >
                        Send a note
                      </button>
                    </div>
                  )}

                  {canWrite && openMessageFor === item.id && (
                    <div className="mt-3 space-y-2">
                      <label htmlFor={`note-${item.id}`} className="sr-only">
                        Note about {item.itemName}
                      </label>
                      <textarea
                        id={`note-${item.id}`}
                        rows={2}
                        maxLength={1000}
                        placeholder="Anything the host should know?"
                        value={messageDrafts[item.id] ?? ""}
                        onChange={(e) =>
                          setMessageDrafts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRespond(item.id, "message")}
                        className="rounded-full bg-forest px-5 py-2 font-body text-sm font-semibold text-offwhite hover:bg-forest/90 disabled:opacity-60"
                      >
                        {busy ? "Sending…" : "Send note"}
                      </button>
                      <p className="font-body text-xs text-forest/50">
                        A note isn&rsquo;t an answer — the host will still be
                        waiting on a yes or no.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* --- Open contributions anyone can pick up --- */}
      {data.showPotluck && data.contributions.length > 0 && (
        <section className="mt-8 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">
            Who&rsquo;s Bringing What
          </h2>
          {claimError && (
            <p role="alert" className="mt-2 font-body text-sm text-error">
              {claimError}
            </p>
          )}
          <ul className="mt-4 divide-y divide-sage/20">
            {data.contributions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 font-body text-sm"
              >
                <div>
                  <p className="text-forest">
                    {item.itemName}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </p>
                  {item.status !== "needed" && !item.claimedByThisParty && (
                    <p className="text-forest/50">Covered</p>
                  )}
                  {item.claimedByThisParty && (
                    <p className="font-semibold text-forest">You&rsquo;re bringing this</p>
                  )}
                </div>
                {item.status === "needed" && canWrite && (
                  <button
                    type="button"
                    disabled={claimingId === item.id}
                    onClick={() => handleClaim(item.id, "claim")}
                    className="flex-shrink-0 rounded-full border border-forest px-4 py-1.5 font-body text-xs font-semibold text-forest hover:bg-forest/5 disabled:opacity-60"
                  >
                    I&rsquo;ll bring this
                  </button>
                )}
                {item.claimedByThisParty && canWrite && (
                  <button
                    type="button"
                    disabled={claimingId === item.id}
                    onClick={() => handleClaim(item.id, "release")}
                    className="flex-shrink-0 rounded-full border border-sage/40 px-4 py-1.5 font-body text-xs text-forest/70 hover:bg-sage/10 disabled:opacity-60"
                  >
                    Release
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Gifts / registry --- */}
      {/* Read-only, so it stays available on an archived gathering — only
          write-capable sections close. The server sends registryLinks
          only when the host's switch is on, and the RPC behind it
          re-checks that switch itself. Nothing is inferred here. */}
      {data.showGiftsRegistry && data.registryLinks.length > 0 && (
        <section className="mt-8 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">Gifts</h2>
          <p className="mt-2 font-body text-sm text-forest/70">
            If you&rsquo;d like to bring something, {data.hostDisplayName} put
            these together. Never required.
          </p>
          <ul className="mt-4 space-y-3">
            {data.registryLinks
              .filter((link) => isSafeExternalUrl(link.url))
              .map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-body font-semibold text-forest underline decoration-gold underline-offset-4 hover:text-sage"
                  >
                    {link.label}
                  </a>
                  {link.note && (
                    <p className="mt-0.5 font-body text-sm text-forest/70">
                      {link.note}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* --- Song request --- */}
      {data.showSongRequest && (
        <section className="mt-8 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">Request a Song</h2>
          {songSubmitted ? (
            <p className="mt-3 font-body text-forest/80">
              Added to the playlist request.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <label htmlFor="song-title" className="sr-only">
                Song title
              </label>
              <input
                id="song-title"
                type="text"
                placeholder="Song title"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
              />
              <label htmlFor="song-artist" className="sr-only">
                Artist (optional)
              </label>
              <input
                id="song-artist"
                type="text"
                placeholder="Artist (optional)"
                value={songArtist}
                onChange={(e) => setSongArtist(e.target.value)}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
              />
              {songError && (
                <p role="alert" className="font-body text-sm text-error">
                  {songError}
                </p>
              )}
              <button
                type="button"
                onClick={handleSongSubmit}
                disabled={songSubmitting || readOnly}
                className="rounded-full bg-forest px-6 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
              >
                {songSubmitting ? "Adding…" : "Add song"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* --- Photo contribution --- */}
      {/* Adding a photo grants no right to browse the gallery. That is a
          separate link the host shares deliberately. */}
      {data.showPhotoContributions && canWrite && (
        <section className="mt-8 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">Add a photo</h2>
          <p className="mt-2 font-body text-sm text-forest/70">
            Got a good one from the day? Share it with the host.
          </p>

          {photoDone ? (
            <div className="mt-4">
              <p className="font-body text-forest/80">
                Thanks — your photo has been sent.
              </p>
              <button
                type="button"
                onClick={() => setPhotoDone(false)}
                className="mt-3 rounded-full border border-sage/40 px-5 py-2 font-body text-sm text-forest hover:bg-sage/10"
              >
                Add another
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <label htmlFor="photo-caption" className="sr-only">
                Caption (optional)
              </label>
              <input
                id="photo-caption"
                type="text"
                placeholder="Caption (optional)"
                maxLength={300}
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
              />

              <label
                htmlFor="photo-file"
                className={`block cursor-pointer rounded-full bg-forest px-6 py-3 text-center font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 ${
                  photoBusy ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {photoBusy ? "Sending…" : "Choose a photo"}
              </label>
              <input
                id="photo-file"
                type="file"
                accept="image/*"
                disabled={photoBusy}
                className="sr-only"
                onChange={(e) => {
                  handlePhotoSelected(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              {photoError && (
                <p role="alert" className="font-body text-sm text-error">
                  {photoError}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function buildForms(data: GuestPageData): Record<string, PerGuestForm> {
  const forms: Record<string, PerGuestForm> = {};
  data.partyMembers.forEach((m) => {
    forms[m.gatheringGuestId] = {
      status:
        m.rsvpStatus === "yes" || m.rsvpStatus === "maybe" || m.rsvpStatus === "no"
          ? m.rsvpStatus
          : null,
      dietaryNotes: m.dietaryNotes ?? "",
      allergyNotes: m.allergyNotes ?? "",
      accessibilityNotes: m.accessibilityNotes ?? "",
    };
  });
  return forms;
}
