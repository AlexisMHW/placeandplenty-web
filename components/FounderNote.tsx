import Link from "next/link";
import Image from "next/image";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import { FOUNDER_PHOTO } from "@/lib/founder";

// The founder band, composed to the reference: photograph running full
// height on the left, copy on cream at the right, a large botanical
// sprig in the right margin.
//
// §16 asks for restraint — one strong About image, an optional smaller
// homepage teaser, no résumé, no repetition. This is that teaser. It
// stays short: a greeting, one italic line, one paragraph, one close.
// The story itself lives on /about and is not duplicated here.
//
// FIRST PERSON, as §16 requires and as the reference writes it. "Hi, I'm
// Alexis" is the founder speaking, not a profile written about her — the
// same perspective error that had to be corrected on /about.
//
// The photograph is the approved warm at-home founder photo, defined
// once in lib/founder.ts so About and this share alt text and neither
// can drift to stock.

export default function FounderNote() {
  return (
    <Band tone="cream">
      <BotanicalSprig
        className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 text-olive/35 lg:block"
        size={230}
      />

      <div className="relative grid items-stretch gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative min-h-[20rem] lg:min-h-[26rem]">
          <Image
            src={FOUNDER_PHOTO.src}
            alt={FOUNDER_PHOTO.alt}
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover object-top"
          />
        </div>

        <div className="px-6 py-14 md:px-12 md:py-16 lg:pr-24">
          <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-forest/70">
            Founder &amp; host
          </p>

          <Display className="mt-4 text-3xl leading-tight text-forest md:text-4xl">
            Hi, I&rsquo;m Alexis.
          </Display>

          <p className="mt-4 font-display text-xl italic leading-snug text-forest/85">
            I built Place &amp; Plenty for hosts like you.
          </p>

          <p className="mt-5 max-w-prose font-body text-base leading-relaxed text-forest/80">
            I looked at a calendar full of birthdays, holidays and family
            gatherings and realised how much of it landed on me. I
            didn&rsquo;t need another place to make a pretty invitation — I
            needed one place to manage everything between &ldquo;people are
            coming&rdquo; and the doorbell ringing. So I built it.
          </p>

          <p className="mt-5 font-display text-lg italic leading-snug text-forest">
            Less scrambling. More gathering.
          </p>

          <Link
            href="/about"
            className="mt-7 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            Read my story
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>
    </Band>
  );
}
