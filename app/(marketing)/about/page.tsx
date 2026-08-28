import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import CtaSection from "@/components/CtaSection";
import { FOUNDER_PHOTO } from "@/lib/founder";
import { ESSENCE, PROMISE, RALLY, TAGLINE } from "@/lib/brand";

// ABOUT — founder-led, personal, first person (§16).
//
// PERSPECTIVE WAS THE BUG. The previous version narrated the calendar in
// the third person — "Her son's 17th", "Her husband's 40th" — inside a
// page that was otherwise written as "I". §28 lists that perspective
// error explicitly. Every line below is first person, because this is
// the founder's own account and not a profile written about her.
//
// "A few years ago" is gone too. §16 says not to use a vague phrase that
// may misstate the actual origin timing, and nobody has told me when
// this started. The page now opens on the calendar itself, which needs
// no date to be true.
//
// THE KEY LINE (§16) is used verbatim and given its own weight:
//   "I didn't need another place to make a pretty invitation. I needed
//    something that could help me manage everything between 'people are
//    coming' and the doorbell ringing. So I built it."
//
// THE CALENDAR IS THE WHOLE ARGUMENT, so it is a list rather than prose.
// Granny's 80th and a first birthday landing in the same stretch is the
// thing a reader recognises; compressed into a sentence it reads as a
// list of occasions instead of a year that is genuinely too much to hold
// in your head.
//
// WHAT THIS PAGE IS NOT (§16, §32): no CEO biography, no résumé, no
// credentials, no company milestones, no stock photography, and exactly
// ONE founder photograph.

export const metadata: Metadata = {
  title: "About",
  description: `I built Place & Plenty because I needed it — for a calendar full of birthdays, holidays and family hosting. ${TAGLINE}`,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About | Place & Plenty",
    description:
      "Built from real life, not from a desire to make event-planning software.",
    url: "/about",
    images: [FOUNDER_PHOTO.src],
  },
};

const calendar = [
  "Granny’s 80th birthday",
  "My son’s 17th",
  "Thanksgiving",
  "Christmas",
  "My youngest son’s first birthday",
  "My husband’s 40th",
  "My own 39th",
  "Valentine’s Day",
  "And the ordinary rhythm of a family that has people over",
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-parchment py-16 md:py-20">
        <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14">
          <div>
            <Eyebrow>About / Founder</Eyebrow>
            <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
              Why I created Place &amp; Plenty
            </h1>
            <p className="mt-5 font-body text-lg leading-relaxed text-forest/80">
              Place &amp; Plenty didn&rsquo;t start with a desire to build
              event-planning software. It started with my own calendar.
            </p>
          </div>

          <div>
            <div className="overflow-hidden rounded-card border border-sage/30 shadow-soft">
              <Image
                src={FOUNDER_PHOTO.src}
                alt={FOUNDER_PHOTO.alt}
                width={FOUNDER_PHOTO.width}
                height={FOUNDER_PHOTO.height}
                sizes="(min-width: 768px) 45vw, 100vw"
                priority
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-offwhite py-16 md:py-20">
        <div className="mx-auto max-w-prose px-6">
          <div className="font-body text-lg leading-relaxed text-forest/85">
            <p>
              I looked at what was coming and realised how much of it landed
              on me:
            </p>

            <ul className="mt-6 space-y-2 border-l-2 border-gold pl-5">
              {calendar.map((item) => (
                <li key={item} className="text-forest/85">
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-8">
              Every one of those is a good thing. Together they&rsquo;re a
              year of menus, shopping, guest lists, invitations, who&rsquo;s
              bringing what, what I already owned and couldn&rsquo;t find,
              how the room would work, whether it would rain, and the
              hundred small things that have to happen before anyone knocks.
            </p>

            <p className="mt-5">
              I needed one place to manage all of it. I went looking for
              that, and what I kept finding was invitations.
            </p>
          </div>

          {/* §16's key founder line, verbatim. */}
          <blockquote className="mt-12 border-l-2 border-gold pl-6">
            <p className="font-display text-2xl leading-snug text-forest md:text-3xl">
              I didn&rsquo;t need another place to make a pretty invitation.
              I needed something that could help me manage everything
              between &ldquo;people are coming&rdquo; and the doorbell
              ringing. So I built it.
            </p>
          </blockquote>

          <div className="mt-12 font-body text-lg leading-relaxed text-forest/85">
            <p>
              That&rsquo;s still the whole idea. The invitation was never the
              hard part — and if you&rsquo;ve already made yours somewhere
              else, bring it over. Place &amp; Plenty starts where the actual
              work starts.
            </p>

            <p className="mt-5">
              I built it for the person who wants everyone to have a good
              time and would also like to enjoy it herself. It isn&rsquo;t
              about hosting more impressively. It&rsquo;s about scrambling
              less, so that when people finally walk in I have something left
              to give them.
            </p>

            <p className="mt-5">
              The colours came from my own house. The photos are real tables.
              The features exist because I needed them on a Tuesday.
            </p>
          </div>

          <p className="mt-12 font-display text-2xl italic leading-snug text-forest">
            {ESSENCE}
          </p>

          <p className="mt-10 font-display text-2xl italic text-forest">
            {RALLY}
          </p>

          <p className="mt-8 font-display text-xl text-forest">xo, Alexis</p>
          <p className="mt-1 font-body text-xs uppercase tracking-[0.18em] text-forest/60">
            Founder, Place &amp; Plenty
          </p>
        </div>
      </section>

      <section className="bg-forest py-16 text-offwhite md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          <p className="font-display text-3xl md:text-4xl">{TAGLINE}</p>
          <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
            {PROMISE}
          </p>
          <div className="mt-8 flex flex-wrap gap-4 font-body text-sm">
            <Link
              href="/what-it-does"
              className="border-b border-gold pb-0.5 font-semibold uppercase tracking-[0.12em] transition-colors duration-400 hover:text-gold"
            >
              See what it does &rarr;
            </Link>
            <Link
              href="/gathering-ideas"
              className="border-b border-gold pb-0.5 font-semibold uppercase tracking-[0.12em] transition-colors duration-400 hover:text-gold"
            >
              Find a reason to gather &rarr;
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
