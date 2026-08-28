// BOTANICAL LINEWORK — the evergreen brand texture.
//
// WHY THIS EXISTS. The approved visual system calls for botanical
// language "restrained and used as punctuation". The site shipped with
// none at all, which stripped out part of what makes it recognisably
// Place & Plenty and left eleven sections of cream/forest colour-blocking
// with nothing distinctive between them. That reads as competent generic
// SaaS, which is the exact failure the visual bar rules out.
//
// THE GOVERNING RELATIONSHIP, and the reason this is a component rather
// than decoration sprinkled inline:
//
//   Evergreen P&P identity  = the foundation. Palette, serif display
//                             type, tactile cards, warm photography,
//                             and THIS linework. Present all year.
//   Current season          = an overlay. Photography and content that
//                             rotate fall -> holiday -> spring.
//
// Swapping the season must never require touching the foundation. So
// nothing here is fall-specific: olive sprigs are the brand's own
// botanical, not a seasonal motif. No leaves-turning-orange, no pumpkins,
// no wheat. When the fall photography is replaced in Tina, every mark on
// this page still reads as Place & Plenty.
//
// USED SPARINGLY, AND THAT IS ENFORCED BY TASTE NOT BY CODE. The rule
// followed across the site: at most one botanical moment per screenful,
// only at transitions, card corners, empty states and closing CTAs.
// Never a repeating pattern, never a background wash, never on every
// section. If it starts reading as a garden, a spa, a wedding or a
// Thanksgiving template, there is too much of it.
//
// Inline SVG rather than the PNG mark, because these need to inherit
// `currentColor` to sit on forest and on cream alike, stay crisp at any
// size, and cost no request. public/images/olive-mark.png is still the
// right choice where a filled, full-colour mark is wanted (host empty
// states).
//
// All variants are aria-hidden. They carry no information.

/** A pointed almond leaf, centred on the origin, pointing +x. */
const LEAF = "M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z";

function Sprig() {
  return (
    <g>
      {/* stem */}
      <path
        d="M6 58C16 46 24 32 31 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* leaves, alternating down the stem and shrinking toward the tip */}
      <g fill="currentColor" opacity="0.75">
        <path d={LEAF} transform="translate(14,46) rotate(-28) scale(0.95)" />
        <path d={LEAF} transform="translate(17,44) rotate(150) scale(0.8)" />
        <path d={LEAF} transform="translate(21,35) rotate(-34) scale(0.85)" />
        <path d={LEAF} transform="translate(24,33) rotate(146) scale(0.7)" />
        <path d={LEAF} transform="translate(27,23) rotate(-40) scale(0.7)" />
        <path d={LEAF} transform="translate(30,21) rotate(140) scale(0.58)" />
        <path d={LEAF} transform="translate(32,11) rotate(-52) scale(0.5)" />
      </g>
      {/* fruit */}
      <g fill="currentColor" opacity="0.55">
        <circle cx="20" cy="41" r="1.9" />
        <circle cx="26" cy="29" r="1.6" />
      </g>
    </g>
  );
}

/**
 * A single sprig. For quiet corners and card accents.
 */
export function BotanicalSprig({
  className = "",
  size = 56,
  flip = false,
}: {
  className?: string;
  size?: number;
  /** Mirror it, so a pair can frame something without repeating. */
  flip?: boolean;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <Sprig />
    </svg>
  );
}

/**
 * A hairline rule with a small sprig at its centre. The section-
 * transition mark — this is the one that does most of the work, because
 * a transition is exactly where a page either has a voice or does not.
 */
export function BotanicalDivider({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const line = tone === "dark" ? "text-offwhite/25" : "text-sage/40";
  const mark = tone === "dark" ? "text-gold" : "text-olive";

  return (
    <div
      aria-hidden
      className={`flex items-center justify-center gap-4 ${className}`}
    >
      <span className={`h-px w-full max-w-[7rem] bg-current ${line}`} />
      <svg
        focusable="false"
        viewBox="0 0 48 20"
        width={48}
        height={20}
        className={`flex-shrink-0 ${mark}`}
      >
        {/* A small horizontal branch: stem with three paired leaves. */}
        <path
          d="M4 10h40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.5"
        />
        <g fill="currentColor" opacity="0.8">
          <path d={LEAF} transform="translate(17,10) rotate(-30) scale(0.5)" />
          <path d={LEAF} transform="translate(17,10) rotate(30) scale(0.5)" />
          <path d={LEAF} transform="translate(31,10) rotate(150) scale(0.5)" />
          <path d={LEAF} transform="translate(31,10) rotate(210) scale(0.5)" />
        </g>
        <circle cx="24" cy="10" r="2" fill="currentColor" opacity="0.6" />
      </svg>
      <span className={`h-px w-full max-w-[7rem] bg-current ${line}`} />
    </div>
  );
}

/**
 * A large, very low-contrast sprig for a card or panel corner. Texture
 * rather than ornament — it should be noticed second, not first.
 */
export function BotanicalCorner({
  className = "",
  size = 128,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`pointer-events-none absolute ${className}`}
    >
      <g opacity="0.16">
        <Sprig />
      </g>
    </svg>
  );
}
