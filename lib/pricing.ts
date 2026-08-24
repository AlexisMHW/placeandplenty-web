// V1 pricing — APPROVED, not draft/preliminary. See internal pricing
// directive for full entitlement rules (app-side logic lives outside
// this repo). Do not add monthly Plus, trials, or discounts here
// without separate approval.

export interface PricingTier {
  name: string;
  price: string;
  billing: string;
  description: string;
  highlight?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    billing: "",
    description: "A simple way to start getting ready.",
  },
  {
    name: "Gathering Pass",
    price: "$9.99",
    billing: "/ gathering",
    description:
      "Unlock the full Place & Plenty experience for one gathering. No subscription.",
  },
  {
    name: "Place & Plenty Plus",
    price: "$59.99",
    billing: "/ year",
    description: "For people who keep having people over.",
    highlight: true,
  },
];
