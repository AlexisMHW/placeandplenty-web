import Link from "next/link";
import { Band, Display } from "@/components/Display";
import { BotanicalBough } from "@/components/Botanical";
import Icon from "@/components/Icon";
import {
  PRICING_TIERS,
  PLUS_LIMITS_NOTE,
  type PricingTier,
} from "@/lib/pricing";
import { isCheckoutConfigured, findWebProduct } from "@/lib/checkout";
import { FEATURE_AVAILABILITY_NOTE } from "@/lib/entitlements";

// THE THREE PLAN CARDS, composed to `Pricing_Page.png`.
//
// The reference's card anatomy, followed closely:
//
//   plan name      letterspaced small caps, centred
//   amount         the display serif, very large, with the $ raised
//   period         beside it in body type; the qualifier under it
//   gold rule
//   one-line       what the plan is for
//   check list     circle-check icons, left aligned
//   button         full width at the foot of the card
//   fine print     one line under the button
//
// Plus sits in the centre, raised, with a forest MOST POPULAR tab
// straddling its top edge and a forest border the other two do not have.
// Botanical boughs run down both outer margins of the band.
//
// THE PRICE IS NEVER FORMATTED HERE. Every amount is a pre-assembled
// `priceLine` from lib/pricing.ts with "+ applicable taxes and fees"
// already inside the string. The reference's "+ applicable tax" is the
// exact wording §17 and §32 forbid, so the reference's TYPOGRAPHY of the
// price is copied and its WORDING is not: the amount is split off the
// front of the string for display and the remainder is printed verbatim
// underneath, so the qualifier cannot be lost by a formatting change.
//
// THE BUTTONS ARE REAL WHERE THE PATH IS REAL. "Start Hosting" goes to
// /signup and works today. The two paid buttons go to /checkout/<slug>,
// which is a genuine page that explains the purchase and hands off to
// the processor — and which says plainly that card payment opens with
// the release while no processor is configured. Nothing here is a
// disabled control pretending to be a live one.

function CheckItem({ children, filled }: { children: string; filled: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex-shrink-0 ${filled ? "text-forest" : "text-goldInk"}`}
      >
        <Icon name="check" size={17} />
      </span>
      <span className="font-body text-sm leading-relaxed text-forest/80">
        {children}
      </span>
    </li>
  );
}

function PlanCard({ tier }: { tier: PricingTier }) {
  const highlight = Boolean(tier.highlight);
  const free = tier.price === "$0";

  // Split the amount off the front of the compliant string so the
  // qualifier is printed exactly as lib/pricing.ts wrote it. The
  // remainder is never edited, only positioned.
  const qualifier = tier.priceLine
    .replace(tier.price, "")
    .replace(tier.billing, "")
    .trim();

  const product = free
    ? null
    : findWebProduct(tier.name === "Gathering Pass" ? "gathering-pass" : "plus");

  const href = free ? "/signup" : `/checkout/${product?.slug ?? "plus"}`;
  const label = free
    ? "Start Hosting"
    : tier.name === "Gathering Pass"
      ? "Get a Pass"
      : "Go Plus";
  const fineprint = free
    ? "No credit card required"
    : tier.name === "Gathering Pass"
      ? "Use anytime · not a subscription"
      : "Billed annually";

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl bg-offwhite p-7 text-center ${
        highlight
          ? "border-2 border-forest shadow-lift lg:-mt-6 lg:mb-6"
          : "border border-sage/30 shadow-softer"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-forest px-3.5 py-1.5 font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-offwhite">
          Most popular
        </span>
      )}

      <p className="font-body text-[0.72rem] font-bold uppercase tracking-[0.22em] text-forest/70">
        {tier.name}
      </p>

      <p className="mt-4 flex items-start justify-center font-display text-forest">
        <span className="mt-2 text-2xl">{tier.price.slice(0, 1)}</span>
        <span className="text-[3.2rem] leading-none">{tier.price.slice(1)}</span>
        {tier.billing && (
          <span className="mt-6 ml-1.5 font-body text-base text-forest/70">
            {tier.billing}
          </span>
        )}
      </p>

      <p className="mt-2 font-body text-xs text-forest/65">
        {free ? "forever" : qualifier}
      </p>

      <span aria-hidden className="mx-auto mt-5 block h-px w-14 bg-gold" />

      <p className="mt-5 font-body text-sm leading-relaxed text-forest/75">
        {tier.description}
      </p>

      <ul className="mt-6 space-y-3 text-left">
        {tier.includes.map((item) => (
          <CheckItem key={item} filled={highlight}>
            {item}
          </CheckItem>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          href={href}
          className={`block w-full rounded-lg px-5 py-3 font-body text-sm font-semibold transition-colors duration-400 ${
            highlight
              ? "bg-forest text-offwhite hover:bg-forest/90"
              : "border border-forest/35 text-forest hover:bg-forest/5"
          }`}
        >
          {label}
        </Link>
        <p className="mt-3 font-body text-xs text-forest/60">{fineprint}</p>
      </div>
    </div>
  );
}

export default function PlanCards() {
  // The reference raises Plus in the middle. lib/pricing.ts lists the
  // tiers Free / Pass / Plus, which is the reconciliation's order, so the
  // swap happens here rather than by reordering the source of truth.
  const [free, pass, plus] = PRICING_TIERS;
  const ordered = [free, plus, pass];

  const checkoutLive = isCheckoutConfigured();

  return (
    <Band tone="plain">
      <div className="relative">
        <BotanicalBough
          className="pointer-events-none absolute -left-12 top-24 hidden text-olive/35 xl:block"
          width={200}
        />
        <BotanicalBough
          className="pointer-events-none absolute -right-12 top-24 hidden text-olive/35 xl:block"
          width={200}
          flip
        />

        <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
          <Display
            emphasis="more ease"
            className="text-center text-3xl leading-tight text-forest md:text-[2.3rem]"
          >
            Three simple ways to host with more ease.
          </Display>

          <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-5">
            {ordered.map((tier) => (
              <PlanCard key={tier.name} tier={tier} />
            ))}
          </div>

          {/* ---- the "How Plus works" strip from the reference ------- */}
          <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-sage/25 bg-cream px-6 py-6 sm:flex-row sm:items-center sm:gap-6">
            <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-forest text-offwhite">
              <Icon name="info" size={20} />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-lg text-forest">
                How Plus works
              </h3>
              <p className="mt-1.5 max-w-3xl font-body text-sm leading-relaxed text-forest/75">
                {PLUS_LIMITS_NOTE}
              </p>
            </div>
          </div>

          {/* Sits directly under the cards, because this is where
              someone decides to buy Plus and it is the caveat that
              belongs to that decision. */}
          <p className="mt-6 text-center font-body text-sm leading-relaxed text-forest/70">
            {FEATURE_AVAILABILITY_NOTE}
          </p>

          {!checkoutLive && (
            <p className="mt-6 text-center font-body text-sm text-forest/65">
              Card payment opens with the app release. Free accounts work
              today — everything on this page is settled and nothing about it
              changes when checkout goes live.
            </p>
          )}
        </div>
      </div>
    </Band>
  );
}
