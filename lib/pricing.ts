// V1 pricing — APPROVED, not draft. The single source of truth for every
// public price reference on the website. Import from here; never retype a
// price into a page.
//
// THE QUALIFIER IS NOT OPTIONAL. Founder standard, 28 Aug 2026: anywhere
// a paid price appears — Pricing, comparisons, FAQs, support and legal
// copy, CTAs, structured data — it reads
//
//     $9.99 + applicable taxes and fees
//     $59.99/year + applicable taxes and fees
//
// Never "+ tax", never "plus tax", never bare. `priceLine` below is the
// pre-assembled string so a surface cannot accidentally drop it.
//
// PURCHASING IS NOT LIVE. The app has no monetization client yet
// (`react-native-purchases` is absent; there is no paywall, purchase
// flow or restore). /pricing is published and indexed because §5 lists
// it as a minimum V1 destination and §20 fixes the model — but nothing
// on the website may imply a purchase can be made today. Say what it
// will cost, not "buy now". See PURCHASE_AVAILABILITY_NOTE.
//
// Directive §20 also settles what must NOT appear here: no monthly Plus
// at V1, and never the word "unlimited". Plus is bounded — 6 active
// gatherings at once, 12 locked-in per annual term, drafts excluded,
// Gathering Passes beyond that.

export const TAX_QUALIFIER = "+ applicable taxes and fees";

/**
 * MY HOSTING CLOSET IS SPLIT ACROSS THE TIERS, and getting the split
 * right in copy is a product requirement rather than a nicety.
 *
 *   Free        organise what you own — full inventory, on every plan
 *   Pass/Plus   let Place & Plenty work out what you still need
 *
 * The closet itself is never the paid thing. What is paid is the smart
 * matching over it: comparing a gathering's needs against the inventory,
 * reducing the shopping quantity, and keeping the provenance for why.
 *
 * So the Free tier lists the Closet, and the paid tiers list MATCHING.
 * Never write "My Hosting Closet" in a paid tier's includes list as
 * though the closet arrives with the purchase.
 */
export const CLOSET_TIER_RULE =
  "Free organises what you own. A Gathering Pass or Plus works out what you still need.";

export interface PricingTier {
  name: string;
  /** Bare amount, e.g. "$9.99". Never rendered alone for a paid tier. */
  price: string;
  /** Billing unit shown next to the amount, e.g. "/year". */
  billing: string;
  /** The full, compliant string. This is what surfaces should render. */
  priceLine: string;
  description: string;
  /** What you actually get. Kept short enough to read on a phone. */
  includes: string[];
  highlight?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    billing: "",
    priceLine: "$0",
    description: "One gathering at a time, start to doorbell.",
    includes: [
      "One active gathering at a time",
      "Menu, shopping list and timeline",
      "Invite your people and track RSVPs",
      "My Guest Book — the people you host most",
      "My Hosting Closet — organise what you already own",
    ],
  },
  {
    name: "Gathering Pass",
    price: "$9.99",
    billing: "/gathering",
    priceLine: `$9.99 ${TAX_QUALIFIER}`,
    description:
      "Everything Place & Plenty can do, for one gathering. Not a subscription.",
    includes: [
      "Unlocks one gathering, and stays with it",
      "HostReady readiness score",
      "Contributions, registry links and song requests",
      "Smart Closet matching — what you have, what you still need",
      "The gathering photo gallery",
    ],
  },
  {
    name: "Place & Plenty Plus",
    price: "$59.99",
    billing: "/year",
    priceLine: `$59.99/year ${TAX_QUALIFIER}`,
    description: "For people who keep having people over.",
    includes: [
      "Up to 6 active gatherings at one time",
      "Up to 12 locked-in gatherings per year",
      "Drafts don't count toward either limit",
      "Smart Closet matching on every gathering",
      "Account features stay on all year",
    ],
    highlight: true,
  },
];

/**
 * Shown wherever pricing appears, so no surface reads as a storefront
 * while the purchase path does not exist.
 *
 * TONE: this states a fact about timing, not an apology. "Isn't
 * available yet" centres the absence and makes an established product
 * sound like it is still being decided; "opens with the app release"
 * says the same thing as a schedule. The constraint from §17/§32 is
 * only that nothing may imply a purchase can be made TODAY — it does
 * not require sounding tentative about it.
 *
 * Update this — and only this — when monetization ships.
 */
export const PURCHASE_AVAILABILITY_NOTE =
  "These are the plans. Purchasing opens with the app release.";

/**
 * §17 entitlement truth, in one place. Free is bounded too — that was
 * missing entirely and is the fact most likely to surprise someone.
 */
export const FREE_LIMITS_NOTE =
  "Free covers one active gathering at a time. Finish it or close it and you can start the next one.";

export const PASS_LIMITS_NOTE =
  "A Gathering Pass unlocks one gathering and is bound to it. It isn't a subscription and there's nothing to cancel.";

/** The bounded-Plus explainer. Never soften this into "unlimited". */
export const PLUS_LIMITS_NOTE =
  "Plus covers up to 6 active gatherings at a time and up to 12 locked-in gatherings per annual term. Drafts don't count toward either. If you pass 12 in one year, additional gatherings can use a Gathering Pass, and your account features keep working.";
