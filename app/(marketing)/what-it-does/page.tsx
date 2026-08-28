import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Eyebrow from "@/components/Eyebrow";
import GuestManagementSection from "@/components/GuestManagementSection";
import ClosetSection from "@/components/ClosetSection";
import UseCaseSection from "@/components/UseCaseSection";
import PhilosophySection from "@/components/PhilosophySection";
import CtaSection from "@/components/CtaSection";
import { HOSTING_HUB, SYSTEM_CAPABILITIES } from "@/lib/features";

// WHAT IT DOES — the product architecture page.
//
// §9's first instruction is the one this page previously got wrong: "Do
// not mix Hosting Hub cards with account/system-level capabilities."
//
// So the page is now in two clearly separated parts. My Hosting Hub is
// twelve cards in three groups, exactly as §9 lists them. HostReady,
// Figure It Out, Next Up and My Guest Book appear under their own
// heading as things that sit AROUND the Hub — they span gatherings or
// live above them, and showing them as peers of My Table misdescribes
// how the product is actually organised.
//
// Names and grouping come from lib/features.ts. §32 forbids reintroducing
// My Invitations, Guest Communications or My Budget as standalone cards;
// the note in that file explains where each of them went.
//
// §32 also forbids letting guest management be buried in a feature grid,
// so GuestManagementSection appears here in full rather than as a link.

export const metadata: Metadata = {
  title: "What It Does",
  description:
    "My Table, My Shopping, My People, Who’s Bringing What, My Hosting Closet and more — the twelve-card Hosting Hub, plus HostReady, Figure It Out and My Guest Book.",
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
              place — the food, the people, the shopping, the space, the
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

      {/* THE HOSTING HUB — twelve cards, three groups, §9's order. */}
      <section className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>My Hosting Hub</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
            Twelve places to put a gathering.
          </h2>
          <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Every gathering opens onto the same hub, grouped the way
            hosting actually splits up: the food, the people, and the day
            itself.
          </p>

          <div className="mt-14 space-y-14">
            {HOSTING_HUB.map((group) => (
              <div key={group.heading}>
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
                  {group.heading}
                </h3>
                <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
                  {group.features.map((f) => (
                    <li key={f.name}>
                      <span
                        aria-hidden
                        className="mb-3 block h-px w-8 bg-gold"
                      />
                      <h4 className="font-display text-xl text-forest">
                        {f.name}
                      </h4>
                      <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                        {f.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AROUND THE HUB — deliberately a separate section, per §9. */}
      <section className="bg-cream py-20 md:py-24">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>Around the hub</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
            The things that work across all of it.
          </h2>
          <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            These aren&rsquo;t hub cards. They sit above a gathering, or
            across every gathering you&rsquo;ll ever have.
          </p>

          <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2">
            {SYSTEM_CAPABILITIES.map((f) => (
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

      <GuestManagementSection />
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
