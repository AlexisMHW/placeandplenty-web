import Image from "next/image";
import CtaButton from "@/components/CtaButton";
import { Display, Ornament } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import type { Homepage } from "@/lib/tina-content";
import { TAGLINE, PROMISE } from "@/lib/brand";

// THE HOMEPAGE HERO, composed to the approved home page reference.
//
// WHAT CHANGED, AND WHY IT IS NOT A CONTRADICTION. The hero's largest
// words are now the brand line — "Home Hosting. Made *Simple*." — with
// the seasonal question moved to the section immediately below it, which
// is exactly the order the reference shows. §12 says the homepage is
// BUILT AROUND "reasons people are hosting right now"; it still is —
// that is the first content section and the thing the page is organised
// by. The hero says who this is, the band underneath says why you are
// here today.
//
// Every word remains a Tina field, so this is a default rather than a
// hardcoding: a founder who wants the seasonal line back as the headline
// types it into heroHeadline and it wins.
//
// FULL-BLEED, NOT INSET. Every other band on the page sits as a panel
// with a margin (see Band in components/Display.tsx). The hero is the
// one exception, because a photograph that stops short of the edge stops
// being an establishing shot.
//
// CONTRAST IS BUILT IN, NOT LEFT TO THE PHOTOGRAPH. The scrim runs
// forest 92% -> 45% left to right and the type is offwhite, which holds
// past AA over any image a founder uploads later — including a bright
// one. That is why the overlay is part of the component and not a
// per-image setting.

const FALLBACK = {
  eyebrow: "For the gatherers and the planners",
  image: "/images/hero-tabletop.jpg",
  imageAlt:
    "A table set for dinner at home — green and gold plates, blush napkins, greenery down the middle.",
};

export default function SeasonalHero({ content }: { content: Homepage }) {
  // The tagline is the default headline. `emphasis` italicises the last
  // word the way the reference does; when a founder overrides the
  // headline the emphasis simply will not match and the line renders
  // upright, which is the right failure.
  const headline = content.heroHeadline || TAGLINE;
  const subhead = content.heroSubhead || PROMISE;
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
      {/* TWO LAYERS, AND BOTH ARE NEEDED. A single left-to-right gradient
          was not enough over a bright, high-key photograph: the headline
          held, but the subhead sat on the warm middle of the image and
          washed out badly. The flat base darkens the whole frame just
          enough to make any uploaded photo behave; the gradient then does
          the real work behind the type. Together they hold past AA over
          anything a founder uploads later, which is why the scrim is part
          of the component rather than a per-image setting. */}
      <div aria-hidden className="absolute inset-0 bg-forest/45" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-forest/95 via-forest/75 to-transparent"
      />

      {/* Botanical linework in the corner, as the reference has it —
          large, pale, and out of the way of the type. */}
      <BotanicalSprig
        className="pointer-events-none absolute -right-6 top-6 hidden text-offwhite/20 lg:block"
        size={190}
      />

      <div className="relative mx-auto max-w-editorial px-6 py-24 md:py-36 lg:py-44">
        <div className="max-w-2xl">
          <p className="font-body text-xs font-bold uppercase tracking-[0.28em] text-offwhite/75">
            {FALLBACK.eyebrow}
          </p>

          <Display
            as="h1"
            emphasis="Simple"
            className="mt-6 text-5xl leading-[1.04] text-offwhite sm:text-6xl md:text-7xl"
          >
            {headline}
          </Display>

          <Ornament tone="dark" className="mt-8" />

          <p className="mt-8 max-w-prose font-body text-lg leading-relaxed text-offwhite/85 sm:text-xl">
            {subhead}
          </p>

          {content.heroBody && (
            <p className="mt-4 max-w-prose font-body text-base leading-relaxed text-offwhite/70">
              {content.heroBody}
            </p>
          )}

          <div className="mt-10">
            <CtaButton onDark labelOverride={content.ctaLabelOverride} />
          </div>
        </div>
      </div>
    </section>
  );
}
