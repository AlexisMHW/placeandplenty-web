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
