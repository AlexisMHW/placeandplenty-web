import type { Metadata } from "next";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import PricingSection from "@/components/PricingSection";
import AppDownload from "@/components/AppDownload";
import CtaSection from "@/components/CtaSection";
import {
  PRICING_TIERS,
  PLUS_LIMITS_NOTE,
  FREE_LIMITS_NOTE,
  PASS_LIMITS_NOTE,
} from "@/lib/pricing";
import { PricingSchema, FaqSchema } from "@/components/StructuredData";

// /pricing — PUBLISHED AND INDEXED, decided 28 Aug 2026.
//
// §5 lists Pricing as a minimum V1 public destination and §20 fixes the
// model, so the page is live and in the sitemap. It is NOT gated on
// LAUNCH_STATE. The homepage's pricing SECTION still is, which is the
// separation the founder asked for: the page always answers "what will
// this cost", while the homepage decides whether to raise the subject.
//
// NOTHING HERE MAY IMPLY A PURCHASE CAN BE MADE. The app has no
// monetization client yet — no paywall, no purchase flow, no restore — so
// there are no buy buttons, no "start free trial", and no checkout. The
// page says what it will cost, and the only actions are the Guest List
// and (once the listings exist) the stores.
//
// Every price string comes from lib/pricing.ts, which carries the
// "+ applicable taxes and fees" qualifier as part of the value. Do not
// format an amount in this file.

const faqs = [
  {
    q: "What do I get for free?",
    a: FREE_LIMITS_NOTE,
  },
  {
    q: "Do I have to subscribe?",
    a: `No. Place & Plenty is free to start, and a Gathering Pass is ${PRICING_TIERS[1].priceLine} for one gathering with no subscription behind it. Plus is there for people who host often enough to want it.`,
  },
  {
    q: "What does Plus actually include?",
    a: PLUS_LIMITS_NOTE,
  },
  {
    q: "Is a Gathering Pass a subscription?",
    a: PASS_LIMITS_NOTE,
  },
  {
    q: "Does a draft count against my Plus limits?",
    a: "No. Drafts don’t count toward the 6 active gatherings or the 12 locked-in ones. Planning something that may not happen costs nothing.",
  },
  {
    q: "What happens after 12 locked-in gatherings in a year?",
    a: `Your account features keep working, and any additional gathering can use a Gathering Pass at ${PRICING_TIERS[1].priceLine}.`,
  },
  {
    q: "Can guests use it without paying?",
    a: "Yes, and without an account. Responding to an invitation, claiming a dish, requesting a song and adding photos are all free for guests — pricing is for the person doing the hosting.",
  },
  {
    q: "Can I buy it right now?",
    a: "Not yet. Place & Plenty isn’t available for purchase while we finish getting it ready. This page is here so the cost is clear in advance, not to sell you anything today.",
  },
];

export const metadata: Metadata = {
  title: "Pricing",
  description: `Place & Plenty pricing: Free, a Gathering Pass at ${PRICING_TIERS[1].priceLine}, or Place & Plenty Plus at ${PRICING_TIERS[2].priceLine}.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Place & Plenty",
    description: `Free, a Gathering Pass at ${PRICING_TIERS[1].priceLine}, or Plus at ${PRICING_TIERS[2].priceLine}.`,
    url: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <>
      <PricingSchema />
      {/* Same array the page renders below — FAQ markup must never
          describe questions a visitor cannot see. */}
      <FaqSchema faqs={faqs} />
      <section className="bg-parchment py-16 md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-forest md:text-5xl">
            Pay for the gatherings you actually have.
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Start free. Pay for one gathering when you want everything. Or
            cover a year of them if hosting is just what you do.
          </p>
        </div>
      </section>

      <PricingSection showHeading={false} />

      <section className="bg-cream py-16 md:py-20">
        <div className="mx-auto max-w-prose px-6">
          <h2 className="font-display text-2xl text-forest md:text-3xl">
            Questions people actually ask
          </h2>

          <dl className="mt-8 divide-y divide-sage/25">
            {faqs.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="font-body text-base font-bold text-forest">
                  {item.q}
                </dt>
                <dd className="mt-2 font-body text-base leading-relaxed text-forest/80">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 font-body text-sm leading-relaxed text-forest/70">
            Anything else, our{" "}
            <Link
              href="/support"
              className="underline decoration-gold underline-offset-4 hover:text-forest"
            >
              support page
            </Link>{" "}
            has the rest, and a real address to write to.
          </p>
        </div>
      </section>

      <AppDownload />
      <CtaSection />
    </>
  );
}
