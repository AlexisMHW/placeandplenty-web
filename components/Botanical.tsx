// PLACE & PLENTY BOTANICALS
//
// Foliage is soft editorial punctuation, not a branch graphic and not a
// repeating pattern. These drawings intentionally use overlapping leaves,
// curved stems, imperfect spacing and mixed scale so they read more like
// clipped greenery from a real table than diagrammatic SVG branches.
//
// Keep usage restrained. Photography carries the emotional weight; foliage
// gives the cream/forest system a natural signature between those moments.

const LEAF = "M0 0C8-7 22-7 31 0C22 8 8 9 0 0Z";

function Leaf({
  x,
  y,
  rotate,
  scale = 1,
  opacity = 0.72,
}: {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
  opacity?: number;
}) {
  return (
    <path
      d={LEAF}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
      fill="currentColor"
      opacity={opacity}
    />
  );
}

function NaturalSprig() {
  return (
    <g>
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        opacity="0.5"
      >
        <path d="M11 58C19 49 24 39 29 28C34 17 40 10 49 6" strokeWidth="1.25" />
        <path d="M27 33C21 29 16 25 11 19" strokeWidth="0.9" />
        <path d="M34 22C41 21 48 18 54 13" strokeWidth="0.9" />
      </g>
      <g>
        <Leaf x={12} y={47} rotate={-34} scale={0.48} />
        <Leaf x={22} y={45} rotate={152} scale={0.42} opacity={0.6} />
        <Leaf x={22} y={35} rotate={-38} scale={0.46} />
        <Leaf x={30} y={32} rotate={145} scale={0.38} opacity={0.62} />
        <Leaf x={31} y={23} rotate={-42} scale={0.4} />
        <Leaf x={39} y={20} rotate={140} scale={0.34} opacity={0.58} />
        <Leaf x={41} y={12} rotate={-30} scale={0.34} />
        <Leaf x={8} y={18} rotate={-118} scale={0.29} opacity={0.58} />
        <Leaf x={49} y={12} rotate={-12} scale={0.27} opacity={0.55} />
      </g>
      <g fill="currentColor" opacity="0.34">
        <circle cx="27" cy="39" r="1.7" />
        <circle cx="34" cy="27" r="1.45" />
      </g>
    </g>
  );
}

export function BotanicalSprig({
  className = "",
  size = 56,
  flip = false,
}: {
  className?: string;
  size?: number;
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
      <NaturalSprig />
    </svg>
  );
}

export function BotanicalDivider({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const line = tone === "dark" ? "text-offwhite/20" : "text-sage/35";
  const mark = tone === "dark" ? "text-gold" : "text-olive";

  return (
    <div aria-hidden className={`flex items-center justify-center gap-4 ${className}`}>
      <span className={`h-px w-full max-w-[7rem] bg-current ${line}`} />
      <svg focusable="false" viewBox="0 0 54 22" width={54} height={22} className={`flex-shrink-0 ${mark}`}>
        <path d="M6 17C18 14 28 9 47 5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.45" />
        <Leaf x={12} y={14} rotate={-25} scale={0.25} opacity={0.72} />
        <Leaf x={23} y={11} rotate={150} scale={0.23} opacity={0.58} />
        <Leaf x={31} y={8} rotate={-28} scale={0.22} opacity={0.68} />
        <Leaf x={41} y={5} rotate={145} scale={0.19} opacity={0.55} />
      </svg>
      <span className={`h-px w-full max-w-[7rem] bg-current ${line}`} />
    </div>
  );
}

/**
 * A loose foliage spray for large editorial corners. Kept under the legacy
 * BotanicalBough export so existing callers do not need churn, but it is no
 * longer a long exposed branch. Most of the silhouette is leaf mass with
 * only short curved stem glimpses between clusters.
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
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 220 360"
      width={width}
      height={(width * 360) / 220}
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" opacity="0.32">
        <path d="M24 348C55 286 72 228 104 178C131 136 161 99 199 63" strokeWidth="2" />
        <path d="M74 246C52 229 38 209 28 184" strokeWidth="1.25" />
        <path d="M108 174C139 164 164 148 186 127" strokeWidth="1.25" />
        <path d="M50 296C76 292 98 281 118 265" strokeWidth="1.15" />
      </g>

      <g>
        <Leaf x={24} y={319} rotate={-48} scale={1.45} opacity={0.48} />
        <Leaf x={49} y={304} rotate={137} scale={1.2} opacity={0.4} />
        <Leaf x={52} y={267} rotate={-43} scale={1.55} opacity={0.52} />
        <Leaf x={76} y={250} rotate={140} scale={1.24} opacity={0.42} />
        <Leaf x={78} y={215} rotate={-39} scale={1.48} opacity={0.53} />
        <Leaf x={104} y={194} rotate={143} scale={1.18} opacity={0.4} />
        <Leaf x={111} y={160} rotate={-42} scale={1.35} opacity={0.5} />
        <Leaf x={137} y={141} rotate={145} scale={1.08} opacity={0.38} />
        <Leaf x={146} y={111} rotate={-36} scale={1.18} opacity={0.46} />
        <Leaf x={171} y={93} rotate={148} scale={0.95} opacity={0.36} />
        <Leaf x={181} y={62} rotate={-34} scale={0.9} opacity={0.45} />

        <Leaf x={28} y={187} rotate={-115} scale={1.04} opacity={0.36} />
        <Leaf x={45} y={208} rotate={63} scale={1.2} opacity={0.44} />
        <Leaf x={115} y={260} rotate={-8} scale={1.08} opacity={0.38} />
        <Leaf x={86} y={277} rotate={166} scale={0.98} opacity={0.34} />
        <Leaf x={174} y={128} rotate={-6} scale={1.02} opacity={0.4} />
        <Leaf x={150} y={149} rotate={172} scale={0.88} opacity={0.34} />
      </g>

      <g fill="currentColor" opacity="0.22">
        <circle cx="61" cy="280" r="5" />
        <circle cx="91" cy="216" r="4.5" />
        <circle cx="130" cy="151" r="4" />
      </g>
    </svg>
  );
}

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
      <g opacity="0.14">
        <NaturalSprig />
      </g>
    </svg>
  );
}
