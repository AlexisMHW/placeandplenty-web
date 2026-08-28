import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import CtaSection from "@/components/CtaSection";
import { FOUNDER_PHOTO } from "@/lib/founder";
import { ESSENCE, PROMISE, RALLY, TAGLINE } from "@/lib/brand";

// ABOUT — founder-led, warm, human (§17).
//
// The story below is the one in the master handoff, told in the founder's
// own frame: a calendar full of real family hosting, a need for one place
// to manage all of it, and the observation that what she needed did not
// exist. It ends where §17 says to end it — less scrambling, more
// gathering, the people, and Home Hosting. Made Simple.
//
// THE CALENDAR IS THE WHOLE ARGUMENT, so it is set as a list rather than
// buried in a paragraph. Granny's 80th and a first birthday landing in
// the same season is the thing a reader recognises; compressed into prose
// it reads as a list of occasions instead of as a year that is genuinely
// too much to hold in your head.
//
// WHAT THIS PAGE DELIBERATELY IS NOT (§17): no résumé, no corporate CEO
// bio, no credentials, no company milestones, no "our mission" block, and
// exactly ONE founder photograph. The founder story explains why Place &
// Plenty exists; Place & Plenty is still the brand.

export const metadata: Metadata = {
  title: "About",
  description:
    `Place & Plenty was built by someone who needed it — for a calendar full of birthdays, holidays and family hosting. ${TAGLINE}`,
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
  "Her son’s 17th",
  "Thanksgiving",
  "Christmas",
  "Her youngest son’s first birthday",
  "Her husband’s 40th",
  "Her own 39th",
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
              event-planning software. It started with a calendar.
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
              A few years ago I looked at what was coming and realised how
              much of it landed on me:
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
              I needed one place to manage all of it.
            </p>

            <p className="mt-5">
              I did not need another place to make a pretty invitation. The
              invitation was never the hard part. The hard part was
              everything between{" "}
              <em className="not-italic font-semibold text-forest">
                &ldquo;people are coming&rdquo;
              </em>{" "}
              and the doorbell ringing.
            </p>

            <p className="mt-5">
              So I built the thing I needed.
            </p>
          </div>

          <blockquote className="mt-12 border-l-2 border-gold pl-6">
            <p className="font-display text-2xl leading-snug text-forest md:text-3xl">
              {ESSENCE}
            </p>
          </blockquote>

          <div className="mt-12 font-body text-lg leading-relaxed text-forest/85">
            <p>
              Place &amp; Plenty is for the person who wants everyone to have
              a good time and would also like to enjoy it themselves. It
              isn&rsquo;t about hosting more impressively. It&rsquo;s about
              scrambling less, so that when people finally walk in you have
              something left to give them.
            </p>

            <p className="mt-5">
              The colours came from my own house. The photos are real tables.
              The features exist because I needed them on a Tuesday.
            </p>
          </div>

          <p className="mt-10 font-display text-2xl italic text-forest">
            {RALLY}
          </p>

          <p className="mt-8 font-display text-xl text-forest">
            xo, Alexis
          </p>
          <p className="mt-1 font-body text-xs uppercase tracking-[0.18em] text-forest/60">
            Founder, Place &amp; Plenty
          </p>
        </div>
      </section>

      <section className="bg-forest py-16 text-offwhite md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          <p className="font-display text-3xl md:text-4xl">
            {TAGLINE}
          </p>
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
