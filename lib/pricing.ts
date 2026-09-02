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
 * Release-state truth. Native purchase code is wired, but store/RevenueCat
 * setup and real-purchase verification still have to clear the release gate.
 * Stripe/web checkout is also not enabled yet. Public copy therefore states
 * availability without pretending either channel is already live.
 */
export const PURCHASE_AVAILABILITY_NOTE =
  "Purchasing opens with the app release. Web card checkout is not currently enabled.";

export const FREE_LIMITS_NOTE =
  "Free covers one open gathering at a time. A draft occupies that working slot until you finish or close it.";

export const PASS_LIMITS_NOTE =
  "A Gathering Pass unlocks one gathering and is bound to it. It isn't a subscription and there's nothing to cancel.";

export const PLUS_LIMITS_NOTE =
  "Plus covers up to 6 open gatherings at a time and up to 12 locked-in gatherings per annual term. Drafts occupy an open working slot but do not use the annual allowance until you finish creating and lock in the gathering. After 12 lock-ins in the same annual term, additional gatherings can use a Gathering Pass while your account-level Plus features stay active.";
