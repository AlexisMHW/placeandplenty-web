"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { GatheringSummary } from "@/lib/host-data";
import {
  cancelGathering,
  finishGathering,
  gatherAgain,
} from "@/lib/host-lifecycle-actions";

function statusLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function GatheringLifecyclePanel({
  gathering,
  isOwner,
}: {
  gathering: GatheringSummary;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [showGatherAgain, setShowGatherAgain] = useState(false);
  const [newDate, setNewDate] = useState(tomorrowIso());
  const [newTime, setNewTime] = useState(
    gathering.arrival_time?.slice(0, 5) || "18:00"
  );

  const state = gathering.effective_status;
  const terminal = gathering.lifecycle_completed_at !== null;
  const archived = gathering.status === "archived" || state === "archived";
  const canFinish = state === "hosting" && gathering.status !== "cancelled";
  const canCancel =
    !terminal &&
    !archived &&
    gathering.status !== "cancelled" &&
    (state === "draft" || state === "active");
  const canGatherAgain =
    gathering.locked_in_at !== null &&
    (state === "completed" || state === "cancelled" || archived || terminal);

  const explainer = useMemo(() => {
    if (archived || terminal) {
      return "This gathering is preserved as read-only history. Gather Again starts a fresh gathering and keeps this one intact.";
    }
    if (state === "hosting") {
      return "Your gathering is happening now. Finish Gathering records that the hosting day is complete while keeping everything from the gathering together.";
    }
    if (state === "completed") {
      return "The hosting window has ended. This gathering stays available during its post-gathering window, then becomes read-only history automatically.";
    }
    if (state === "cancelled") {
      return "This gathering is cancelled and its history stays intact. If you want to plan something similar later, Gather Again starts a fresh gathering.";
    }
    return "Place & Plenty keeps this gathering moving through its lifecycle automatically. Finish or cancel it when appropriate; old gatherings become read-only history on their own.";
  }, [archived, state, terminal]);

  function run(
    work: () => Promise<{ ok: true } | { ok: false; message: string }>,
    success: string
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setMessage({ kind: "ok", text: success });
      setShowCancel(false);
      router.refresh();
    });
  }

  if (!isOwner) {
    return (
      <section className="mt-10 max-w-3xl rounded-card border border-sage/30 bg-parchment p-6 md:p-7">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-forest/60">
          Gathering lifecycle
        </p>
        <div className="mt-3 h-px w-12 bg-gold" />
        <h3 className="mt-4 font-display text-xl text-forest">
          {statusLabel(state)}
        </h3>
        <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
          You can work inside this gathering as a co-host, but finishing or cancelling it belongs to the gathering owner.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 max-w-3xl rounded-card border border-sage/30 bg-parchment p-6 shadow-sm md:p-7">
      <div>
        <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-forest/60">
          Gathering lifecycle
        </p>
        <div className="mt-3 h-px w-12 bg-gold" />
        <h3 className="mt-4 font-display text-xl text-forest">
          {statusLabel(state)}
        </h3>
      </div>

      <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
        {explainer}
      </p>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-5 rounded-lg border px-4 py-3 font-body text-sm ${
            message.kind === "error"
              ? "border-error/30 bg-offwhite text-error"
              : "border-sage/35 bg-cream text-forest"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {canFinish && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => finishGathering(gathering.id), "Gathering marked finished.")}
            className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors hover:bg-forest/90 disabled:opacity-60"
          >
            {pending ? "Finishing…" : "Finish gathering"}
          </button>
        )}

        {canGatherAgain && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setShowGatherAgain((value) => !value);
            }}
            className="rounded-full border border-gold/60 bg-cream px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors hover:bg-gold/10 disabled:opacity-60"
          >
            Gather Again
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setShowCancel((value) => !value);
            }}
            className="rounded-full border border-error/35 bg-transparent px-5 py-2.5 font-body text-sm font-semibold text-error transition-colors hover:bg-error/5 disabled:opacity-60"
          >
            Cancel gathering
          </button>
        )}
      </div>

      {showGatherAgain && canGatherAgain && (
        <div className="mt-6 rounded-card border border-gold/25 bg-cream p-5">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.16em] text-forest/60">
            A fresh gathering, not a restore
          </p>
          <div className="mt-2 h-[2px] w-9 rounded-full bg-gold" />
          <h4 className="mt-3 font-display text-lg text-forest">
            When are you gathering again?
          </h4>
          <p className="mt-1 font-body text-sm leading-relaxed text-forest/65">
            We’ll carry over the reusable planning basics. Your people, replies, messages, photos and history stay with this gathering.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="font-body text-sm font-semibold text-forest">
              Date
              <input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-sage/40 bg-offwhite px-3 py-2.5 font-body font-normal text-forest outline-none focus:border-forest"
              />
            </label>
            <label className="font-body text-sm font-semibold text-forest">
              Arrival time
              <input
                type="time"
                value={newTime}
                onChange={(event) => setNewTime(event.target.value)}
                className="mt-2 w-full rounded-lg border border-sage/40 bg-offwhite px-3 py-2.5 font-body font-normal text-forest outline-none focus:border-forest"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pending || !newDate || !newTime}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await gatherAgain(gathering.id, newDate, newTime);
                if (!result.ok) {
                  setMessage({ kind: "error", text: result.message });
                  return;
                }
                router.push(`/host/create?editId=${result.value}`);
              });
            }}
            className="mt-4 rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors hover:bg-forest/90 disabled:opacity-60"
          >
            {pending ? "Starting…" : "Start the new draft"}
          </button>
        </div>
      )}

      {showCancel && canCancel && (
        <div className="mt-6 rounded-card border border-error/20 bg-offwhite p-5">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.16em] text-error/80">
            Cancel and notify
          </p>
          <h4 className="mt-2 font-display text-lg text-forest">
            What should your guests know?
          </h4>
          <textarea
            value={cancelMessage}
            onChange={(event) => setCancelMessage(event.target.value)}
            rows={4}
            placeholder="A short note for your guests"
            className="mt-4 w-full rounded-lg border border-sage/40 bg-white px-3 py-3 font-body text-sm text-forest outline-none focus:border-forest"
          />
          <p className="mt-2 font-body text-xs leading-relaxed text-forest/55">
            We’ll update the gathering and send your note to your guests.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => cancelGathering(gathering.id, cancelMessage), "Gathering cancelled.")}
            className="mt-4 rounded-full bg-error px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Confirm cancellation"}
          </button>
        </div>
      )}
    </section>
  );
}
