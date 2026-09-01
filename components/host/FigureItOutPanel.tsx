"use client";

import { useState, useTransition } from "react";
import { runFigureItOutWeb } from "@/lib/figure-it-out-actions";

export default function FigureItOutPanel({
  gatheringId,
  initialDietaryNotes,
  initialAccessibilityNotes,
  hasPlan,
  readOnly,
}: {
  gatheringId: string;
  initialDietaryNotes: string;
  initialAccessibilityNotes: string;
  hasPlan: boolean;
  readOnly: boolean;
}) {
  const [dietaryNotes, setDietaryNotes] = useState(initialDietaryNotes);
  const [accessibilityNotes, setAccessibilityNotes] = useState(initialAccessibilityNotes);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setMessage(null);
    startTransition(async () => {
      const result = await runFigureItOutWeb(gatheringId, dietaryNotes, accessibilityNotes);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(
        result.cached
          ? "Your plan already matches what you’ve told us, so we kept it — no new AI call needed."
          : "Your plan is ready. HostReady and Next Up have been refreshed too."
      );
    });
  }

  return (
    <section className="relative mt-5 overflow-hidden rounded-2xl border border-gold/35 bg-parchment px-6 py-6 sm:px-7">
      <div className="absolute inset-y-0 left-0 w-1 bg-gold/70" aria-hidden />
      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-forest/55">
        Planning intelligence
      </p>
      <div className="mt-2 h-px w-10 bg-gold" aria-hidden />

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div>
          <h2 className="font-display text-2xl text-forest">Figure It Out</h2>
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-forest/70">
            Tell us anything your plan needs to account for. Place & Plenty uses the gathering details you’ve already entered to build a practical Beforehand Plan — without making you repeat yourself.
          </p>
          {hasPlan && (
            <p className="mt-3 font-body text-xs leading-relaxed text-forest/55">
              You already have a plan. If nothing material changed, we reuse it instead of spending another AI call.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-body text-xs font-semibold text-forest/75">Dietary or allergy notes</span>
            <textarea
              value={dietaryNotes}
              onChange={(event) => setDietaryNotes(event.target.value)}
              disabled={readOnly || isPending}
              rows={3}
              placeholder="Nut allergy, vegetarian guest…"
              className="mt-2 w-full resize-none rounded-xl border border-sage/35 bg-cream px-3.5 py-3 font-body text-sm text-forest outline-none transition focus:border-gold disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="font-body text-xs font-semibold text-forest/75">Accessibility or comfort notes</span>
            <textarea
              value={accessibilityNotes}
              onChange={(event) => setAccessibilityNotes(event.target.value)}
              disabled={readOnly || isPending}
              rows={3}
              placeholder="Step-free seating, quieter area…"
              className="mt-2 w-full resize-none rounded-xl border border-sage/35 bg-cream px-3.5 py-3 font-body text-sm text-forest outline-none transition focus:border-gold disabled:opacity-60"
            />
          </label>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={readOnly || isPending}
              className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isPending ? "Figuring it out…" : hasPlan ? "Refresh My Plan" : "Figure It Out"}
            </button>
            {readOnly && (
              <span className="font-body text-xs text-forest/55">This finished gathering is preserved as read-only.</span>
            )}
          </div>

          {message && (
            <p role="status" className="sm:col-span-2 font-body text-sm leading-relaxed text-forest/70">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
