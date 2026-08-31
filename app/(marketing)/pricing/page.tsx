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
  PURCHASE_AVAILABILITY_NOTE,
} from "@/lib/pricing";
import {
  CROSS_PLATFORM_PROMISE,
  FEATURE_AVAILABILITY_NOTE,
  NATIVE_ONLY_FEATURES,
  channelLabel,
} from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Place & Plenty pricing: Free, a Gathering Pass at ${PRICING_TIERS[1].priceLine}, or Place & Plenty Plus at ${PRICING_TIERS[2].priceLine}. One account across web and mobile.`,
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
    a: `${PURCHASE_AVAILABILITY_NOTE} You can still create your account and plan entirely in the browser; a purchase made in the mobile app attaches to that same account and is recognized on the web.`,
  },
  {
    q: "If I buy on my phone, does it work on the web?",
    a: "Yes. What you own is attached to your Place & Plenty account, not to the device you bought it on. Sign in on the web with the same account and the entitlement is already there — nothing to repurchase or transfer.",
  },
  {
    q: "Do I have to subscribe?",
    a: `No. Place & Plenty is free to start, and a Gathering Pass is ${PRICING_TIERS[1].priceLine} for one gathering with no subscription behind it. Plus is annual for hosts who want the account-wide smart layer and more room to host.`,
  },
  { q: "What does Plus actually include?", a: PLUS_LIMITS_NOTE },
  {
    q: "Are any Plus features app-only?",
    a: "Yes, two. Host Mode and Space Mode need the mobile app, because they depend on what a phone can do — gathering-day notifications in one case and the camera in the other. Plus access follows your account across platforms, but feature availability may vary between web and mobile. Everything else Plus unlocks works in your browser.",
  },
  { q: "Is a Gathering Pass a subscription?", a: PASS_LIMITS_NOTE },
  {
    q: "Does a draft count against my Plus limits?",
    a: "A draft occupies one of your 6 open working slots, but it does not use one of the 12 annual lock-ins. The annual allowance is used only when you finish creating the gathering and lock it in.",
  },
  {
    q: "What happens after 12 locked-in gatherings in an annual term?",
    a: `Your account-level Plus features keep working, and an additional gathering can use a Gathering Pass at ${PRICING_TIERS[1].priceLine}.`,
  },
  {
    q: "Where do I manage or cancel what I’ve bought?",
    a: "Purchases currently happen through Apple or Google, so subscription management and cancellation live in that store. Your Place & Plenty access itself follows the account on web and mobile.",
  },
  {
    q: "Can guests use it without paying?",
    a: "Yes, and without an account. Responding to an invitation, claiming a dish, requesting a song and adding photos are free for guests — pricing is for the host account or the gathering being unlocked.",
  },
];

const TRUST: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "lock",
    title: "Secure & private",
    body: "No advertising and no selling your gathering data. Your gathering is not a data product.",
  },
  {
    icon: "leaf",
    title: "Clear commitment",
    body: "A Gathering Pass is a one-off for one gathering. Plus is annual.",
  },
  {
    icon: "card",
    title: "Fair & transparent",
    body: "Paid prices call out applicable taxes and fees instead of burying them.",
  },
  {
    icon: "heart",
    title: "Built for real hosts",
    body: "Real homes, real budgets, real people coming through the door.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PricingSchema />
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
            your gathering. Start free, unlock one gathering when you want the
            smart layer, or choose Plus when hosting is simply something you do.
          </p>
        }
      />

      <PlanCards />

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
                One account, wherever you use it.
              </Display>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-forest/80">
                {CROSS_PLATFORM_PROMISE}
              </p>

              <dl className="mt-7 grid gap-6 sm:grid-cols-3">
                {(["web", "apple", "google"] as const).map((channel) => (
                  <div key={channel}>
                    <dt className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/60">
                      {channel === "web" ? "Using the web" : `Bought on ${channelLabel(channel)}`}
                    </dt>
                    <dd className="mt-1.5 font-body text-sm leading-relaxed text-forest/75">
                      {channel === "web"
                        ? "Sign in to the same account and use the entitlement you already own."
                        : "The entitlement follows the same account onto the web and the app."}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-6 font-body text-sm leading-relaxed text-forest/65">
                There is no separate web plan and no separate app plan. The
                canonical entitlement belongs to your Place &amp; Plenty account.
              </p>

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
                  Everything else Plus unlocks works in your browser once the
                  entitlement is on your account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Band>

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
        body="Start free in the browser. When you add a Pass or Plus through the mobile app, that access follows the same account back here."
        showQr
      />
    </>
  );
}
