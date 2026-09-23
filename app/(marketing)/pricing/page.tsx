import HostingComparisonTable from "@/components/HostingComparisonTable";
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
  MULTI_DAY_NOTE,
  MULTI_DAY_PRICING,
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
import { REFUND_POLICY } from "@/lib/refund-policy";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Place & Plenty pricing: Free, Gathering Pass, Multi-Day Pass, and Place & Plenty Plus. One account across web and mobile.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Place & Plenty",
    description: `Free, Gathering Pass, Multi-Day Pass, and Place & Plenty Plus — four ways to host with the level of planning support you need.`,
    url: "/pricing",
  },
};

const faqs = [
  { q: "What do I get for free?", a: FREE_LIMITS_NOTE },
  {
    q: "Can I buy on the website, or do I have to use the app?",
    a: `${PURCHASE_AVAILABILITY_NOTE} You can create your account, plan and purchase eligible host access in the browser. Store purchases will use that same canonical account and entitlement model.`,
  },
  {
    q: "If I buy on my phone, does it work on the web?",
    a: "Yes. Paid access belongs to your Place & Plenty account, not to one device. Sign in on the web with the same account and the entitlement is recognized there — nothing to transfer or repurchase.",
  },
  {
    q: "Do I have to subscribe?",
    a: `No. Place & Plenty is free to start, and a Gathering Pass is ${PRICING_TIERS[1].priceLine} for one gathering with no subscription behind it. Plus is annual for hosts who want paid access across their gatherings all year.`,
  },
  { q: "What does Plus actually include?", a: PLUS_LIMITS_NOTE },
  { q: "Is a Gathering Pass a subscription?", a: PASS_LIMITS_NOTE },
  {
    q: "What does Multi-Day cost?",
    a: `A Multi-Day Pass covers 2–4 calendar days. The standard rate is ${MULTI_DAY_PRICING.standard.priceLine}; a gathering that already has a Gathering Pass pays ${MULTI_DAY_PRICING.gathering_pass.priceLine}; Plus hosts pay ${MULTI_DAY_PRICING.plus.priceLine}. A one-time extension to as many as 7 calendar days is ${MULTI_DAY_PRICING.extension.priceLine}.`,
  },
  {
    q: "Does a draft count against my Plus limits?",
    a: "A draft occupies one of your 6 open working slots, but it does not use one of the 12 annual lock-ins. The annual allowance is used only when you finish creating the gathering and lock it in.",
  },
  {
    q: "What happens after 12 locked-in gatherings in an annual term?",
    a: `Your account-level Plus features keep working, and an additional gathering can use a Gathering Pass at ${PRICING_TIERS[1].priceLine}.`,
  },
  {
    q: "What happens if I cancel Plus?",
    a: REFUND_POLICY.plus.short,
  },
  {
    q: "What is the refund policy?",
    a: `${REFUND_POLICY.gatheringPass.short} ${REFUND_POLICY.initialPlusRefund}`,
  },
  {
    q: "Where will I manage or cancel what I buy?",
    a: "A Plus subscription bought through Apple or Google is managed in that store. A direct web purchase is managed through your Place & Plenty account. Access itself follows the same account across web and mobile.",
  },
  {
    q: "Can guests use it without paying?",
    a: "Yes, and without an account. Responding to an invitation, claiming a dish, requesting a song and adding photos are free for guests — pricing is for the host account or the gathering being unlocked.",
  },
];

const TRUST: { icon: IconName; title: string; body: string }[] = [
  { icon: "lock", title: "Secure & private", body: "No advertising and no selling your gathering data. Your gathering is not a data product." },
  { icon: "leaf", title: "Clear commitment", body: "A Gathering Pass is a one-off for one gathering. Plus is annual." },
  { icon: "card", title: "Fair & transparent", body: "Prices, renewal terms, cancellation and refund rules are stated before purchase." },
  { icon: "heart", title: "Built for real hosts", body: "Real homes, real budgets, real people coming through the door." },
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
        image="/images/Pricing_Page_Hero.png"
        imageAlt="A warm, lived-in home gathering table styled for an approachable dinner"
        imageCaption="Choose the level of planning help that fits how often — and how deeply — you host."
        body={<p>Start free, unlock one gathering with a Gathering Pass, choose a Multi-Day Pass for a 2–4 day gathering, or choose Plus when hosting is something you do again and again.</p>}
      />

      <PlanCards />

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-12 md:py-14">
          <div className="rounded-3xl border border-gold/35 bg-parchment p-7 md:p-9">
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/55">Multi-Day gatherings</p>
            <div className="mt-3 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
              <div>
                <Display className="text-2xl text-forest md:text-3xl">One gathering. More than one day.</Display>
                <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/75">{MULTI_DAY_NOTE}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/multi-day" className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite">See How Multi-Day Works</Link>
                  <Link href="/signup" className="rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest">Start Hosting Free</Link>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Standard", MULTI_DAY_PRICING.standard.priceLine],
                  ["With Gathering Pass", MULTI_DAY_PRICING.gathering_pass.priceLine],
                  ["With Plus", MULTI_DAY_PRICING.plus.priceLine],
                  ["5–7 day extension", MULTI_DAY_PRICING.extension.priceLine],
                ].map(([label, price]) => (
                  <div key={label} className="rounded-2xl border border-sage/25 bg-offwhite px-4 py-4">
                    <dt className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-forest/55">{label}</dt>
                    <dd className="mt-1 font-display text-xl text-forest">{price}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-12 md:py-14">
          <div className="rounded-3xl border border-sage/30 bg-offwhite p-7 md:p-9">
            <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/55">
                  My Paper Suite
                </p>
                <Display className="mt-3 text-2xl text-forest md:text-3xl">
                  Printed pieces are optional add-ons, not another hosting plan.
                </Display>
                <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/75">
                  Create invitations, menus, itineraries, welcome signs and thank-you cards from the gathering you already planned. Print pricing depends on the piece, size, quantity and delivery choice and is shown before checkout.
                </p>
                <p className="mt-3 max-w-2xl font-body text-xs leading-relaxed text-forest/55">
                  Paper Suite creation and ordering launches on the web first. It uses the same account and canonical gathering data as the rest of Place &amp; Plenty.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/paper-suite" className="rounded-full bg-forest px-5 py-2.5 text-center font-body text-sm font-semibold text-offwhite">
                  Explore My Paper Suite
                </Link>
                <p className="text-center font-body text-xs text-forest/50">
                  Print + shipping + applicable taxes are calculated at checkout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-12 md:py-14">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-sage/30 bg-cream px-6 py-6">
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/55">Gathering Pass</p>
              <h2 className="mt-2 font-display text-xl text-forest">One gathering. One purchase.</h2>
              <p className="mt-3 font-body text-sm leading-relaxed text-forest/72">{REFUND_POLICY.gatheringPass.short}</p>
            </div>
            <div className="rounded-2xl border border-gold/40 bg-offwhite px-6 py-6">
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/55">Place &amp; Plenty Plus</p>
              <h2 className="mt-2 font-display text-xl text-forest">Annual, with a clear way out.</h2>
              <p className="mt-3 font-body text-sm leading-relaxed text-forest/72">{REFUND_POLICY.plus.short}</p>
              <p className="mt-3 font-body text-xs leading-relaxed text-forest/60">First-time direct web purchases may qualify for the 7-day discretionary refund window described in our <Link href="/terms" className="underline decoration-gold underline-offset-4">Terms</Link>.</p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            <div className="flex gap-3 text-forest/70"><Icon name="laptop" size={38} /><Icon name="phone" size={38} /></div>
            <div>
              <Display emphasis="wherever" className="text-2xl leading-snug text-forest md:text-[1.85rem]">One account, wherever you use it.</Display>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-forest/80">{CROSS_PLATFORM_PROMISE}</p>

              <dl className="mt-7 grid gap-6 sm:grid-cols-3">
                {(["web", "apple", "google"] as const).map((channel) => (
                  <div key={channel}>
                    <dt className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/60">{channel === "web" ? "Using the web" : `Bought on ${channelLabel(channel)}`}</dt>
                    <dd className="mt-1.5 font-body text-sm leading-relaxed text-forest/75">{channel === "web" ? "Sign in to the same account and use the entitlement you already own." : "The entitlement follows the same account onto the web and the app."}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7 rounded-xl border border-gold/50 bg-offwhite/70 px-5 py-5">
                <h3 className="font-display text-lg text-forest">Some paid features need the mobile app</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/75">{FEATURE_AVAILABILITY_NOTE}</p>
                <ul className="mt-4 space-y-2">
                  {NATIVE_ONLY_FEATURES.map((f) => (
                    <li key={f.name} className="font-body text-sm leading-relaxed text-forest/70">
                      <strong className="font-semibold text-forest">{f.name}</strong> — {f.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">Everything else — including Multi-Day planning and My Schedule — can be used from the browser and the app.</p>
              </div>
            </div>
          </div>
        </div>
      </Band>

      <HostingComparisonTable compact />

      <Band tone="cream">
        <div className="mx-auto max-w-prose px-6 py-16 md:py-20">
          <Display className="text-2xl text-forest md:text-3xl">Questions people actually ask</Display>
          <dl className="mt-8 divide-y divide-sage/30">
            {faqs.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="font-body text-base font-bold text-forest">{item.q}</dt>
                <dd className="mt-2 font-body text-base leading-relaxed text-forest/80">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 font-body text-sm leading-relaxed text-forest/70">Anything else — our <Link href="/support" className="underline decoration-gold underline-offset-4 hover:text-forest">support page</Link> has the rest, and a real address to write to.</p>
        </div>
      </Band>

      <Band tone="parchment">
        <ul className="mx-auto grid max-w-editorial gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {TRUST.map((t, i) => (
            <li key={t.title} className={`flex gap-4 lg:px-6 ${i > 0 ? "lg:border-l lg:border-sage/30" : ""}`}>
              <Icon name={t.icon} size={26} className="mt-0.5 flex-shrink-0 text-forest/65" />
              <div><h3 className="font-display text-base text-forest">{t.title}</h3><p className="mt-1.5 font-body text-sm leading-relaxed text-forest/70">{t.body}</p></div>
            </li>
          ))}
        </ul>
      </Band>

      <CtaBand headline="Less scrambling." emphasisLine="More gathering." body="Start free in the browser today. When you unlock paid access, it belongs to this same Place & Plenty account across web and mobile." showQr />
    </>
  );
}
