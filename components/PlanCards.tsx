import Link from "next/link";
import { Band, Display } from "@/components/Display";
import { BotanicalBough } from "@/components/Botanical";
import Icon from "@/components/Icon";
import {
  PRICING_TIERS,
  PLUS_LIMITS_NOTE,
  PASS_LIMITS_NOTE,
  type PricingTier,
} from "@/lib/pricing";
import { isCheckoutConfigured, findWebProduct } from "@/lib/checkout";

function CheckItem({ children, filled }: { children: string; filled: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex-shrink-0 ${filled ? "text-forest" : "text-goldInk"}`}>
        <Icon name="check" size={17} />
      </span>
      <span className="font-body text-sm leading-relaxed text-forest/80">{children}</span>
    </li>
  );
}

function PlanCard({ tier, checkoutLive }: { tier: PricingTier; checkoutLive: boolean }) {
  const highlight = Boolean(tier.highlight);
  const free = tier.price === "$0";
  const qualifier = tier.priceLine.replace(tier.price, "").replace(tier.billing, "").trim();
  const product = free ? null : findWebProduct(tier.name === "Gathering Pass" ? "gathering-pass" : "plus");
  const href = free ? "/signup" : checkoutLive ? `/checkout/${product?.slug ?? "plus"}` : "/get";
  const label = free ? "Start Hosting" : checkoutLive ? tier.name === "Gathering Pass" ? "Get a Pass" : "Go Plus" : "Get the app";
  const fineprint = free
    ? "No credit card required"
    : checkoutLive
      ? tier.name === "Gathering Pass"
        ? "Use anytime · not a subscription"
        : "Billed annually"
      : "Purchase through Apple or Google when available";

  return (
    <div className={`relative flex h-full flex-col rounded-2xl bg-offwhite p-7 text-center ${highlight ? "border-2 border-forest shadow-lift lg:-mt-6 lg:mb-6" : "border border-sage/30 shadow-softer"}`}>
      {highlight && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-forest px-3.5 py-1.5 font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-offwhite">Most popular</span>
      )}
      <p className="font-body text-[0.72rem] font-bold uppercase tracking-[0.22em] text-forest/70">{tier.name}</p>
      <p className="mt-4 flex items-start justify-center font-display text-forest">
        <span className="mt-2 text-2xl">{tier.price.slice(0, 1)}</span>
        <span className="text-[3.2rem] leading-none">{tier.price.slice(1)}</span>
        {tier.billing && <span className="mt-6 ml-1.5 font-body text-base text-forest/70">{tier.billing}</span>}
      </p>
      <p className="mt-2 font-body text-xs text-forest/65">{free ? "forever" : qualifier}</p>
      <span aria-hidden className="mx-auto mt-5 block h-px w-14 bg-gold" />
      <p className="mt-5 font-body text-sm leading-relaxed text-forest/75">{tier.description}</p>
      <ul className="mt-6 space-y-3 text-left">
        {tier.includes.map((item) => <CheckItem key={item} filled={highlight}>{item}</CheckItem>)}
      </ul>
      <div className="mt-auto pt-8">
        <Link href={href} className={`block w-full rounded-lg px-5 py-3 font-body text-sm font-semibold transition-colors duration-400 ${highlight ? "bg-forest text-offwhite hover:bg-forest/90" : "border border-forest/35 text-forest hover:bg-forest/5"}`}>{label}</Link>
        <p className="mt-3 font-body text-xs text-forest/60">{fineprint}</p>
      </div>
    </div>
  );
}

export default function PlanCards() {
  const [free, pass, plus] = PRICING_TIERS;
  const ordered = [free, plus, pass];
  const checkoutLive = isCheckoutConfigured();

  return (
    <Band tone="plain">
      <div className="relative">
        <BotanicalBough className="pointer-events-none absolute -left-12 top-24 hidden text-olive/35 xl:block" width={200} />
        <BotanicalBough className="pointer-events-none absolute -right-12 top-24 hidden text-olive/35 xl:block" width={200} flip />
        <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
          <Display emphasis="more ease" className="text-center text-3xl leading-tight text-forest md:text-[2.3rem]">Three simple ways to host with more ease.</Display>
          <p className="mx-auto mt-4 max-w-3xl text-center font-body text-base leading-relaxed text-forest/70">
            A Gathering Pass unlocks the paid experience for one gathering. Place &amp; Plenty Plus is the annual option for people who host repeatedly and want paid access across their gatherings all year.
          </p>

          <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-5">
            {ordered.map((tier) => <PlanCard key={tier.name} tier={tier} checkoutLive={checkoutLive} />)}
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-sage/25 bg-cream px-6 py-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-parchment text-forest"><Icon name="info" size={20} /></span>
                <div>
                  <h3 className="font-display text-lg text-forest">How a Gathering Pass works</h3>
                  <p className="mt-1.5 font-body text-sm leading-relaxed text-forest/75">{PASS_LIMITS_NOTE}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-sage/25 bg-cream px-6 py-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-forest text-offwhite"><Icon name="info" size={20} /></span>
                <div>
                  <h3 className="font-display text-lg text-forest">How Plus works</h3>
                  <p className="mt-1.5 font-body text-sm leading-relaxed text-forest/75">{PLUS_LIMITS_NOTE}</p>
                </div>
              </div>
            </div>
          </div>

          {!checkoutLive && (
            <p className="mt-6 text-center font-body text-sm text-forest/65">Web card checkout is not active yet. Paid access will be available through the mobile stores first; Free accounts already work in the browser.</p>
          )}
        </div>
      </div>
    </Band>
  );
}
