// ONE ACCOUNT. ONE CANONICAL ENTITLEMENT MODEL. MULTIPLE PURCHASE
// CHANNELS.
//
// THE IMPORTANT FINDING FIRST: this model already exists in the shared
// backend and is already channel-agnostic. It was not invented here and
// nothing was added to the schema for the website. `gathering_entitlements`
// carries, per row:
//
//   user_id               the account — the only identity that matters
//   scope                 'account' (Plus) | 'gathering' (a Pass)
//   gathering_id          NULL for account scope, enforced by a CHECK
//   entitlement_type      'plus' | 'gathering_pass'
//   canonical_product_id  'plus_annual' | 'gathering_pass'  <- THE KEY
//   provider              apple | google | web  (NULL for beta grants)
//   store_product_id      the platform SKU, kept for reconciliation only
//   provider_transaction_id / original_transaction_id / purchase_intent_id
//   active, expires_at, consumed_at, refunded_at, revoked_at
//
// `canonical_product_id` is what makes the founder's rule true in the
// data rather than only in the copy. The product a person owns is
// `plus_annual`; Apple's SKU, Google's SKU and a web checkout are three
// ways to arrive at that same row. There is no "web Plus" and no "app
// Plus" — there is Plus, plus a note of where it was bought.
//
// WHAT THAT MEANS FOR THIS WEBSITE, and it is the whole point:
//
//   - Buy on web, sign into the app  -> same row, same access.
//   - Buy on Apple or Google, sign in on web -> same row, same access.
//   - Move between surfaces -> nothing to repurchase, nothing to restore
//     beyond the store's own restore, nothing to reconcile.
//
// So the website must NEVER write its own entitlement, cache one, keep a
// web-only plan table, or infer access from anything except these rows.
// It reads them through RLS as the signed-in user, exactly as the native
// app does.
//
// THIS MODULE IS PURE AND CLIENT-SAFE. It holds the model — the types,
// the rules for reading it, and the language used to describe it — and
// imports nothing. The Supabase reads live in lib/entitlement-data.ts.
//
// That split is not tidiness. lib/conversion.ts needs WEB_CHECKOUT_LIVE
// to decide whether to offer a "Buy on Web" path, and the site header is
// a client component that renders those paths — so a server-only import
// anywhere in this file's dependency chain reaches next/headers from the
// browser bundle and fails the build. It did. Keep this file free of
// imports.
//
// PURCHASING IS NOT WIRED YET on any surface — the app has no
// monetization client and there is no web checkout. That is a gap in the
// purchase CHANNELS, not in the model. Everything below is written so
// that turning a channel on is a configuration change (see
// WEB_CHECKOUT) rather than a rewrite, and so that nothing on the site
// claims a purchase can be made today.

export type CanonicalProductId = "gathering_pass" | "plus_annual";

export type EntitlementProvider = "apple" | "google" | "web" | "beta";

export interface Entitlement {
  id: string;
  entitlement_type: string;
  canonical_product_id: string | null;
  scope: "account" | "gathering";
  gathering_id: string | null;
  active: boolean;
  purchased_at: string;
  expires_at: string | null;
  consumed_at: string | null;
  refunded_at: string | null;
  revoked_at: string | null;
  provider: string | null;
  source: string | null;
}

/**
 * An entitlement counts as live when it is active, unexpired, and has
 * not been refunded or revoked.
 *
 * `consumed_at` is deliberately NOT a disqualifier. A Gathering Pass is
 * consumed at the moment it is applied to its gathering; that is what
 * "bound to that gathering" means, and the access it bought continues.
 * Treating consumption as expiry would tell a host who used their Pass
 * that they no longer have one.
 */
export function isLive(e: Entitlement, now = new Date()): boolean {
  if (!e.active) return false;
  if (e.refunded_at || e.revoked_at) return false;
  if (e.expires_at && new Date(e.expires_at) <= now) return false;
  return true;
}

export interface EntitlementState {
  /** Account-scoped Plus, live right now. */
  plus: Entitlement | null;
  /** Live gathering-scoped Passes, newest first. */
  passes: Entitlement[];
  /** "Free" when neither of the above. Never inferred from anything else. */
  tier: "Free" | "Gathering Pass" | "Place & Plenty Plus";
  /** Distinct channels this account has ever purchased through. */
  channels: string[];
}

export function summarise(
  entitlements: Entitlement[],
  now = new Date()
): EntitlementState {
  const live = entitlements.filter((e) => isLive(e, now));

  const plus =
    live.find((e) => e.scope === "account" && e.entitlement_type === "plus") ??
    null;
  const passes = live.filter((e) => e.scope === "gathering");

  const channels = Array.from(
    new Set(
      entitlements
        .map((e) => e.provider || e.source)
        .filter((c): c is string => Boolean(c))
    )
  );

  return {
    plus,
    passes,
    tier: plus ? "Place & Plenty Plus" : passes.length ? "Gathering Pass" : "Free",
    channels,
  };
}

/**
 * How a purchase channel is described to a person. The label says where
 * it was bought, never what it is worth — an Apple Pass and a web Pass
 * are the same entitlement and the account area must not imply
 * otherwise.
 */
export function channelLabel(channel: string): string {
  switch (channel) {
    case "apple":
      return "the App Store";
    case "google":
      return "Google Play";
    case "web":
      return "placeandplenty.com";
    case "beta":
      return "a Place & Plenty grant";
    default:
      return channel;
  }
}

/**
 * WHERE BILLING IS MANAGED, which depends on the channel and is a fact
 * about Apple and Google rather than a Place & Plenty decision.
 *
 * A subscription bought through a store can only be cancelled in that
 * store — saying anything else on the website would be false, and §19
 * forbids claiming subscription-management capability that does not
 * exist. A web purchase is ours to manage, and will be managed here.
 */
export function billingHomeFor(channel: string | null): string {
  switch (channel) {
    case "apple":
      return "Apple manages this purchase. Cancel or change it in Settings on your iPhone, under your Apple Account.";
    case "google":
      return "Google Play manages this purchase. Cancel or change it in the Play Store, under Subscriptions.";
    case "web":
      return "You bought this on placeandplenty.com, so it is managed here in your account.";
    case "beta":
      return "This was granted directly by Place & Plenty. There is nothing to bill and nothing to cancel.";
    default:
      return "Managed on the account it was bought with.";
  }
}

/* ------------------------------------------------------------------ */
/* Web as a purchase channel                                          */
/* ------------------------------------------------------------------ */

/**
 * WEB CHECKOUT IS A CHANNEL, NOT A PLAN. When it goes live, a web
 * purchase writes exactly the rows above with `provider: 'web'` and the
 * same `canonical_product_id` the stores use, through the same
 * `purchase_intents` handshake the native flow will use. There is no web
 * price, no web SKU and no web-only entitlement to reconcile later.
 *
 * Flip this to true only when the checkout actually exists. Until then
 * every "Buy on web" affordance on the site explains the channel and
 * does not pretend to take money — §17 and §32 forbid implying a
 * purchase can be made before one can.
 */
export const WEB_CHECKOUT_LIVE = false;

/**
 * The one sentence that has to be true and visible wherever a person
 * might reasonably worry about buying on the wrong surface. This is the
 * founder's governing rule in the customer's words.
 */
export const CROSS_PLATFORM_PROMISE =
  "One account, wherever you buy. A Gathering Pass or Plus bought on the web works in the app, and one bought through the App Store or Google Play works on the web. Nothing to repurchase, nothing to transfer.";

export const WEB_ONLY_PROMISE =
  "You can create an account, plan, and host entirely on the web. The app is there when you want your gathering in your pocket — not as a step you have to take first.";

/* ------------------------------------------------------------------ */
/* Entitlement portability is NOT feature parity                      */
/* ------------------------------------------------------------------ */

/**
 * THE DISTINCTION THIS FILE MUST NEVER BLUR, and the reason this
 * constant exists rather than being written into three pages by hand.
 *
 * CROSS_PLATFORM_PROMISE is about ACCESS: what you bought is attached to
 * your account and follows you between web and phone. That is completely
 * true and is the founder's governing rule.
 *
 * It is not a claim about FEATURES. Two Plus capabilities are native-only
 * for real product reasons — Host Mode runs on gathering-day push
 * notifications while you are moving around the house, and Space Mode
 * begins with a camera pointed at a room. Someone who buys Plus on the
 * web and never installs the app has bought genuine Plus access and will
 * still not be able to use those two.
 *
 * Saying so plainly is a legal and an honesty requirement, and the two
 * point the same way: implying parity that does not exist would be the
 * clearest possible way to earn a refund request that is entirely
 * deserved. Founder instruction, 28 Aug 2026 — the note below is quoted
 * verbatim wherever price and platform are discussed together.
 */
export const FEATURE_AVAILABILITY_NOTE =
  "Some Plus features require the Place & Plenty mobile app. Plus access follows your account across platforms, but feature availability may vary between web and mobile.";

export interface NativeOnlyFeature {
  name: string;
  /** Why it is native-first. §29 requires a product reason, never "the app has it". */
  reason: string;
}

export const NATIVE_ONLY_FEATURES: NativeOnlyFeature[] = [
  {
    name: "Host Mode",
    reason:
      "It runs on gathering-day notifications while you are moving around the house. A desktop version is a screen nobody is sitting at when it matters.",
  },
  {
    name: "Space Mode",
    reason:
      "It starts with a camera pointed at a room. The capture step is the feature, and a phone is what you have in your hand.",
  },
];
