// THE CIRCULAR STAMP — the reference's recurring seal.
//
// It appears three times across the approved pages and always does the
// same job: a small round mark laid over the corner of a hero
// photograph, carrying two short phrases around its ring with a sprig at
// the centre. Gathering Ideas reads HOME HOSTING / MADE SIMPLE in gold
// on cream; Show Us How You Gather reads OUR COMMUNITY / OUR INSPIRATION
// in forest.
//
// It is a seal, not a badge: no drop shadow, no gradient, no gloss. The
// weight comes from the ring rule and the letterspacing.
//
// TEXT ON A PATH, drawn twice on opposite arcs so both phrases read
// left-to-right — the top phrase runs along the outside of the upper arc
// and the bottom phrase along the inside of the lower one. Setting both
// on a single circle would leave the bottom one upside down, which is
// the mistake this markup exists to avoid.
//
// aria-hidden: it repeats language already on the page, and a screen
// reader announcing "HOME HOSTING MADE SIMPLE" a second time next to the
// heading that says it is noise rather than information.

export default function Stamp({
  top,
  bottom,
  tone = "light",
  size = 130,
  className = "",
}: {
  top: string;
  bottom: string;
  /** "dark" is the forest-filled seal; "light" is cream with gold ink. */
  tone?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  const dark = tone === "dark";
  const fill = dark ? "#1F3D2E" : "#F6F2E7";
  const ink = dark ? "#F6F2E7" : "#745C1C";
  const rule = dark ? "#C8A34A" : "#C8A34A";

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        {/* Upper arc, left to right over the top. */}
        <path
          id="stamp-arc-top"
          d="M 26,100 A 74,74 0 0 1 174,100"
          fill="none"
        />
        {/* Lower arc, also left to right, so the text sits upright. */}
        <path
          id="stamp-arc-bottom"
          d="M 30,100 A 70,70 0 0 0 170,100"
          fill="none"
        />
      </defs>

      <circle cx="100" cy="100" r="96" fill={fill} opacity={dark ? 1 : 0.94} />
      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke={rule}
        strokeWidth="1.2"
        opacity="0.8"
      />
      <circle
        cx="100"
        cy="100"
        r="62"
        fill="none"
        stroke={rule}
        strokeWidth="0.8"
        opacity="0.45"
      />

      <text
        fill={ink}
        fontSize="13"
        letterSpacing="3.4"
        fontFamily="var(--font-lato), system-ui, sans-serif"
        fontWeight="700"
      >
        <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">
          {top.toUpperCase()}
        </textPath>
      </text>

      <text
        fill={ink}
        fontSize="13"
        letterSpacing="3.4"
        fontFamily="var(--font-lato), system-ui, sans-serif"
        fontWeight="700"
      >
        <textPath href="#stamp-arc-bottom" startOffset="50%" textAnchor="middle">
          {bottom.toUpperCase()}
        </textPath>
      </text>

      {/* The sprig at the centre — the same olive linework as everywhere else. */}
      <g
        transform="translate(100 100) scale(1.5) translate(-32 -32)"
        fill={ink}
        stroke={ink}
        opacity="0.85"
      >
        <path
          d="M6 58C16 46 24 32 31 14"
          fill="none"
          stroke={ink}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <g fill={ink} stroke="none" opacity="0.8">
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(14,46) rotate(-28) scale(0.95)"
          />
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(17,44) rotate(150) scale(0.8)"
          />
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(21,35) rotate(-34) scale(0.85)"
          />
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(24,33) rotate(146) scale(0.7)"
          />
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(27,23) rotate(-40) scale(0.7)"
          />
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(30,21) rotate(140) scale(0.58)"
          />
          <path
            d="M-10 0Q-2-4.2 10 0Q-2 4.2-10 0Z"
            transform="translate(32,11) rotate(-52) scale(0.5)"
          />
        </g>
      </g>
    </svg>
  );
}
