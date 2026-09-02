import type { ReactNode } from "react";
import Image from "next/image";
import Photo from "@/components/Photo";
import Stamp from "@/components/Stamp";
import { Display } from "@/components/Display";
import heroGathering from "../homepage/hero-fall-gathering.png.png";
import backyardDinner from "../homepage/gathering-backyard-dinner.png";
import peopleFirst from "../homepage/product-invitations.png";
import nightBefore from "../homepage/article-night-before-list.png";

function fallbackHeroFor(caption?: string): string {
  const subject = (caption ?? "").toLowerCase();
  if (subject.includes("phone") || subject.includes("photograph")) return peopleFirst.src;
  if (subject.includes("night") || subject.includes("editorial") || subject.includes("centre") || subject.includes("center")) return nightBefore.src;
  if (subject.includes("backyard") || subject.includes("greenery") || subject.includes("laid table")) return backyardDinner.src;
  return heroGathering.src;
}

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
  headline: string;
  emphasis?: string;
  emphasisLine?: string;
  body: ReactNode;
  image?: string | null;
  imageAlt?: string | null;
  imageCaption?: string;
  stamp?: { top: string; bottom: string; tone?: "light" | "dark" };
  action?: ReactNode;
  tone?: "parchment" | "cream";
  emphasisSize?: "match" | "small";
}) {
  const ground = tone === "cream" ? "bg-cream" : "bg-parchment";
  const resolvedImage = image || fallbackHeroFor(imageCaption);
  const resolvedAlt = imageAlt || imageCaption || "A warm Place & Plenty home gathering.";

  return (
    <section className={`relative isolate overflow-hidden ${ground}`}>
      <div className="relative lg:grid lg:min-h-[30rem] lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <div className="relative z-20 flex items-center">
          <Image
            src="/images/olive-mark.png"
            alt=""
            aria-hidden
            width={150}
            height={150}
            className="pointer-events-none absolute -left-4 bottom-5 hidden h-auto w-24 object-contain opacity-20 lg:block xl:w-28"
          />

          <div className="relative mx-auto w-full max-w-editorial px-6 py-14 lg:ml-auto lg:mr-0 lg:max-w-[34rem] lg:py-20 lg:pl-16 lg:pr-10">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">{eyebrow}</p>

            <Display as="h1" emphasis={emphasis} className="mt-5 text-4xl leading-[1.08] text-forest sm:text-5xl lg:text-[3.4rem]">{headline}</Display>

            {emphasisLine && (
              <p className={`mt-1 font-display italic leading-[1.15] text-sage ${emphasisSize === "small" ? "mt-3 text-2xl sm:text-3xl lg:text-[2rem]" : "text-4xl sm:text-5xl lg:text-[3.4rem]"}`}>{emphasisLine}</p>
            )}

            <span aria-hidden className="mt-7 block h-[2px] w-16 bg-gold" />
            <div className="mt-6 max-w-prose font-body text-base leading-relaxed text-forest/80 sm:text-[1.05rem]">{body}</div>
            {action && <div className="mt-8">{action}</div>}
          </div>
        </div>

        <div className="relative min-h-[16rem] lg:min-h-full">
          <Photo src={resolvedImage} alt={resolvedAlt} tone="sage" className="absolute inset-0 h-full w-full" sizes="(min-width: 1024px) 60vw, 100vw" priority />
          <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-40 bg-gradient-to-r lg:block ${tone === "cream" ? "from-cream via-cream/70 to-transparent" : "from-parchment via-parchment/70 to-transparent"}`} />
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b lg:hidden ${tone === "cream" ? "from-cream to-transparent" : "from-parchment to-transparent"}`} />
          {stamp && <Stamp top={stamp.top} bottom={stamp.bottom} tone={stamp.tone} size={128} className="absolute bottom-6 right-6 z-20 hidden drop-shadow-sm sm:block lg:bottom-10 lg:right-12" />}
        </div>
      </div>
    </section>
  );
}
