import Image from "next/image";
import { BotanicalCorner, BotanicalSprig } from "@/components/Botanical";

// EVERY PHOTOGRAPHIC SLOT ON THE SITE GOES THROUGH HERE.
//
// THE PROBLEM THIS SOLVES, stated plainly. The approved references are
// photography-led: the home page has five photographic moments, What It
// Does has twelve, Gathering Ideas has ten. The repository has two real
// photographs — one tabletop and the founder. Directive §19 anticipates
// exactly this and says what to do about it: preserve the visual
// architecture, do not silently fall back to empty cream cards, and hand
// the founder an exact list of what is missing and where it goes.
//
// So this component is the architecture. Give it a `src` and it renders
// the photograph. Give it none and it renders a DESIGNED PLATE — a
// tonal ground with botanical linework and, where the slot is large
// enough to carry it, the caption the photograph would have had. The
// layout, the aspect ratio and the spacing are identical either way, so
// dropping real photography in later moves nothing on the page.
//
// The plate is deliberately not a grey box, not a "coming soon", and not
// a stock photograph standing in for a real home. It reads as a brand
// surface, which is the honest thing for it to be: Place & Plenty has
// not photographed this gathering yet.
//
// THE PLATE IS EVERGREEN. Olive sprigs and the house palette, never
// autumn leaves or pumpkins — §3 keeps the identity in code and the
// season in content, so a fall-to-winter rotation never touches this.
//
// Every missing slot is enumerated in PHOTOGRAPHY-MANIFEST.md with the
// page, the intended subject and the aspect ratio, which is §19's third
// requirement.

export type PhotoTone = "forest" | "sage" | "cream";

const PLATES: Record<PhotoTone, { ground: string; mark: string }> = {
  forest: {
    ground: "bg-gradient-to-br from-forest via-forest to-sage",
    mark: "text-offwhite",
  },
  sage: {
    ground: "bg-gradient-to-br from-sage via-sage to-olive",
    mark: "text-offwhite",
  },
  cream: {
    ground: "bg-gradient-to-br from-cream via-parchment to-cream",
    mark: "text-olive",
  },
};

export default function Photo({
  src,
  alt,
  tone = "forest",
  caption,
  className = "",
  imageClassName = "",
  sizes = "100vw",
  priority = false,
  compact = false,
}: {
  src?: string | null;
  /** Required whenever `src` is set. The plate carries no information. */
  alt?: string | null;
  tone?: PhotoTone;
  /**
   * Shown on the plate only, never over a real photograph — it is the
   * subject the photograph is meant to be, not a caption for the page.
   */
  caption?: string;
  /** Sizing and aspect ratio belong to the caller; this fills its box. */
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  /**
   * For slots too narrow to carry words — the 38% sliver on a split
   * card, for instance. A caption set at 10px across nine characters is
   * not a caption, it is visual noise, so the plate falls back to
   * linework alone.
   */
  compact?: boolean;
}) {
  const plate = PLATES[tone];

  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt || ""}
          fill
          sizes={sizes}
          priority={priority}
          className={`object-cover ${imageClassName}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${plate.ground} ${className}`}
      role="presentation"
    >
      {/* A woven hairline field. The first version of this plate was a
          flat gradient with a small sprig on it, and at card size it read
          as an empty box rather than as a designed surface — which is the
          one thing §19 says a missing photograph must never look like.
          The lattice gives it texture at any size, and it is a repeating
          SVG pattern rather than an image so it costs nothing. */}
      <svg
        aria-hidden
        className={`absolute inset-0 h-full w-full ${plate.mark}`}
        style={{ opacity: 0.14 }}
      >
        <defs>
          <pattern
            id={`plate-${tone}`}
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path
              d="M0 17h34M17 0v34"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#plate-${tone})`} />
      </svg>

      <BotanicalCorner
        className={`-right-5 -top-5 ${plate.mark}`}
        size={140}
      />
      <BotanicalCorner
        className={`-bottom-7 -left-7 rotate-180 ${plate.mark}`}
        size={110}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
        <BotanicalSprig
          className={`${plate.mark} opacity-80`}
          size={compact ? 34 : 40}
        />
        {caption && !compact && (
          <p
            className={`max-w-[24ch] font-body text-[0.6rem] font-semibold uppercase leading-[1.7] tracking-[0.14em] ${plate.mark} opacity-75`}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * True when a slot has real photography. Pages use it to decide between
 * a photograph-led composition and one that leans on type — Gathering
 * Ideas' hero, for instance, should not reserve 60% of the screen for a
 * plate.
 */
export function hasPhoto(src?: string | null): boolean {
  return typeof src === "string" && src.trim().length > 0;
}
