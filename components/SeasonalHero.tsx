import Image from "next/image";
import Link from "next/link";
import CtaButton from "@/components/CtaButton";
import { Display, Ornament } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import type { Homepage } from "@/lib/tina-content";
import { TAGLINE, PROMISE } from "@/lib/brand";
import homepageHero from "../homepage/hero-fall-gathering.png.png";

const FALLBACK = {
  eyebrow: "For the gatherers and the planners",
  imageAlt:
    "A warm candlelit fall gathering table in a real home, set for people to arrive.",
};

export default function SeasonalHero({ content }: { content: Homepage }) {
  const headline = content.heroHeadline || TAGLINE;
  const subhead = content.heroSubhead || PROMISE;
  const imageAlt = content.heroImageAlt || FALLBACK.imageAlt;

  return (
    <section className="relative isolate overflow-hidden bg-forest">
      <Image
        src={homepageHero}
        alt={imageAlt}
        fill
        sizes="100vw"
        priority
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-forest/42" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-forest/95 via-forest/72 to-forest/10"
      />

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

          <p className="mt-8 max-w-prose font-body text-lg leading-relaxed text-offwhite/90 sm:text-xl">
            {subhead}
          </p>

          {content.heroBody && (
            <p className="mt-4 max-w-prose font-body text-base leading-relaxed text-offwhite/75">
              {content.heroBody}
            </p>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaButton
              onDark
              labelOverride={content.ctaLabelOverride || "Start Hosting Free"}
            />
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-offwhite/70 px-7 py-3.5 font-body text-base font-semibold text-offwhite transition-colors duration-400 hover:bg-offwhite/10"
            >
              See How It Works
            </Link>
          </div>

          <p className="mt-4 font-body text-xs leading-relaxed text-offwhite/65">
            Plan on the web now. Use the same account in the app when you want it there.
          </p>
        </div>
      </div>
    </section>
  );
}
