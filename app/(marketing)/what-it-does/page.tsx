import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import FounderBand from "@/components/FounderBand";
import GuestManagementSection from "@/components/GuestManagementSection";
import { Band, Display } from "@/components/Display";
import { SplitCard } from "@/components/Cards";
import Icon from "@/components/Icon";
import { HOSTING_HUB, SYSTEM_CAPABILITIES } from "@/lib/features";
import { CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";

// WHAT IT DOES, composed to `What_it_does.png`.
//
//   PageHero        split opening, phone in the photograph
//   THE TOOLS       the twelve-card Hub as a 4-across grid of split cards
//   AROUND THE HUB  the four system capabilities, presented separately
//   GuestManagement the guest-management advantage band, in full
//   FounderBand
//   CtaBand
//
// THE CARD COMPOSITION IS THE REFERENCE'S. Icon and copy on the left of
// each card, a photograph filling the right ~38%, cards on parchment
// with a hairline border and a soft lift, four across at desktop. That
// is copied closely because it is what makes twelve cards legible at a
// glance instead of reading as a wall.
//
// THE CARD CONTENT IS NOT THE REFERENCE'S, and this is the single most
// important correction on the page. The reference's twelve are: My
// Table, My People, My Shopping List, Who's Bringing What, My Hosting
// Closet, My Music & Media, My Style Board, My Invitations, My Co-Hosts,
// Host Mode, My Guest Book, And So Much More.
//
// §9 and §32 rule out four of those outright — My Invitations and My
// Guest Book are not Hub cards, "My Shopping List" is now My Shopping,
// and "And So Much More" is a filler tile standing where a real card
// belongs. The approved twelve are in lib/features.ts and six of them
// (Space Mode, Find Help, My Gathering Photos among them) do not appear
// in the reference at all.
//
// So: the reference's grid, the reconciliation's cards. §9's three
// groups are kept as row headings rather than flattened, because the
// grouping IS the architecture — food, people, the day — and a flat
// twelve is exactly the undifferentiated grid §12 warns against.

export const metadata: Metadata = {
  title: "What It Does",
  description:
    "The twelve places to put a gathering, plus the readiness score, the plan and the people who carry over. Everything Place & Plenty holds between “people are coming” and the doorbell.",
  alternates: { canonical: "/what-it-does" },
  openGraph: { url: "/what-it-does" },
};

export default function WhatItDoesPage() {
  return (
    <>
      <PageHero
        eyebrow="What It Does"
        headline="Everything you need."
        emphasisLine="All in one place."
        image={null}
        imageCaption="A host at home holding a phone showing her HostReady score, flowers and candles behind"
        body={
          <>
            <p>Place &amp; Plenty is your home hosting companion.</p>
            <p className="mt-3">
              From the first invitation to the last thank you, it holds the
              whole run-up in one place — the food, the people, the shopping,
              the space, and the question of whether you are actually ready.
            </p>
          </>
        }
        action={
          <Link
            href="#the-hub"
            className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Explore the Features
          </Link>
        }
      />

      {/* ---- the twelve-card Hub ------------------------------------- */}
      <Band tone="parchment" id="the-hub">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <Display
            emphasis="put-together"
            className="text-center text-3xl leading-tight text-forest md:text-[2.4rem]"
          >
            The tools behind a put-together get-together.
          </Display>
          <p className="mx-auto mt-4 max-w-2xl text-center font-body text-base leading-relaxed text-forest/70">
            Every gathering opens onto the same hub, grouped the way hosting
            actually splits up: the food, the people, and the day itself.
          </p>

          <div className="mt-14 space-y-12">
            {HOSTING_HUB.map((group) => (
              <section key={group.heading}>
                <h3 className="flex items-center gap-4 font-body text-[0.7rem] font-bold uppercase tracking-[0.22em] text-forest/65">
                  <span aria-hidden className="h-px w-8 flex-shrink-0 bg-gold" />
                  {group.heading}
                </h3>

                {/* THREE ACROSS, NOT FOUR. §9's groups are 3 / 3 / 6, and
                    a four-column grid left an empty cell at the end of the
                    first two rows — a hole where a card should be, which
                    reads as something missing rather than as a group that
                    happens to have three members. Three columns fills both
                    small groups exactly and wraps the third into 3 + 3. */}
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.features.map((f) => (
                    <li key={f.name}>
                      <SplitCard
                        icon={f.icon}
                        title={f.name}
                        body={f.body}
                        image={f.image}
                        photoCaption={f.photo}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </Band>

      {/* ---- what sits around the Hub -------------------------------- */}
      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">
                Around the hub
              </p>
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.2rem]">
                Four things that work
              </Display>
              <p className="font-display text-3xl italic leading-tight text-sage md:text-[2.2rem]">
                across every gathering.
              </p>
              <p className="mt-6 max-w-prose font-body text-base leading-relaxed text-forest/75">
                These are not cards inside a gathering. They sit above it — the
                plan that gets written for you, the score that tells you where
                you stand, the next thing to do, and the people who carry over
                from one gathering to the next.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {SYSTEM_CAPABILITIES.map((f) => (
                <li
                  key={f.name}
                  className="rounded-2xl border border-sage/25 bg-offwhite p-6"
                >
                  <Icon name={f.icon} size={26} className="text-forest/70" />
                  <h3 className="mt-4 font-display text-lg text-forest">
                    {f.name}
                  </h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      <GuestManagementSection />

      {/* ---- one account, wherever you use it ------------------------ */}
      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            <div className="flex gap-3 text-forest/70">
              <Icon name="laptop" size={40} />
              <Icon name="phone" size={40} />
            </div>
            <div>
              <h2 className="font-display text-2xl leading-snug text-forest md:text-[1.75rem]">
                All of it works in your browser, and all of it works on your
                phone.
              </h2>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-forest/75">
                {CROSS_PLATFORM_PROMISE}
              </p>
              <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-forest/65">
                Two things stay phone-first for a reason rather than an
                oversight: <strong className="font-semibold">Host Mode</strong>{" "}
                runs on gathering-day notifications while you are moving around
                the house, and{" "}
                <strong className="font-semibold">Space Mode</strong> starts
                with a camera pointed at a room. Everything else is here.
              </p>
            </div>
          </div>
        </div>
      </Band>

      <FounderBand tone="forest" />

      <CtaBand
        headline="Ready to host"
        emphasisLine="with more ease?"
        body="Start free in your browser. Add a Gathering Pass or Plus whenever you want more — on the web or in the app, it lands on the same account."
      />
    </>
  );
}
