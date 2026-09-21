"use client";

import { useMemo, useState } from "react";
import {
  acknowledgeGuestUpdate,
  type GuestLivingData,
  type GuestUpdateItem,
} from "@/lib/guest-living-api";

const CATEGORY_LABELS: Record<string, string> = {
  general: "Gathering update",
  weather_contingency: "Weather update",
  location_change: "Location change",
  time_change: "Time change",
  parking_arrival: "Arrival update",
  food_menu: "Food & menu",
  reminder: "Reminder",
  other: "Update",
};

function UpdateCard({ token, item, archived }: { token: string; item: GuestUpdateItem; archived: boolean }) {
  const [acknowledgedAt, setAcknowledgedAt] = useState(item.acknowledgedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    if (saving || acknowledgedAt || archived) return;
    setSaving(true);
    setError(null);
    const result = await acknowledgeGuestUpdate(token, item.id);
    if (result.ok && result.data?.acknowledgedAt) {
      setAcknowledgedAt(result.data.acknowledgedAt);
    } else {
      setError("That didn't save. Try again in a moment.");
    }
    setSaving(false);
  }

  return (
    <article
      className={`rounded-2xl border px-5 py-5 shadow-sm ${
        item.importance === "important"
          ? "border-gold/60 bg-parchment"
          : "border-sage/25 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-body text-[0.65rem] font-bold uppercase tracking-[0.18em] text-forest/55">
          {CATEGORY_LABELS[item.category] ?? "Update"}
        </p>
        {item.importance === "important" && (
          <span className="rounded-full border border-gold/50 px-2.5 py-1 font-body text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest/70">
            Important
          </span>
        )}
      </div>
      <h3 className="mt-2 font-display text-xl text-forest">{item.title}</h3>
      <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-forest/75">
        {item.body}
      </p>
      {item.requireAcknowledgement && !archived && (
        <div className="mt-4">
          {acknowledgedAt ? (
            <p className="font-body text-sm font-semibold text-forest">Got it ✓</p>
          ) : (
            <button
              type="button"
              onClick={acknowledge}
              disabled={saving}
              className="rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite transition disabled:opacity-60"
            >
              {saving ? "Saving…" : "Got it"}
            </button>
          )}
          {error && <p className="mt-2 font-body text-xs text-forest/65">{error}</p>}
        </div>
      )}
    </article>
  );
}

export default function GuestLivingPanel({
  token,
  gatheringName,
  initialData,
}: {
  token: string;
  gatheringName: string;
  initialData: GuestLivingData | null;
}) {
  const details = useMemo(
    () => [
      ["Attire / Dress Code", initialData?.attire],
      ["Arrival & Parking", initialData?.arrivalParking],
      ["Transportation", initialData?.transportation],
      ["What to Bring", initialData?.whatToBring],
      ["Good to Know", initialData?.importantDetails],
    ].filter((row): row is [string, string] => Boolean(row[1])),
    [initialData]
  );

  if (!initialData || (details.length === 0 && initialData.updates.length === 0)) return null;

  return (
    <section className="mx-auto max-w-prose px-6 pb-16">
      <div className="border-t border-sage/25 pt-10">
        <p className="font-body text-[0.66rem] font-bold uppercase tracking-[0.2em] text-forest/50">
          Your gathering
        </p>
        <div className="mt-2 h-0.5 w-10 bg-gold" aria-hidden />
        <h2 className="mt-4 font-display text-2xl text-forest">Everything to know for {gatheringName}</h2>
        <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/65">
          Come back here for the details that matter, what changed, and anything your host needs you to confirm.
        </p>
      </div>

      {initialData.updates.length > 0 && (
        <div className="mt-8">
          <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/60">
            Latest updates
          </h3>
          <div className="mt-3 space-y-3">
            {initialData.updates.map((item) => (
              <UpdateCard key={item.id} token={token} item={item} archived={initialData.isArchived} />
            ))}
          </div>
        </div>
      )}

      {details.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-sage/25 bg-offwhite px-5 py-4">
              <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.16em] text-forest/50">
                {label}
              </p>
              <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-forest/75">
                {value}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
