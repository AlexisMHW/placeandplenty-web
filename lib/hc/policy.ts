// HOSTING COLLECTIVE POLICY MATH. Pure, no imports, no I/O. The database (212xxx/214xxx) is the authority; this mirrors its rules so the
// webhook forwarder, the sweep reporter and the tests agree with it. Defaults are the owner decisions of 2026-11 (30-day attribution,
// 45-day validation, $50 minimum payout, first qualifying purchase only, new customers only). Commission AMOUNTS are NOT here: they live in
// hc_terms_amounts (owner-set, versioned) and are never invented in code.

export const HC_DEFAULTS = { attributionDays: 30, validationDays: 45, minPayoutCents: 5000 } as const;
export const QUALIFYING_PRODUCTS = ["gathering_pass", "plus"] as const; // web checkout products; Multi-Day is closed on web
export type QualifyingProduct = (typeof QUALIFYING_PRODUCTS)[number];
const DAY = 86_400_000;

export interface HcSettings { attributionDays: number; validationDays: number; minPayoutCents: number }

export const isQualifyingProduct = (p: unknown): p is QualifyingProduct => typeof p === "string" && (QUALIFYING_PRODUCTS as readonly string[]).includes(p);

/** A touch counts only if it happened within the attribution window before the account was created or the purchase made. */
export function withinAttribution(touchedAt: Date, convertedAt: Date, s: Pick<HcSettings, "attributionDays"> = HC_DEFAULTS): boolean {
  const d = convertedAt.getTime() - touchedAt.getTime();
  return d >= 0 && d <= s.attributionDays * DAY;
}

export function validationDueAt(purchasedAt: Date, s: Pick<HcSettings, "validationDays"> = HC_DEFAULTS): Date {
  return new Date(purchasedAt.getTime() + s.validationDays * DAY);
}

export type CommissionDecision =
  | { eligible: true }
  | { eligible: false; reason: "not_qualifying_product" | "outside_attribution_window" | "not_new_customer" | "not_first_qualifying_purchase" | "self_referral" | "no_attribution" };

export interface CommissionCandidate {
  product: unknown;
  hasClaim: boolean;
  touchedAt: Date | null;
  purchasedAt: Date;
  buyerWasExistingCustomerBeforeTouch: boolean;
  priorQualifyingPurchaseCount: number; // qualifying purchases by this buyer BEFORE this one
  buyerUserId: string;
  partnerUserId: string | null;
  buyerEmailNorm?: string | null;
  partnerEmailNorm?: string | null;
}

/** Same order of checks the database applies, so a disagreement is a bug in one of them. */
export function decideCommission(c: CommissionCandidate, s: HcSettings = HC_DEFAULTS): CommissionDecision {
  if (!isQualifyingProduct(c.product)) return { eligible: false, reason: "not_qualifying_product" };
  if (!c.hasClaim || !c.touchedAt) return { eligible: false, reason: "no_attribution" };
  if (c.partnerUserId && (c.partnerUserId === c.buyerUserId || (c.buyerEmailNorm && c.buyerEmailNorm === c.partnerEmailNorm))) return { eligible: false, reason: "self_referral" };
  if (!withinAttribution(c.touchedAt, c.purchasedAt, s)) return { eligible: false, reason: "outside_attribution_window" };
  if (c.buyerWasExistingCustomerBeforeTouch) return { eligible: false, reason: "not_new_customer" };
  if (c.priorQualifyingPurchaseCount > 0) return { eligible: false, reason: "not_first_qualifying_purchase" };
  return { eligible: true };
}

/** Payout eligibility: only commissions past validation, not held/refunded/disputed, and the combined total at or above the minimum. */
export interface PayableCommission { cents: number; state: "pending" | "validated" | "held" | "reversed" | "paid" | string; validatedAt?: Date | null }
export function payoutEligibility(rows: PayableCommission[], s: Pick<HcSettings, "minPayoutCents"> = HC_DEFAULTS): { totalCents: number; eligible: boolean; shortfallCents: number } {
  const total = rows.filter((r) => r.state === "validated").reduce((a, r) => a + (Number.isInteger(r.cents) && r.cents > 0 ? r.cents : 0), 0);
  return { totalCents: total, eligible: total >= s.minPayoutCents, shortfallCents: Math.max(0, s.minPayoutCents - total) };
}
