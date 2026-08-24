"use client";

import { useEffect, useState } from "react";
import {
  lookupGuestPage,
  submitRsvp,
  claimContribution,
  submitSongRequest,
  type GuestPageData,
  type RsvpResponseInput,
} from "@/lib/guest-api";

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

export default function GuestPageClient({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [guestForms, setGuestForms] = useState<Record<string, PerGuestForm>>({});
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

  useEffect(() => {
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

      const data = result.data;
      const initialForms: Record<string, PerGuestForm> = {};
      data.partyMembers.forEach((m) => {
        initialForms[m.gatheringGuestId] = {
          status:
            m.rsvpStatus === "yes" || m.rsvpStatus === "maybe" || m.rsvpStatus === "no"
              ? m.rsvpStatus
              : null,
          dietaryNotes: m.dietaryNotes ?? "",
          allergyNotes: m.allergyNotes ?? "",
          accessibilityNotes: m.accessibilityNotes ?? "",
        };
      });
      setGuestForms(initialForms);
      setState({ kind: "loaded", data });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      setRsvpError(
        (result.data as any)?.message ||
          "This gathering has been archived and is no longer accepting updates."
      );
      return;
    }
    if (!result.ok) {
      setRsvpError("That didn't go through. Please try again.");
      return;
    }
    setRsvpSubmitted(true);
  }

  async function handleClaim(contributionId: string, action: "claim" | "release") {
    setClaimError(null);
    setClaimingId(contributionId);
    const guestId = data.partyMembers[0]?.gatheringGuestId;
    const result = await claimContribution(token, contributionId, action, guestId);
    setClaimingId(null);

    if (result.status === 409) {
      setReadOnly(true);
      setClaimError("This gathering has been archived and is no longer accepting updates.");
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

    // Refresh regardless, per spec guidance on race conditions.
    const refreshed = await lookupGuestPage(token);
    if (refreshed.ok && refreshed.data) {
      setState({ kind: "loaded", data: refreshed.data });
    }
  }

  async function handleSongSubmit() {
    setSongError(null);
    if (!songTitle.trim()) {
      setSongError("Add a song title first.");
      return;
    }
    setSongSubmitting(true);
    const guestId = data.partyMembers[0]?.gatheringGuestId;
    const result = await submitSongRequest(
      token,
      songTitle.trim(),
      songArtist.trim() || undefined,
      guestId
    );
    setSongSubmitting(false);

    if (result.status === 409) {
      setReadOnly(true);
      setSongError("This gathering has been archived and is no longer accepting updates.");
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

      <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
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
          <p className="font-display text-lg text-error">This gathering was cancelled</p>
          <p className="mt-2 font-body text-sm text-forest/80">
            {data.cancellationMessage}
          </p>
        </div>
      )}

      {!isCancelled && data.isArchived && data.archivedMessage && (
        <div className="mt-8 rounded-card border border-gold bg-cream p-5">
          <p className="font-body text-sm text-forest/80">{data.archivedMessage}</p>
        </div>
      )}

      {data.rsvpDeadline && !isCancelled && (
        <p className="mt-6 font-body text-sm text-forest/60">
          Please respond by{" "}
          {new Date(`${data.rsvpDeadline}T00:00:00`).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
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
                      {member.firstName} {member.lastName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["yes", "maybe", "no"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            updateGuestForm(member.gatheringGuestId, { status: opt })
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
                  <label className="mb-1 block font-body text-sm font-semibold text-forest">
                    Bringing someone? ({data.plusOneLimit} allowed)
                  </label>
                  <input
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
                  <label className="mb-1 block font-body text-sm font-semibold text-forest">
                    Email for updates about this gathering{" "}
                    <span className="font-normal text-forest/50">(optional)</span>
                  </label>
                  <input
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
                <p className="font-body text-sm text-error">{rsvpError}</p>
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

      {/* --- Contributions --- */}
      {data.showPotluck && data.contributions.length > 0 && (
        <section className="mt-8 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <h2 className="font-display text-xl text-forest">Who&rsquo;s Bringing What</h2>
          {claimError && (
            <p className="mt-2 font-body text-sm text-error">{claimError}</p>
          )}
          <ul className="mt-4 divide-y divide-sage/20">
            {data.contributions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-3 font-body text-sm"
              >
                <div>
                  <p className="text-forest">
                    {item.itemName}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </p>
                  {item.status !== "needed" && !item.claimedByThisParty && (
                    <p className="text-forest/50">Covered</p>
                  )}
                </div>
                {item.status === "needed" && (
                  <button
                    type="button"
                    disabled={claimingId === item.id || readOnly}
                    onClick={() => handleClaim(item.id, "claim")}
                    className="rounded-full border border-forest px-4 py-1.5 font-body text-xs font-semibold text-forest hover:bg-forest/5 disabled:opacity-60"
                  >
                    I&rsquo;ll bring this
                  </button>
                )}
                {item.claimedByThisParty && (
                  <button
                    type="button"
                    disabled={claimingId === item.id || readOnly}
                    onClick={() => handleClaim(item.id, "release")}
                    className="rounded-full border border-sage/40 px-4 py-1.5 font-body text-xs text-forest/70 hover:bg-sage/10 disabled:opacity-60"
                  >
                    Release
                  </button>
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
            <p className="mt-3 font-body text-forest/80">Added to the playlist request.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Song title"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
              />
              <input
                type="text"
                placeholder="Artist (optional)"
                value={songArtist}
                onChange={(e) => setSongArtist(e.target.value)}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
              />
              {songError && (
                <p className="font-body text-sm text-error">{songError}</p>
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
    </div>
  );
}
