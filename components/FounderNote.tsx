import Link from "next/link";
import Image from "next/image";
import Eyebrow from "@/components/Eyebrow";
import { FOUNDER_PHOTO } from "@/lib/founder";

// The homepage founder teaser. Directive §17 is explicit about restraint:
// ONE strong About image, an optional smaller homepage teaser, no résumé,
// no corporate CEO bio, no repetition. This is that optional teaser and
// it stays short — three sentences and a link. The story itself lives on
// /about and is not duplicated here.

export default function FounderNote() {
  return (
    <section className="bg-cream py-20 md:py-24">
      <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-14">
        <div className="order-2 md:order-1">
          <Eyebrow>About / Founder</Eyebrow>

          <h2 className="mt-5 font-display text-3xl leading-tight text-forest md:text-4xl">
            Why I created Place &amp; Plenty
          </h2>

          <p className="mt-5 font-body text-lg leading-relaxed text-forest/80">
            I was looking at a calendar full of birthdays, holidays, family
            gatherings and life — and I needed a better way to manage all of
            it.
          </p>

          <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">
            I didn&rsquo;t need another place to make a pretty invitation. So
            I built the thing I actually needed.
          </p>

          <p className="mt-6 font-display text-xl italic text-forest">
            xo, Alexis
          </p>

          <Link
            href="/about"
            className="mt-7 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            Read my story
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>

        <div className="order-1 md:order-2">
          <div className="overflow-hidden rounded-card border border-sage/30 shadow-soft">
            <Image
              src={FOUNDER_PHOTO.src}
              alt={FOUNDER_PHOTO.alt}
              width={FOUNDER_PHOTO.width}
              height={FOUNDER_PHOTO.height}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
