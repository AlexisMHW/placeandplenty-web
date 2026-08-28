import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Eyebrow from "@/components/Eyebrow";
import UseCaseSection from "@/components/UseCaseSection";
import ClosetSection from "@/components/ClosetSection";
import PhilosophySection from "@/components/PhilosophySection";
import CtaSection from "@/components/CtaSection";
import { ALL_FEATURES } from "@/lib/features";

// WHAT IT DOES — the feature destination.
//
// Names come from lib/features.ts, which carries the constraint that
// matters here: every capability named on this page is one the app audit
// or the approved board actually confirms. §30 asks for a stale
// terminology sweep (My Address Book, My Shopping List, standalone My
// Budget) and §4 requires the site to match the current product, so this
// page must never be the place a plausible-sounding feature gets invented.
//
// It is also deliberately NOT a diagram of the 12-card Hosting Hub. The
// audit says the Hub is twelve cards but does not list all twelve, and a
// guessed list published here would be exactly the mismatch §4 warns
// about. See the note at the top of lib/features.ts.
//
// §32: the product screenshot sits inside the editorial, once, rather
// than opening a screenshot wall.

export const metadata: Metadata = {
  title: "What It Does",
  description:
    "Menus and serving counts, guest lists and RSVPs, shopping and budget, what you already own, and a readiness score that tells you when you're actually ready.",
  alternates: { canonical: "/what-it-does" },
  openGraph: {
    title: "What It Does | Place & Plenty",
    description:
      "Everything between “people are coming” and the doorbell ringing.",
    url: "/what-it-does",
  },
};

export default function WhatItDoesPage() {
  return (
    <>
      <section className="bg-parchment py-16 md:py-20">
        <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14">
          <div>
            <Eyebrow>What it does</Eyebrow>
            <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
              The part nobody sees, handled.
            </h1>
            <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
              Place &amp; Plenty holds the whole run-up to a gathering in one
              place — the food, the people, the shopping, the timing, the
              things you already own, and the question of whether
              you&rsquo;re ready.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[16rem]">
            <div className="overflow-hidden rounded-[2rem] border border-sage/40 shadow-soft">
              <Image
                src="/images/hero-app-screen.png"
                alt="The Place & Plenty app showing a gathering at 82% HostReady, with what's left to do."
                width={510}
                height={1080}
                sizes="(min-width: 768px) 16rem, 60vw"
                priority
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-editorial px-6">
          <h2 className="max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
            Everything it does
          </h2>

          <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_FEATURES.map((f) => (
              <li key={f.name}>
                <span aria-hidden className="mb-3 block h-px w-8 bg-gold" />
                <h3 className="font-display text-xl text-forest">{f.name}</h3>
                <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosetSection />
      <UseCaseSection />
      <PhilosophySection />

      <section className="bg-offwhite py-16 md:py-20">
        <div className="mx-auto max-w-prose px-6">
          <h2 className="font-display text-2xl text-forest md:text-3xl">
            And for your guests
          </h2>
          <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">
            Guests never need an account or the app. They open a link,
            respond, say what they&rsquo;re bringing, and get on with their
            day — and what they choose shows up on your side straight away.
          </p>
          <Link
            href="/how-it-works"
            className="mt-6 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            See how it works
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
