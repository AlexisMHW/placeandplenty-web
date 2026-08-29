import type { CanonicalProductId } from "@/lib/entitlements";
import { PRICING_TIERS } from "@/lib/pricing";

// WEB PURCHASE — the third channel into the one canonical entitlement
// model. Founder requirement, 28 Aug 2026: buying a Gathering Pass or
// Plus on the website is a V1 requirement, not a future note.
//
// WHAT THE BACKEND ALREADY SETTLES, and it settles more than expected.
// `gathering_entitlements` and `purchase_intents` are **SELECT-only for
// signed-in users** — neither table has an INSERT policy. Entitlements
// are minted server-side, by a trusted process, and never by a browser.
// That is the correct posture and it decides the shape of this flow:
//
//   1. browser  asks this website to start a purchase
//   2. server   (a Next.js route, running as the user) validates what is
//               being bought and creates a checkout session with the
//               payment processor. It writes NOTHING to the entitlement
//               tables, because it cannot and should not.
//   3. webhook  the processor calls a Supabase Edge Function which, with
//               the service role, verifies the payment and writes the
//               canonical rows: provider 'web', the SAME
//               canonical_product_id the stores use, and the intent it
//               fulfils.
//   4. app+web  both read those rows. There is nothing to sync.
//
// Step 3 lives in the shared backend, not here. It is written and handed
// over in WEB-PURCHASE-HANDOFF.md rather than deployed from this repo,
// because deploying an entitlement-minting function needs the founder's
// processor credentials and belongs to the backend's own review.
//
// NO WEB PRICE, NO WEB SKU, NO WEB PLAN. The catalogue below maps a URL
// slug to the canonical product id and to the SAME price string
// lib/pricing.ts already publishes. If a web-only amount ever appears in
// this file, the founder's governing rule has been broken.
//
// UNTIL A PROCESSOR IS CONFIGURED the flow stops honestly at the last
// step it can complete: it tells the person what they are buying, that
// the account is what carries it, and that checkout opens with the
// release. It never renders a button that appears to take money and
// does not. §17/§32.

export interface WebProduct {
  /** URL segment: /checkout/<slug>. */
  slug: string;
  /** The cross-platform product identity. Never platform-specific. */
  canonicalProductId: CanonicalProductId;
  name: string;
  /** Comes from lib/pricing.ts, qualifier included. Never retyped. */
  priceLine: string;
  description: string;
  /**
   * A Gathering Pass is bound to one gathering — the database enforces
   * it (`purchase_intents_pass_requires_gathering`), so the flow has to
   * ask which one before it can create an intent at all.
   */
  requiresGathering: boolean;
}

const PASS = PRICING_TIERS.find((t) => t.name === "Gathering Pass")!;
const PLUS = PRICING_TIERS.find((t) => t.name === "Place & Plenty Plus")!;

export const WEB_PRODUCTS: WebProduct[] = [
  {
    slug: "gathering-pass",
    canonicalProductId: "gathering_pass",
    name: PASS.name,
    priceLine: PASS.priceLine,
    description: PASS.description,
    requiresGathering: true,
  },
  {
    slug: "plus",
    canonicalProductId: "plus_annual",
    name: PLUS.name,
    priceLine: PLUS.priceLine,
    description: PLUS.description,
    requiresGathering: false,
  },
];

export function findWebProduct(slug: string): WebProduct | undefined {
  return WEB_PRODUCTS.find((p) => p.slug === slug);
}

/* ------------------------------------------------------------------ */
/* The processor seam                                                 */
/* ------------------------------------------------------------------ */

/**
 * Whether a payment processor is actually configured for this
 * deployment. Read from the environment rather than hardcoded, so
 * turning web checkout on is a Vercel environment change and a webhook
 * deploy — not a code change and not a release.
 *
 * Deliberately checks the SECRET key, which only exists server-side. A
 * publishable key alone means a half-finished configuration, and
 * half-finished must read as off.
 */
export function isCheckoutConfigured(): boolean {
  return Boolean(process.env.PAYMENT_PROCESSOR_SECRET_KEY);
}

/**
 * What the checkout page shows when no processor is configured. A
 * statement of timing, not an apology, and not a disabled button
 * pretending to be a live one.
 */
export const CHECKOUT_PENDING_NOTE =
  "Card payment opens with the app release. The plan, the price and the account it lands on are all settled — nothing about them changes when it does.";

/**
 * Said on every checkout surface. It is the reason someone can buy here
 * without worrying they have bought the wrong version of the product.
 */
export const CHECKOUT_ASSURANCE =
  "You’re buying it for your Place & Plenty account, not for this browser. Sign in on your phone and it’s already there.";
