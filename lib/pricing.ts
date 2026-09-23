// V1 pricing — APPROVED. This is the single source of truth for public
// website price and limit copy. Import from here; never retype a paid price.
//
// Paid prices always include the approved qualifier:
//   $9.99 + applicable taxes and fees
//   $59.99/year + applicable taxes and fees
//
// No monthly Plus at V1 and never "unlimited". Plus has two separate bounds:
//   • up to 6 OPEN gatherings at one time (draft / active / hosting)
//   • up to 12 LOCKED-IN gatherings per annual term
// A draft therefore occupies an open working slot, but does not use one of the
// 12 annual lock-ins until the create-gathering wizard is completed.

export const TAX_QUALIFIER = "+ applicable taxes and fees";

/**
 * My Hosting Closet is basic/free at the account layer. Paid entitlement adds
 * the smart matching/intelligence layer; it never paywalls the basic organizer.
 */
export const CLOSET_TIER_RULE =
  "Free organises what you own. A Gathering Pass or Plus works out what you still need.";

export interface PricingTier {
  name: string;
  price: string;
  billing: string;
  priceLine: string;
  description: string;
  includes: string[];
  highlight?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    billing: "",
    priceLine: "$0",
    description: "One open gathering at a time, start to doorbell.",
    includes: [
      "One open gathering at a time",
      "Menu, shopping list and timeline",
      "HostReady readiness score",
      "Who’s Bringing What — coordinate guest contributions",
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
      "Premium gathering features for one gathering. Not a subscription.",
    includes: [
      "Unlocks one gathering, and stays with it",
      "Includes the Free gathering tools",
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
      "Up to 6 open gatherings at one time",
      "Up to 12 locked-in gatherings per annual term",
      "Drafts use an open slot but not an annual lock-in",
      "Smart Closet matching on every gathering",
      "Account features stay on all year",
    ],
    highlight: true,
  },
];

/**
 * Release-state truth. Web checkout is wired through the canonical
 * entitlement model. Store/RevenueCat purchase verification still has to
 * clear the native release gate.
 */
export const PURCHASE_AVAILABILITY_NOTE =
  "Web card checkout is available for signed-in hosts. Purchases attach to the same Place & Plenty account and are recognized across web and mobile.";

export const FREE_LIMITS_NOTE =
  "Free covers one open gathering at a time. A draft occupies that working slot until you finish or close it.";

export const PASS_LIMITS_NOTE =
  "A Gathering Pass unlocks one gathering and is bound to it. It isn't a subscription and there's nothing to cancel.";

export const PLUS_LIMITS_NOTE =
  "Plus covers up to 6 open gatherings at a time and up to 12 locked-in gatherings per annual term. Drafts occupy an open working slot but do not use the annual allowance until you finish creating and lock in the gathering. After 12 lock-ins in the same annual term, additional gatherings can use a Gathering Pass while your account-level Plus features stay active.";


export const MULTI_DAY_PRICING = {
  standard: {
    label: "Multi-Day Pass",
    price: "$59.99",
    priceLine: `$59.99 ${TAX_QUALIFIER}`,
  },
  gathering_pass: {
    label: "Multi-Day upgrade",
    price: "$50.00",
    priceLine: `$50.00 ${TAX_QUALIFIER}`,
  },
  plus: {
    label: "Multi-Day Plus rate",
    price: "$39.99",
    priceLine: `$39.99 ${TAX_QUALIFIER}`,
  },
  extension: {
    label: "Multi-Day Extension",
    price: "$19.99",
    priceLine: `$19.99 ${TAX_QUALIFIER}`,
  },
} as const;

export const MULTI_DAY_NOTE =
  "A Multi-Day Pass keeps one gathering, one guest list and one planning stack across 2–4 calendar days. A one-time extension can expand that same gathering to as many as 7 calendar days.";

export const MULTI_DAY_TIER: PricingTier = {
  name: "Multi-Day Pass",
  price: MULTI_DAY_PRICING.standard.price,
  billing: "/gathering",
  priceLine: MULTI_DAY_PRICING.standard.priceLine,
  description: "For one gathering that spans 2–4 calendar days.",
  includes: [
    "One connected gathering across 2–4 calendar days",
    "One guest list across the full gathering",
    "Day-by-day My Schedule",
    "Activity-by-activity RSVPs and headcounts",
    "Connected menus, shopping and Who’s Bringing What",
    "Optional one-time extension to as many as 7 calendar days",
  ],
};
