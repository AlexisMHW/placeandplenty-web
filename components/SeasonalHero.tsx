import Image from "next/image";
import CtaButton from "@/components/CtaButton";
import type { Homepage } from "@/lib/tina-content";
import { TAGLINE } from "@/lib/brand";

// THE HOMEPAGE HERO. Directive §12: the homepage is built around
// "Reasons people are hosting right now", and §35 settles that this is
// not reopened. So the largest words on the page are that question's
// answer, not a product tagline and not a feature.
//
// Photographic and full-bleed by intent (§9, §32): a visitor should think
// "this understands what it takes to get ready for people", not "this is
// another task-management dashboard". The product screenshot that used to
// sit here has moved down the page, into context.
//
// EVERY WORD AND THE PHOTOGRAPH ARE TINA FIELDS (§13, §24). A seasonal
// swap — fall to holiday to January — is content, not a redesign, and the
// founder makes it without Claude Code. The fallbacks below are the
// approved fall/launch copy, so the page is never blank if a field is
// cleared, but they are a floor rather than the source of truth.
//
// CONTRAST. The headline sits on a photograph, so legibility cannot be
// left to whichever image is uploaded next. A forest scrim runs under the
// text at 80–92% and the type is offwhite, which stays past AA over
// anything, including a bright one. That is why the overlay is a fixed
// part of the component and not a per-image setting.

const FALLBACK = {
  reasonLine:
    "Football is on. Birthdays are happening. The weather is finally tolerable. People are coming over.",
  headline: "Reasons people are hosting right now.",
  subhead: "People are coming. We'll help you get ready.",
  image: "/images/hero-tabletop.jpg",
  imageAlt:
    "A table set for dinner at home — green and gold plates, blush napkins, greenery down the middle.",
};

export default function SeasonalHero({ content }: { content: Homepage }) {
  const headline = content.heroHeadline || FALLBACK.headline;
  const reasonLine = content.reasonLine || FALLBACK.reasonLine;
  const subhead = content.heroSubhead || FALLBACK.subhead;
  const image = content.heroImage || FALLBACK.image;
  const imageAlt = content.heroImage
    ? content.heroImageAlt || ""
    : FALLBACK.imageAlt;

  return (
    <section className="relative isolate overflow-hidden bg-forest">
      <Image
        src={image}
        alt={imageAlt}
        fill
        sizes="100vw"
        priority
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-forest/92 via-forest/80 to-forest/45"
      />

      <div className="relative mx-auto max-w-editorial px-6 py-24 md:py-36">
        <div className="max-w-2xl">
          <p className="font-body text-xs font-bold uppercase tracking-[0.25em] text-offwhite/75">
            {TAGLINE}
          </p>

          <h1 className="mt-5 font-display text-4xl leading-[1.08] text-offwhite sm:text-5xl md:text-6xl">
            {headline}
          </h1>

          <span aria-hidden className="mt-7 block h-px w-16 bg-gold" />

          {/* The seasonal line is the part that changes most often, so it
              is given its own weight rather than buried in a paragraph. */}
          <p className="mt-7 font-display text-xl leading-relaxed text-offwhite/95 sm:text-2xl">
            {reasonLine}
          </p>

          <p className="mt-5 max-w-prose font-body text-base leading-relaxed text-offwhite/80 sm:text-lg">
            {subhead}
          </p>

          {content.heroBody && (
            <p className="mt-3 max-w-prose font-body text-base leading-relaxed text-offwhite/70">
              {content.heroBody}
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <CtaButton onDark labelOverride={content.ctaLabelOverride} />
          </div>
        </div>
      </div>
    </section>
  );
}
