import Link from "next/link";
import Image from "next/image";
import { Band } from "@/components/Display";
import { BotanicalBough } from "@/components/Botanical";
import { FOUNDER_PHOTO } from "@/lib/founder";

// THE FOUNDER BAND. The photograph on the left carries the founder identity,
// and the copy on the right carries the first-person story. The approved
// retouched founder image already includes the Life with Lexi identity, so
// no second seal is layered over it here.
//
// FIRST PERSON, ALWAYS. §16 of the reconciliation is explicit, and the
// page had this wrong before: a founder page written about the founder
// reads as a company describing an employee. "I built Place & Plenty" is
// the whole difference.
//
// ONE PHOTOGRAPH, USED TWICE AT MOST. §16 asks for restraint: a strong
// About image and an optional smaller teaser elsewhere. Both read from
// lib/founder.ts so the alt text cannot drift and a third use is a
// deliberate act rather than a copy-paste.

export default function FounderBand({
  eyebrow = "Hi, I’m Alexis",
  headline = "I built Place & Plenty to help you host with more ease and less stress.",
  body = "Because the preparation serves the people. The people are the point.",
  linkLabel = "More about my why",
  href = "/about",
  tone = "plain",
}: {
  eyebrow?: string;
  headline?: string;
  body?: string;
  linkLabel?: string;
  href?: string;
  tone?: "plain" | "cream" | "forest";
}) {
  const dark = tone === "forest";

  return (
    <Band tone={tone}>
      <div className="relative">
        <BotanicalBough
          className={`pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 lg:block ${
            dark ? "text-gold/25" : "text-olive/35"
          }`}
          width={210}
          flip
        />

        <div className="relative mx-auto grid max-w-editorial items-center gap-10 px-6 py-14 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] md:gap-14 md:py-16">
          <div className="relative mx-auto w-full max-w-sm md:mx-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
              <Image
                src={FOUNDER_PHOTO.src}
                alt={FOUNDER_PHOTO.alt}
                fill
                sizes="(min-width: 768px) 30vw, 90vw"
                className="object-cover object-top"
              />
            </div>
          </div>

          <div>
            <p
              className={`font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] ${
                dark ? "text-offwhite/70" : "text-forest/65"
              }`}
            >
              {eyebrow}
            </p>

            <h2
              className={`mt-4 max-w-xl font-display text-2xl leading-snug md:text-[2rem] ${
                dark ? "text-offwhite" : "text-forest"
              }`}
            >
              {headline}
            </h2>

            <span aria-hidden className="mt-6 block h-[2px] w-14 bg-gold" />

            <p
              className={`mt-5 max-w-prose font-body text-base leading-relaxed ${
                dark ? "text-offwhite/80" : "text-forest/75"
              }`}
            >
              {body}
            </p>

            <Link
              href={href}
              className={`mt-6 inline-block font-body text-sm font-semibold underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 ${
                dark
                  ? "text-offwhite hover:text-gold"
                  : "text-forest hover:text-sage"
              }`}
            >
              {linkLabel} <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </Band>
  );
}
