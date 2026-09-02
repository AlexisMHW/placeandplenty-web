import Icon, { type IconName } from "@/components/Icon";

const VISUALS: Record<
  "contributions" | "space" | "photos",
  { icon: IconName; eyebrow: string; rows: Array<{ label: string; meta?: string }> }
> = {
  contributions: {
    icon: "gift",
    eyebrow: "Who’s Bringing What",
    rows: [
      { label: "Mac & cheese", meta: "Traci" },
      { label: "Ice + drinks", meta: "Marcus" },
      { label: "Dessert", meta: "Still open" },
    ],
  },
  space: {
    icon: "house",
    eyebrow: "Space Mode",
    rows: [
      { label: "Move the drink station", meta: "Clearer flow" },
      { label: "Open this corner", meta: "2 more seats" },
      { label: "Keep food off the entry path", meta: "Less crowding" },
    ],
  },
  photos: {
    icon: "photo",
    eyebrow: "My Gathering Photos",
    rows: [
      { label: "Guest uploads", meta: "18 photos" },
      { label: "Your favorites", meta: "6 saved" },
      { label: "Share the memories", meta: "One gathering" },
    ],
  },
};

/**
 * A small product illustration used only where a final photographic / screen
 * asset does not exist yet. It is intentionally a real composed visual, not a
 * "pending" placeholder, so no public page exposes build-state language.
 */
export default function FeatureMiniVisual({
  kind,
  number,
}: {
  kind: keyof typeof VISUALS;
  number: string;
}) {
  const visual = VISUALS[kind];

  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-cream px-4 py-4">
      <div aria-hidden className="absolute -right-9 -top-10 h-28 w-28 rounded-full bg-sage/25" />
      <div aria-hidden className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-gold/10" />

      <div className="relative mx-auto flex h-full max-w-[21rem] flex-col rounded-2xl border border-sage/25 bg-offwhite/95 p-4 shadow-softer">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-offwhite">
              <Icon name={visual.icon} size={15} />
            </span>
            <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.15em] text-forest/65">
              {visual.eyebrow}
            </p>
          </div>
          <span className="font-body text-[0.58rem] font-bold tracking-[0.16em] text-gold">
            {number} / 13
          </span>
        </div>

        <div className="mt-3 flex-1 divide-y divide-sage/20 rounded-xl border border-sage/20 bg-parchment/70 px-3">
          {visual.rows.map((row, index) => (
            <div key={row.label} className="flex items-center gap-3 py-2.5">
              <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${index === 2 ? "bg-gold/70" : "bg-sage"}`} />
              <span className="min-w-0 flex-1 truncate font-body text-[0.7rem] font-semibold text-forest">
                {row.label}
              </span>
              {row.meta && (
                <span className="flex-shrink-0 font-body text-[0.58rem] text-forest/55">
                  {row.meta}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
