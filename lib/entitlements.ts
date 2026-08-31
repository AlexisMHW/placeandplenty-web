// ONE ACCOUNT. ONE CANONICAL ENTITLEMENT MODEL. MULTIPLE PURCHASE
// CHANNELS.
//
// `gathering_entitlements` is the shared backend authority. The website
// never keeps a web-side copy of a person's plan and never infers access
// from a profile flag or local cache. Purchase channel is provenance;
// entitlement identity and access remain canonical across surfaces.

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

export function isLive(e: Entitlement, now = new Date()): boolean {
  if (!e.active) return false;
  if (e.refunded_at || e.revoked_at) return false;
  if (e.expires_at && new Date(e.expires_at) <= now) return false;
  return true;
}

export interface EntitlementState {
  plus: Entitlement | null;
  passes: Entitlement[];
  tier: "Free" | "Gathering Pass" | "Place & Plenty Plus";
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

/**
 * Kept for client-safe code that needs a static statement about whether
 * the web purchase channel is launched. Runtime checkout surfaces use
 * the server-side processor configuration as the final authority.
 */
export const WEB_CHECKOUT_LIVE = false;

/**
 * Access portability, deliberately phrased without implying that every
 * purchase channel is already launched. Provider-specific availability
 * is stated separately on Pricing and checkout surfaces.
 */
export const CROSS_PLATFORM_PROMISE =
  "One Place & Plenty account across web and mobile. Your Gathering Pass or Plus access follows that account, so signing in on another device does not create a second plan or require a transfer.";

export const WEB_ONLY_PROMISE =
  "You can create an account, plan, and host entirely on the web. The app is there when you want your gathering in your pocket — not as a step you have to take first.";

export const FEATURE_AVAILABILITY_NOTE =
  "Some Plus features require the Place & Plenty mobile app. Plus access follows your account across platforms, but feature availability may vary between web and mobile.";

export interface NativeOnlyFeature {
  name: string;
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
