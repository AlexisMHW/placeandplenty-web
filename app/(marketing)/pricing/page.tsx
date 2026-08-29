import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import PlanCards from "@/components/PlanCards";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import { PricingSchema, FaqSchema } from "@/components/StructuredData";
import {
  PRICING_TIERS,
  PLUS_LIMITS_NOTE,
  FREE_LIMITS_NOTE,
  PASS_LIMITS_NOTE,
} from "@/lib/pricing";
import {
  CROSS_PLATFORM_PROMISE,
  FEATURE_AVAILABILITY_NOTE,
  NATIVE_ONLY_FEATURES,
  channelLabel,
} from "@/lib/entitlements";

// PRICING, composed to `Pricing_Page.png`.
//
//   PageHero      split opening, botanical left, a laid table right
//   PLAN CARDS    three cards, Plus raised in the middle under a
//                 MOST POPULAR tab, botanicals down both outer edges
//   HOW PLUS WORKS the info strip the reference puts under the cards
//   ONE ACCOUNT   the cross-platform entitlement band  <- new, and the
//                 most important addition on the page
//   FAQ
//   TRUST STRIP   four reassurances behind hairlines
//   CtaBand       with the QR panel, as the reference shows
//
// /pricing IS PUBLISHED AND INDEXED and is not gated on LAUNCH_STATE.
// §5 lists it as a minimum V1 destination and §20 fixes the model. The
// homepage's pricing section still is gated, which is the separation the
// founder asked for: this page always answers "what will this cost", the
// homepage decides whether to raise the subject.
//
// THE REFERENCE SAYS "+ applicable tax" ON BOTH PAID CARDS. It is wrong,
// and it is the exact wording §17 and §32 forbid. Every price on this
// page is a pre-assembled `priceLine` from lib/pricing.ts carrying
// "+ applicable taxes and fees" as part of the string, so no surface can
// drop the qualifier by formatting an amount itself. Nothing in this
// file formats a price.
//
// THE REFERENCE ALSO ORDERS THE CARDS Free / Plus / Gathering Pass, with
// Plus raised in the centre. That ordering is kept — it is a composition
// decision and the prices are correct either way — even though the
// reconciliation lists the tiers Free / Pass / Plus.

export const metadata: Metadata = {
  title: "Pricing",
  description: `Place & Plenty pricing: Free, a Gathering Pass at ${PRICING_TIERS[1].priceLine}, or Place & Plenty Plus at ${PRICING_TIERS[2].priceLine}. Buy on the web or in the app — one account either way.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Place & Plenty",
    description: `Free, a Gathering Pass at ${PRICING_TIERS[1].priceLine}, or Plus at ${PRICING_TIERS[2].priceLine}.`,
    url: "/pricing",
  },
};

const faqs = [
  { q: "What do I get for free?", a: FREE_LIMITS_NOTE },
  {
    q: "Can I buy on the website, or do I have to use the app?",
    a: "Either. You can create an account, plan and host entirely in your browser, and buy a Gathering Pass or Plus here. You can also buy through the App Store or Google Play. It is the same account and the same entitlement whichever you pick.",
  },
  {
    q: "If I buy on my phone, does it work on the web?",
    a: "Yes, and the other way round. What you own is attached to your Place & Plenty account, not to the device or the store you bought it from. Sign in anywhere and it is there — nothing to repurchase and nothing to transfer.",
  },
  {
    q: "Do I have to subscribe?",
    a: `No. Place & Plenty is free to start, and a Gathering Pass is ${PRICING_TIERS[1].priceLine} for one gathering with no subscription behind it. Plus is there for people who host often enough to want it.`,
  },
  { q: "What does Plus actually include?", a: PLUS_LIMITS_NOTE },
  {
    q: "Are any Plus features app-only?",
    a: "Yes, two. Host Mode and Space Mode need the mobile app, because they depend on what a phone can do — gathering-day notifications in one case and the camera in the other. Some Plus features require the Place & Plenty mobile app: Plus access follows your account across platforms, but feature availability may vary between web and mobile. Everything else Plus unlocks works in your browser.",
  },
  { q: "Is a Gathering Pass a subscription?", a: PASS_LIMITS_NOTE },
  {
    q: "Does a draft count against my Plus limits?",
    a: "No. Drafts don’t count toward the 6 active gatherings or the 12 locked-in ones. Planning something that may not happen costs nothing.",
  },
  {
    q: "What happens after 12 locked-in gatherings in a year?",
    a: `Your account features keep working, and any additional gathering can use a Gathering Pass at ${PRICING_TIERS[1].priceLine}.`,
  },
  {
    q: "Where do I manage or cancel what I’ve bought?",
    a: "Wherever you bought it. A purchase made on the website is managed in your account here. One made through Apple or Google is managed in that store, because those are the only places they can be cancelled.",
  },
  {
    q: "Can guests use it without paying?",
    a: "Yes, and without an account. Responding to an invitation, claiming a dish, requesting a song and adding photos are all free for guests — pricing is for the person doing the hosting.",
  },
];

const TRUST: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "lock",
    title: "Secure & private",
    body: "No analytics, no advertising, no session tracking. Your gathering is not a data product.",
  },
  {
    icon: "leaf",
    title: "No lock-in",
    body: "A Gathering Pass is a one-off. Plus is annual and there is nothing to cancel on a Pass.",
  },
  {
    icon: "card",
    title: "Fair & transparent",
    body: "No hidden fees. Prices shown with applicable taxes and fees called out, not buried.",
  },
  {
    icon: "heart",
    title: "Built for real hosts",
    body: "By a host who gets it. Real homes, real budgets, real Tuesday-night dinners.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PricingSchema />
      {/* Same array the page renders below — FAQ markup must never
          describe questions a visitor cannot see. */}
      <FaqSchema faqs={faqs} />

      <PageHero
        eyebrow="Pricing"
        headline="Find the plan that fits"
        emphasisLine="how you host."
        image={null}
        imageCaption="A candlelit table set for a small dinner — linen napkins, wine glasses, place cards"
        body={
          <p>
            Everything you need to plan, stay organised, and enjoy the people at
            your gathering. Start free, pay for one gathering when you want
            everything, or cover a year of them.
          </p>
        }
      />

      <PlanCards />

      {/* ---- one account, wherever you buy ---------------------------- */}
      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            <div className="flex gap-3 text-forest/70">
              <Icon name="laptop" size={38} />
              <Icon name="phone" size={38} />
            </div>
            <div>
              <Display
                emphasis="wherever"
                className="text-2xl leading-snug text-forest md:text-[1.85rem]"
              >
                One account, wherever you buy.
              </Display>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-forest/80">
                {CROSS_PLATFORM_PROMISE}
              </p>

              <dl className="mt-7 grid gap-6 sm:grid-cols-3">
                {(["web", "apple", "google"] as const).map((channel) => (
                  <div key={channel}>
                    <dt className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/60">
                      Bought on {channelLabel(channel)}
                    </dt>
                    <dd className="mt-1.5 font-body text-sm leading-relaxed text-forest/75">
                      Works on the web and in the app, on the same account.
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-6 font-body text-sm leading-relaxed text-forest/65">
                There is no web plan and no app plan — one Gathering Pass, one
                Plus, and a note of where you bought it so you know where to
                manage it.
              </p>

              {/* ACCESS TRAVELS; NOT EVERY FEATURE DOES. Stated here, in
                  the band that has just promised portability, because
                  that is the one place a reader could otherwise take
                  "works everywhere" to mean full parity. Founder
                  instruction, 28 Aug 2026 — quoted verbatim. */}
              <div className="mt-7 rounded-xl border border-gold/50 bg-offwhite/70 px-5 py-4">
                <p className="font-body text-sm font-semibold leading-relaxed text-forest">
                  {FEATURE_AVAILABILITY_NOTE}
                </p>
                <ul className="mt-3 space-y-2">
                  {NATIVE_ONLY_FEATURES.map((f) => (
                    <li
                      key={f.name}
                      className="font-body text-sm leading-relaxed text-forest/70"
                    >
                      <strong className="font-semibold text-forest">
                        {f.name}
                      </strong>{" "}
                      — {f.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">
                  Everything else Plus unlocks works in your browser. If you
                  buy on the web and want those two, you will need the app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Band>

      {/* ---- FAQ ------------------------------------------------------ */}
      <Band tone="cream">
        <div className="mx-auto max-w-prose px-6 py-16 md:py-20">
          <Display className="text-2xl text-forest md:text-3xl">
            Questions people actually ask
          </Display>

          <dl className="mt-8 divide-y divide-sage/30">
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
            Anything else — our{" "}
            <Link
              href="/support"
              className="underline decoration-gold underline-offset-4 hover:text-forest"
            >
              support page
            </Link>{" "}
            has the rest, and a real address to write to.
          </p>
        </div>
      </Band>

      {/* ---- trust strip ---------------------------------------------- */}
      <Band tone="parchment">
        <ul className="mx-auto grid max-w-editorial gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {TRUST.map((t, i) => (
            <li
              key={t.title}
              className={`flex gap-4 lg:px-6 ${
                i > 0 ? "lg:border-l lg:border-sage/30" : ""
              }`}
            >
              <Icon
                name={t.icon}
                size={26}
                className="mt-0.5 flex-shrink-0 text-forest/65"
              />
              <div>
                <h3 className="font-display text-base text-forest">{t.title}</h3>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-forest/70">
                  {t.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Band>

      <CtaBand
        headline="Less scrambling."
        emphasisLine="More gathering."
        body="Start free in the browser, and add a Pass or Plus whenever you want more. However you buy it, it follows the account."
        showQr
      />
    </>
  );
}
