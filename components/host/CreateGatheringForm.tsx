"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGatheringFromWeb } from "@/lib/create-gathering-action";

const TYPES = [
  ["birthday", "Birthday"],
  ["dinner", "Dinner"],
  ["brunch", "Brunch"],
  ["holiday", "Holiday"],
  ["shower", "Shower"],
  ["cookout", "Cookout"],
  ["game_night", "Game night"],
  ["family_gathering", "Family gathering"],
  ["repast", "Repast"],
  ["open_house", "Open house"],
  ["other", "Other"],
] as const;

const fieldClass =
  "w-full rounded-lg border border-sage/40 bg-white px-3 py-2.5 font-body text-forest outline-none transition focus:border-forest/55 focus:ring-2 focus:ring-sage/20";

export default function CreateGatheringForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("America/Chicago");

  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) setTimezone(resolved);
  }, []);

  return (
    <form
      className="mt-8 rounded-2xl border border-sage/30 bg-parchment p-5 md:p-7"
      action={(formData) => {
        setError(null);
        start(async () => {
          const result = await createGatheringFromWeb(formData);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.push(`/host/g/${result.gatheringId}`);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="timezone" value={timezone} />

      <fieldset disabled={pending} className="space-y-7">
        <section>
          <h2 className="font-display text-xl text-forest">The gathering</h2>
          <p className="mt-1 font-body text-sm text-forest/65">
            Start with the details people need to know. You can keep planning once the gathering is created.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">What are you calling it?</span>
              <input className={fieldClass} name="name" required maxLength={120} placeholder="40th Dinner" />
            </label>

            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">What kind of gathering?</span>
              <select className={fieldClass} name="gathering_type" required defaultValue="">
                <option value="" disabled>Choose one</option>
                {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Where?</span>
              <input className={fieldClass} name="location_name" maxLength={160} placeholder="Home, backyard, venue…" />
            </label>

            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Date</span>
              <input className={fieldClass} type="date" name="gathering_date" required />
            </label>

            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">When should people arrive?</span>
              <input className={fieldClass} type="time" name="arrival_time" required />
            </label>
          </div>
        </section>

        <section className="border-t border-sage/25 pt-6">
          <h2 className="font-display text-xl text-forest">Your people</h2>
          <p className="mt-1 font-body text-sm text-forest/65">A best estimate is enough. You can manage the actual guest list in My People.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Adults</span>
              <input className={fieldClass} type="number" name="adult_count" min="0" step="1" defaultValue="1" required />
            </label>
            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Children</span>
              <input className={fieldClass} type="number" name="child_count" min="0" step="1" defaultValue="0" required />
            </label>
          </div>
        </section>

        <section className="border-t border-sage/25 pt-6">
          <h2 className="font-display text-xl text-forest">A little planning context</h2>
          <p className="mt-1 font-body text-sm text-forest/65">Optional. Skip anything you have not decided yet.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Budget target</span>
              <input className={fieldClass} type="number" name="budget_target" min="0" step="0.01" placeholder="Optional" />
            </label>
            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Food style</span>
              <select className={fieldClass} name="food_style" defaultValue="">
                <option value="">Not decided</option>
                <option value="sit_down">Sit-down meal</option>
                <option value="buffet">Buffet</option>
                <option value="family_style">Family style</option>
                <option value="grazing">Grazing / small bites</option>
                <option value="potluck">Potluck</option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Inside or outside?</span>
              <select className={fieldClass} name="indoor_outdoor" defaultValue="">
                <option value="">Not decided</option>
                <option value="indoors">Indoors</option>
                <option value="outdoors">Outdoors</option>
                <option value="indoor_outdoor">A little of both</option>
              </select>
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block font-body text-sm font-semibold text-forest">Anything else you already know?</span>
              <textarea className={`${fieldClass} min-h-28 resize-y`} name="notes" maxLength={1000} placeholder="Optional notes" />
            </label>
          </div>
        </section>

        {error && <p role="alert" className="rounded-lg border border-error/30 bg-white px-4 py-3 font-body text-sm text-error">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t border-sage/25 pt-6">
          <button type="submit" className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition hover:bg-forest/90 disabled:opacity-60">
            {pending ? "Creating…" : "Create Gathering"}
          </button>
          <button type="button" onClick={() => router.push("/host")} className="rounded-full px-5 py-3 font-body text-sm font-semibold text-forest/70 hover:text-forest">
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
