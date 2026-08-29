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
 * THE BOUGH — the long, elegant branch that bleeds off the left edge of
 * every hero in the approved references.
 *
 * It is a different drawing from the sprig, not a scaled-up one, and it
 * has to be: a sprig enlarged to 400px reads as a clip-art leaf, because
 * its proportions were chosen to work at 44. The bough is drawn for that
 * size — a long arcing stem, three branchings, leaves that thin toward
 * every tip, and a few olives near the base. That is what the references
 * actually show and it is the single largest botanical moment on the
 * public site.
 *
 * Low contrast by construction. It sits behind headline type on the
 * hero's cream ground and must never compete with it; the opacity here
 * is part of the drawing rather than something a caller tunes.
 */
export function BotanicalBough({
  className = "",
  width = 280,
  flip = false,
}: {
  className?: string;
  width?: number;
  flip?: boolean;
}) {
  // Leaves are drawn against a 200-unit-wide viewBox, so the scale
  // numbers here are the difference between a branch and a few hairs.
  // The first version used the sprig's own scales (around 1.0-1.6) and
  // rendered as thin vertical wisps at 230px wide — visible in a
  // screenshot as stray marks rather than as foliage. These are roughly
  // three times that.
  const leaf = (x: number, y: number, rot: number, s: number, o = 0.6) => (
    <path
      key={`${x}-${y}-${rot}`}
      d={LEAF}
      transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}
      opacity={o}
    />
  );

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 200 420"
      width={width}
      height={(width * 420) / 200}
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      >
        {/* main stem, rising and arcing right */}
        <path d="M14 410C34 330 54 256 86 194 112 142 142 96 178 50" />
        {/* three branchings, each shorter than the last */}
        <path d="M62 272C86 246 116 230 152 222" />
        <path d="M96 176C116 152 144 136 176 128" />
        <path d="M40 340C60 322 84 312 112 308" />
      </g>

      <g fill="currentColor">
        {/* along the main stem — paired, alternating, thinning upward */}
        {leaf(26, 374, -32, 4.2)}
        {leaf(34, 366, 150, 3.6)}
        {leaf(44, 322, -36, 4.4)}
        {leaf(53, 314, 146, 3.7)}
        {leaf(66, 262, -40, 4.2)}
        {leaf(75, 254, 142, 3.5)}
        {leaf(92, 196, -44, 3.8)}
        {leaf(101, 188, 138, 3.1)}
        {leaf(120, 142, -48, 3.3)}
        {leaf(129, 134, 134, 2.7)}
        {leaf(150, 92, -52, 2.7)}
        {leaf(158, 84, 130, 2.2)}
        {leaf(174, 54, -56, 2.1)}

        {/* on the branchings — smaller, so the eye reads a hierarchy */}
        {leaf(84, 254, -12, 3.2, 0.5)}
        {leaf(110, 238, -8, 2.9, 0.5)}
        {leaf(138, 226, -4, 2.4, 0.5)}
        {leaf(114, 160, -16, 2.9, 0.5)}
        {leaf(140, 145, -10, 2.5, 0.5)}
        {leaf(166, 131, -6, 2.1, 0.5)}
        {leaf(62, 330, -14, 2.9, 0.48)}
        {leaf(88, 316, -8, 2.4, 0.48)}
      </g>

      {/* olives, only near the base where the drawing has weight to spare */}
      <g fill="currentColor" opacity="0.45">
        <circle cx="38" cy="350" r="7" />
        <circle cx="56" cy="300" r="6" />
        <circle cx="80" cy="242" r="5" />
      </g>
    </svg>
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
