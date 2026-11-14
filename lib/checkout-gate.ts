// Which products the website may sell, and whether web checkout is open at all.
// Kept free of "@/" imports so the unit tests can import it directly.
//
// Web checkout is limited to the two products approved for web sale:
// Gathering Pass ($9.99) and Plus annual ($59.99). Multi-Day products stay
// out of the web checkout until their own release.
export const WEB_SELLABLE_PRODUCTS: ReadonlySet<string> = new Set(["gathering_pass", "plus_annual"]);

export function isWebSellable(canonicalProductId: string): boolean {
  return WEB_SELLABLE_PRODUCTS.has(canonicalProductId);
}

/**
 * Web checkout is open only when the release flag is on AND the processor
 * secret AND both approved price ids are configured. Half-configured reads as off.
 */
export function webCheckoutOpen(
  flag: boolean,
  env: { PAYMENT_PROCESSOR_SECRET_KEY?: string; STRIPE_PLUS_ANNUAL_PRICE_ID?: string; STRIPE_GATHERING_PASS_PRICE_ID?: string },
): boolean {
  return Boolean(
    flag &&
      env.PAYMENT_PROCESSOR_SECRET_KEY &&
      env.STRIPE_PLUS_ANNUAL_PRICE_ID &&
      env.STRIPE_GATHERING_PASS_PRICE_ID,
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Parses WEB_CHECKOUT_TESTER_USER_IDS: comma-separated account ids. Anything that is not a UUID is ignored; capped at 3. */
export function parseTesterIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => UUID_RE.test(v))
    .slice(0, 3);
}

/**
 * Checkout availability for ONE signed-in user. Public checkout (flag on) behaves exactly as before.
 * With the flag OFF, a user whose account id is listed in WEB_CHECKOUT_TESTER_USER_IDS may check out,
 * but only when the processor secret and both approved price ids are configured. No list = closed for everyone.
 */
export function checkoutOpenFor(
  flag: boolean,
  env: { PAYMENT_PROCESSOR_SECRET_KEY?: string; STRIPE_PLUS_ANNUAL_PRICE_ID?: string; STRIPE_GATHERING_PASS_PRICE_ID?: string },
  userId: string | null | undefined,
  testerIdsRaw: string | undefined,
): boolean {
  if (webCheckoutOpen(flag, env)) return true;
  const configured = Boolean(
    env.PAYMENT_PROCESSOR_SECRET_KEY && env.STRIPE_PLUS_ANNUAL_PRICE_ID && env.STRIPE_GATHERING_PASS_PRICE_ID,
  );
  if (!configured || !userId) return false;
  return parseTesterIds(testerIdsRaw).includes(userId.trim().toLowerCase());
}
