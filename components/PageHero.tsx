import type { ReactNode } from "react";
import Photo from "@/components/Photo";
import Stamp from "@/components/Stamp";
import { Display } from "@/components/Display";
import { BotanicalBough } from "@/components/Botanical";

// THE SPLIT EDITORIAL HERO — the most repeated composition in the
// approved references, and the fastest way to make the site read as one
// system rather than eight pages.
//
// How It Works, What It Does, About, Pricing, Gathering Ideas, The
// Coordinated Host and Show Us How You Gather all open exactly the same
// way, and the anatomy is consistent enough to be worth stating:
//
//   left  ~40%  cream ground, a botanical bough bleeding off the left
//               edge, then eyebrow / serif headline with one italic
//               line / gold hairline rule / body / optional button
//   right ~60%  a photograph running to the top, right and bottom edges
//   seam        the photograph feathers into the cream rather than
//               butting against it
//   overlay     an optional circular stamp straddling the seam
//
// THE FEATHERED SEAM IS THE DETAIL THAT MATTERS. A hard vertical edge
// between a cream panel and a photograph reads as two components placed
// next to each other. The references dissolve it over about 12% of the
// width, which is what makes the hero read as one image with type in it.
// That is the gradient below, and it is on the cream side of the seam so
// it works over any photograph.
//
// MOBILE STACKS, CONTENT FIRST. The photograph becomes a band beneath
// the type rather than a background behind it, because a hero that puts
// 60% of a phone screen into an image pushes the page's only headline
// below the fold. §25 asks for intentional responsive behaviour, not a
// scaled-down desktop.
//
// THE HERO IS FULL-BLEED. Every other band on these pages is inset (see
// Band in Display.tsx); the hero is the exception, because a photograph
// that stops short of the edge stops being an establishing shot.

export default function PageHero({
  eyebrow,
  headline,
  emphasis,
  emphasisLine,
  body,
  image,
  imageAlt,
  imageCaption,
  stamp,
  action,
  tone = "parchment",
  emphasisSize = "match",
}: {
  eyebrow: string;
  /** The upright part of the headline. */
  headline: string;
  /** One word inside `headline` to italicise, the reference's signature move. */
  emphasis?: string;
  /** A whole line set in italic beneath the headline — About and Coordinated Host use this. */
  emphasisLine?: string;
  body: ReactNode;
  image?: string | null;
  imageAlt?: string | null;
  /** Subject of the photograph that belongs here, shown on the plate only. */
  imageCaption?: string;
  stamp?: { top: string; bottom: string; tone?: "light" | "dark" };
  action?: ReactNode;
  tone?: "parchment" | "cream";
  /**
   * Most references set the italic line at the same size as the headline
   * above it. The Coordinated Host is the exception — its masthead is a
   * title and the italic line beneath is a strapline, set noticeably
   * smaller. "small" is that case.
   */
  emphasisSize?: "match" | "small";
}) {
  const ground = tone === "cream" ? "bg-cream" : "bg-parchment";

  return (
    <section className={`relative isolate overflow-hidden ${ground}`}>
      <div className="relative lg:grid lg:min-h-[30rem] lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        {/* ---- type column ------------------------------------------- */}
        <div className="relative z-20 flex items-center">
          <BotanicalBough
            className="pointer-events-none absolute -left-16 top-1/2 hidden -translate-y-1/2 text-olive/45 lg:block"
            width={230}
          />

          <div className="relative mx-auto w-full max-w-editorial px-6 py-14 lg:ml-auto lg:mr-0 lg:max-w-[34rem] lg:py-20 lg:pl-16 lg:pr-10">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">
              {eyebrow}
            </p>

            <Display
              as="h1"
              emphasis={emphasis}
              className="mt-5 text-4xl leading-[1.08] text-forest sm:text-5xl lg:text-[3.4rem]"
            >
              {headline}
            </Display>

            {emphasisLine && (
              <p
                className={`mt-1 font-display italic leading-[1.15] text-sage ${
                  emphasisSize === "small"
                    ? "mt-3 text-2xl sm:text-3xl lg:text-[2rem]"
                    : "text-4xl sm:text-5xl lg:text-[3.4rem]"
                }`}
              >
                {emphasisLine}
              </p>
            )}

            <span
              aria-hidden
              className="mt-7 block h-[2px] w-16 bg-gold"
            />

            <div className="mt-6 max-w-prose font-body text-base leading-relaxed text-forest/80 sm:text-[1.05rem]">
              {body}
            </div>

            {action && <div className="mt-8">{action}</div>}
          </div>
        </div>

        {/* ---- photograph column ------------------------------------- */}
        <div className="relative min-h-[16rem] lg:min-h-full">
          <Photo
            src={image}
            alt={imageAlt}
            caption={imageCaption}
            tone="sage"
            className="absolute inset-0 h-full w-full"
            sizes="(min-width: 1024px) 60vw, 100vw"
            priority
          />

          {/* the feathered seam — cream dissolving into the photograph */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-40 bg-gradient-to-r lg:block ${
              tone === "cream"
                ? "from-cream via-cream/70 to-transparent"
                : "from-parchment via-parchment/70 to-transparent"
            }`}
          />
          {/* the same move on mobile, where the photograph sits below */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b lg:hidden ${
              tone === "cream"
                ? "from-cream to-transparent"
                : "from-parchment to-transparent"
            }`}
          />

          {stamp && (
            <Stamp
              top={stamp.top}
              bottom={stamp.bottom}
              tone={stamp.tone}
              size={128}
              className="absolute bottom-6 right-6 z-20 hidden drop-shadow-sm sm:block lg:bottom-10 lg:right-12"
            />
          )}
        </div>
      </div>
    </section>
  );
}
