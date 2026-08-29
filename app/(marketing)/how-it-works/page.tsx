import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import FounderBand from "@/components/FounderBand";
import CtaBand from "@/components/CtaBand";
import GuestManagementSection from "@/components/GuestManagementSection";
import { Band, Display } from "@/components/Display";
import { SplitCard } from "@/components/Cards";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalDivider } from "@/components/Botanical";
import { PROMISE } from "@/lib/brand";

// HOW IT WORKS, composed to `how_it_works Page.png`.
//
// The reference's order, and what each band is for:
//
//   PageHero        the split editorial opening every page shares
//   THE PATH        five steps on a dashed line — the hosting journey
//   ALL IN ONE      the capability grid, copy left, six split cards right
//   GuestManagement §8's connected loop, in full
//   FounderBand     a person stands behind this
//   CtaBand         the close
//
// WHAT THE REFERENCE SHOWS THAT PRODUCT TRUTH OVERRIDES. Its grid says
// "My Shopping List", which §9 renamed to My Shopping, and it gives
// Guest Communications a card of its own, which §9 forbids as a
// standalone Hub card. Composition, pacing and weight come from the
// reference; names come from lib/features.ts and the reconciliation.
//
// WHY FIVE STEPS AND NOT THREE. §8 warns specifically against "generic
// Step 1 / Step 2 / Step 3 SaaS filler without real hosting context".
// The reference draws five and they are the actual arc of hosting
// something — invite, plan, organise, gather, remember. The fifth step
// matters most for the product: the gathering does not end when everyone
// leaves, and My Guest Book is the reason someone comes back.

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "The simple path from invite to incredible. How Place & Plenty handles everything between “people are coming” and the doorbell ringing.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { url: "/how-it-works" },
};

const STEPS: {
  icon: IconName;
  title: string;
  body: string;
}[] = [
  {
    icon: "envelope",
    title: "Invite",
    body: "Send invitations — ours or your own — add your people, and collect RSVPs in one place.",
  },
  {
    icon: "table",
    title: "Plan",
    body: "Build your menu, set the vibe, and work out quantities. Figure It Out For Me does the heavy lifting.",
  },
  {
    icon: "check",
    title: "Organise",
    body: "Shopping, prep, contributions and your HostReady score — all in one place instead of five.",
  },
  {
    icon: "heart",
    title: "Gather",
    body: "Feel ready, present, and actually able to enjoy the people you invited.",
  },
  {
    icon: "book",
    title: "Remember",
    body: "Keep the photos, the notes and the people — so next time doesn’t start from scratch.",
  },
];

const CAPABILITIES: {
  icon: IconName;
  title: string;
  body: string;
  photoCaption: string;
}[] = [
  {
    icon: "rsvp",
    title: "Invitations & RSVPs",
    body: "Send, track and manage replies. Or bring the invitation you already made and track RSVPs against it.",
    photoCaption: "A phone showing an invitation, held at a set table",
  },
  {
    icon: "people",
    title: "My People",
    body: "Your guest command centre for this gathering — who’s coming, who they’re coming with, what they can’t eat, and every message you’ve sent them.",
    photoCaption: "Guests around a kitchen island, mid-conversation",
  },
  {
    icon: "cart",
    title: "My Shopping",
    body: "One list with everything you need — food, supplies, the ice you always forget — with the budget beside it.",
    photoCaption: "A basket of groceries on a counter, warm daylight",
  },
  {
    icon: "gift",
    title: "Who’s Bringing What",
    body: "Coordinate contributions and potluck items without running the whole thing out of a group chat.",
    photoCaption: "A guest arriving at the door holding a covered dish",
  },
  {
    icon: "book",
    title: "My Guest Book",
    body: "The people you host most often, kept in one place, so you never rebuild the same guest list twice.",
    photoCaption: "An open notebook and pen beside a candle",
  },
  {
    icon: "grid",
    title: "…and the rest of it",
    body: "Menus, the space, the music, your hosting closet, co-hosts, photos, and the readiness score that ties it together.",
    photoCaption: "A table mid-setup — plates stacked, greenery, candles unlit",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How It Works"
        headline="Home hosting."
        emphasisLine="Made simple."
        imageCaption="A long table set for dinner at home — candles lit, greenery down the middle"
        image={null}
        body={
          <>
            <p>{PROMISE}</p>
            <p className="mt-3">
              We help you plan, stay organised, and actually enjoy your own
              gathering.
            </p>
          </>
        }
      />

      {/* ---- the path ------------------------------------------------ */}
      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <Display
            emphasis="incredible"
            className="text-center text-3xl leading-tight text-forest md:text-[2.4rem]"
          >
            The simple path from invite to incredible.
          </Display>

          <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {/* The dashed connector, desktop only. It is decoration: the
                list is already ordered, and a rule that only exists at one
                breakpoint must not carry meaning. */}
            <span
              aria-hidden
              className="absolute left-0 right-0 top-7 hidden border-t border-dashed border-sage/50 lg:block"
            />

            {STEPS.map((step, i) => (
              <li key={step.title} className="relative text-center">
                <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-forest text-offwhite ring-8 ring-parchment">
                  <Icon name={step.icon} size={22} />
                </span>
                <h3 className="mt-5 font-display text-lg text-forest">
                  {i + 1}. {step.title}
                </h3>
                <p className="mx-auto mt-2 max-w-[16rem] font-body text-sm leading-relaxed text-forest/70">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      {/* ---- everything in one place --------------------------------- */}
      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">
                P&amp;P brings it all together
              </p>
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.3rem]">
                Everything you need.
              </Display>
              <p className="font-display text-3xl italic leading-tight text-sage md:text-[2.3rem]">
                All in one place.
              </p>
              <p className="mt-6 max-w-prose font-body text-base leading-relaxed text-forest/75">
                From the first invitation to the last thank you, Place &amp;
                Plenty keeps the details organised so you can spend the evening
                on what you actually invited people for.
              </p>
              <Link
                href="/what-it-does"
                className="mt-7 inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
              >
                Explore What It Does
              </Link>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map((c) => (
                <li key={c.title}>
                  <SplitCard
                    icon={c.icon}
                    title={c.title}
                    body={c.body}
                    photoCaption={c.photoCaption}
                  />
                </li>
              ))}
            </ul>
          </div>

          <BotanicalDivider className="mt-14" />

          <p className="mt-8 text-center">
            <Link
              href="/what-it-does"
              className="font-body text-sm font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-sage"
            >
              See everything Place &amp; Plenty can do{" "}
              <span aria-hidden>&rarr;</span>
            </Link>
          </p>
        </div>
      </Band>

      {/* §8 requires the connected loop and the invitation line here, in
          full rather than as a mention. */}
      <GuestManagementSection />

      <FounderBand />

      <CtaBand
        headline="Ready to host"
        emphasisLine="with more ease?"
        body="Create your account and plan your next gathering in the browser. Nothing to download, nothing to install."
      />
    </>
  );
}
