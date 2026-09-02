"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/host-actions";

export function ServingsControl({
  value,
  action,
  label,
}: {
  value: number | null;
  action: (next: number) => Promise<ActionResult>;
  label: string;
}) {
  const [current, setCurrent] = useState(value == null ? "" : String(value));
  const [saved, setSaved] = useState(current);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed = Number(current);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid serving amount.");
      return;
    }
    if (current === saved) return;
    setError(null);
    start(async () => {
      const result = await action(parsed);
      if (result.ok) setSaved(current);
      else {
        setCurrent(saved);
        setError(result.message);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <input
        aria-label={label}
        type="number"
        min="0"
        step="0.5"
        value={current}
        disabled={pending}
        onChange={(event) => setCurrent(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="w-20 rounded-md border border-sage/40 bg-white px-2.5 py-1.5 text-right font-body text-sm text-forest outline-none focus:border-forest disabled:opacity-50"
      />
      {error && <span role="alert" className="mt-1 max-w-44 text-right font-body text-xs text-error">{error}</span>}
    </span>
  );
}

export function LeftoverPreferenceControl({
  value,
  action,
}: {
  value: string | null;
  action: (next: string) => Promise<ActionResult>;
}) {
  const initial = value ?? "just_enough";
  const [current, setCurrent] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-card border border-sage/30 bg-parchment p-5">
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">How much are you making?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          ["just_enough", "Just enough"],
          ["a_little_extra", "A little extra"],
          ["send_home_with_plates", "Enough to send some home"],
        ].map(([option, label]) => (
          <button
            key={option}
            type="button"
            disabled={pending}
            onClick={() => {
              const previous = current;
              setCurrent(option);
              setError(null);
              start(async () => {
                const result = await action(option);
                if (!result.ok) {
                  setCurrent(previous);
                  setError(result.message);
                }
              });
            }}
            className={`rounded-xl border px-4 py-3 text-left font-body text-sm transition ${
              current === option
                ? "border-forest bg-forest text-offwhite"
                : "border-sage/30 bg-offwhite text-forest hover:border-sage"
            } disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 font-body text-xs leading-relaxed text-forest/60">
        Place &amp; Plenty uses this when it recommends quantities. You can still adjust any dish yourself.
      </p>
      {error && <p role="alert" className="mt-2 font-body text-sm text-error">{error}</p>}
    </div>
  );
}
