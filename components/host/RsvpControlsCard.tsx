"use client";

import { useState, useTransition } from "react";
import {
  setInvitationsPublishedWeb,
  setRsvpControlsWeb,
  type RsvpAction,
  type RsvpControlsState,
} from "@/lib/rsvp-controls-actions";

const REASON_COPY: Record<string, string> = {
  invitations_not_published: "Invitations aren’t published yet, so guests can’t RSVP.",
  rsvp_manually_closed: "You closed RSVPs. Guests can see the page but can’t respond.",
  rsvp_deadline_passed: "The RSVP deadline has passed. Guests can see the page but can’t respond.",
  gathering_completed: "This gathering is finished, so RSVPs are closed.",
  gathering_cancelled: "This gathering was cancelled.",
  gathering_archived_read_only: "This gathering is archived and read-only.",
};

function formatDeadline(iso: string | null, timeZone: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timeZone || undefined,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export default function RsvpControlsCard({
  gatheringId,
  initial,
  readOnly = false,
}: {
  gatheringId: string;
  initial: RsvpControlsState;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<RsvpControlsState>(initial);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("20:00");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = readOnly || pending || state.reason === "gathering_archived_read_only" || state.reason === "gathering_cancelled" || state.reason === "gathering_completed";
  const deadlineText = formatDeadline(state.deadline, state.timezone);

  function run(work: () => ReturnType<typeof setRsvpControlsWeb>, done: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        setState(result.state);
        setMessage(done);
      } else {
        setError(result.message);
      }
    });
  }

  const act = (action: RsvpAction, done: string) =>
    run(() => setRsvpControlsWeb(gatheringId, action, date, time), done);

  return (
    <section className="mt-6 rounded-2xl border border-sage/25 bg-offwhite p-5 md:p-6" aria-labelledby="rsvp-controls-heading">
      <p id="rsvp-controls-heading" className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
        RSVP controls
      </p>

      <p className="mt-3 font-body text-sm font-semibold text-forest" role="status">
        {state.open ? "RSVPs are open." : REASON_COPY[state.reason ?? ""] ?? "RSVPs are closed."}
      </p>
      {deadlineText ? (
        <p className="mt-1 font-body text-sm text-forest/70">Deadline: {deadlineText}</p>
      ) : (
        <p className="mt-1 font-body text-sm text-forest/70">No deadline set.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={() =>
            run(
              () => setInvitationsPublishedWeb(gatheringId, !state.invitationsPublished),
              state.invitationsPublished ? "Invitations unpublished." : "Invitations published."
            )
          }
          className="rounded-full border border-sage/40 px-4 py-2 font-body text-sm font-semibold text-forest disabled:opacity-50"
        >
          {state.invitationsPublished ? "Unpublish invitations" : "Publish invitations"}
        </button>
        {state.manualOverride === "closed" || (!state.open && state.reason === "rsvp_deadline_passed") ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => act("reopen", "RSVPs reopened.")}
            className="rounded-full border border-sage/40 px-4 py-2 font-body text-sm font-semibold text-forest disabled:opacity-50"
          >
            Reopen RSVPs
          </button>
        ) : (
          <button
            type="button"
            disabled={locked || !state.invitationsPublished}
            onClick={() => act("close", "RSVPs closed.")}
            className="rounded-full border border-sage/40 px-4 py-2 font-body text-sm font-semibold text-forest disabled:opacity-50"
          >
            Close RSVPs now
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="font-body text-xs font-semibold text-forest/70">
          Deadline date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={locked}
            className="mt-1 block rounded-lg border border-sage/40 bg-white px-3 py-2 text-sm text-forest"
          />
        </label>
        <label className="font-body text-xs font-semibold text-forest/70">
          Time{state.timezone ? ` (${state.timezone})` : ""}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={locked}
            className="mt-1 block rounded-lg border border-sage/40 bg-white px-3 py-2 text-sm text-forest"
          />
        </label>
        <button
          type="button"
          disabled={locked || !date}
          onClick={() => act("set_deadline", "Deadline saved.")}
          className="rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
        >
          Save deadline
        </button>
        {state.deadline ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => act("clear_deadline", "Deadline removed.")}
            className="rounded-full border border-sage/40 px-4 py-2 font-body text-sm font-semibold text-forest disabled:opacity-50"
          >
            Remove deadline
          </button>
        ) : null}
      </div>

      {message ? <p className="mt-3 font-body text-sm text-forest/80" role="status">{message}</p> : null}
      {error ? <p className="mt-3 font-body text-sm text-red-700" role="alert">{error}</p> : null}
    </section>
  );
}
