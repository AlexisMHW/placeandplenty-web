// HostReady state, as a badge.
//
// The readiness_state enum is: ahead | on_track | needs_attention |
// at_risk | hostready. It is the app's own judgement, already computed
// and stored on the gathering — this renders it rather than recomputing
// anything, so web and app can never disagree about whether someone is
// on track.
//
// Colour is never the only signal (§24): every state also carries a
// word, so it works without colour perception and reads correctly to a
// screen reader.

const STATES: Record<
  string,
  { label: string; className: string }
> = {
  hostready: {
    label: "HostReady",
    className: "border-forest bg-forest text-offwhite",
  },
  ahead: {
    label: "Ahead",
    className: "border-sage/60 bg-sage/15 text-forest",
  },
  on_track: {
    label: "On track",
    className: "border-sage/50 bg-offwhite text-forest",
  },
  needs_attention: {
    label: "Needs attention",
    className: "border-goldInk/50 bg-gold/20 text-goldInk",
  },
  at_risk: {
    label: "At risk",
    className: "border-error/40 bg-error/10 text-error",
  },
};

export default function ReadinessBadge({
  state,
  score,
}: {
  state: string | null;
  score: number | null;
}) {
  if (!state) return null;
  const config = STATES[state];
  if (!config) return null;

  const rounded = score == null ? null : Math.round(score);

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-body text-xs font-semibold ${config.className}`}
    >
      {config.label}
      {rounded != null && (
        <span className="opacity-70">
          <span className="sr-only">, HostReady score </span>
          {rounded}%
        </span>
      )}
    </span>
  );
}
