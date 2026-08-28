import type { Metadata } from "next";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import HowItWorks from "@/components/HowItWorks";
import ProblemSection from "@/components/ProblemSection";
import HostReadySection from "@/components/HostReadySection";
import GuestManagementSection from "@/components/GuestManagementSection";
import CtaSection from "@/components/CtaSection";
import { PROMISE } from "@/lib/brand";

// HOW IT WORKS — the "understand" job (§2).
//
// Order is deliberate and is the argument the page is making:
//
//   1. the problem, named honestly (it is not the planning)
//   2. the four steps
//   3. HostReady, because "how do I know I'm done" is the question the
//      four steps leave open
//   4. what a guest sees, because a host's first worry about any invite
//      tool is what it does to the people they invited
//
// Step 4 matters more than it looks. Guest web works WITHOUT an account
// (§33), and saying so plainly is both true and the most reassuring thing
// on the page — a host is deciding on behalf of people who did not choose
// this software.

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Tell Place & Plenty what's happening. Get a preparation plan built backward from when people arrive, and know whether you're actually ready.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How It Works | Place & Plenty",
    description:
      "A preparation plan built backward from when your guests arrive.",
    url: "/how-it-works",
  },
};

const guestSteps = [
  {
    title: "They get a link.",
    body: "One link per household, not per person — so a family responds once, the way they actually decide.",
  },
  {
    title: "They RSVP without an account.",
    body: "No download, no sign-up, no password. It works on whatever phone they opened it on.",
  },
  {
    title: "They can claim what they're bringing.",
    body: "If you asked for contributions, they pick from what's still open — so you stop getting four texts about the same casserole.",
  },
  {
    title: "You see it immediately.",
    body: "Their answer lands in My People. There is no separate web list to reconcile.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-parchment py-16 md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-forest md:text-5xl">
            {PROMISE}
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            You tell Place &amp; Plenty what&rsquo;s happening. It works out
            what has to happen, when, and who&rsquo;s handling it — then
            tells you whether you&rsquo;re actually ready.
          </p>
        </div>
      </section>

      <ProblemSection />
      <HowItWorks />

      {/* §8: the guest-management loop must be especially clear here,
          and the invitation line has to appear. Both live in one
          component so the positioning cannot drift between pages. */}
      <GuestManagementSection />

      <HostReadySection />

      <section className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>What your guests see</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
            The easiest part of the whole thing — for them.
          </h2>
          <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Your guests never have to install anything or make an account.
            That is the point.
          </p>

          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {guestSteps.map((step, i) => (
              <li key={step.title}>
                <span
                  aria-hidden
                  className="font-display text-2xl text-goldInk"
                >
                  {i + 1}
                </span>
                <h3 className="mt-2 font-display text-xl text-forest">
                  {step.title}
                </h3>
                <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-10 max-w-prose font-body text-base leading-relaxed text-forest/70">
            A guest link shows only what a guest needs. Your budget, your
            notes, your shopping and the other guests&rsquo; contact details
            are never on it — and your address stays hidden unless you
            choose to show it.
          </p>

          <Link
            href="/what-it-does"
            className="mt-8 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            See everything it does
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
