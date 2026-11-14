/**
 * Hosting Collective pilot accounting. Inputs must come from verified provider
 * events joined to canonical purchase history, never browser metadata alone.
 * This module makes no payments and grants no product entitlements.
 */
export const AFFILIATE_POLICY = Object.freeze({
  version: "2026-10-31",
  currency: "usd",
  plusCents: 1200,
  passCents: 50,
  attributionDays: 30,
  validationDays: 45,
  minimumPayoutCents: 5000,
});
const DAY = 86_400_000;

export interface Partner {
  id: string;
  ownerUserId: string;
  email: string;
  status: "pending" | "approved" | "suspended";
}
export interface Referral {
  partnerId: string;
  customerUserId: string;
  /** Server-recorded attribution, not a client-supplied time. */
  attributedAt: string;
}
export interface VerifiedPurchase {
  /** Stable provider payment ID, not webhook delivery ID. */
  id: string;
  customerUserId: string;
  customerEmail: string;
  channel: "web" | "apple" | "google";
  product: string;
  currency: string;
  /** Amount excluding sales tax, in integer minor units. */
  subtotalCents: number;
  refundedCents: number;
  paidAt: string;
  status: "paid" | "refunded" | "disputed";
  isRenewal: boolean;
  livemode: boolean;
}
export interface Commission {
  mode: "test" | "live";
  paymentId: string;
  partnerId: string;
  customerUserId: string;
  amountCents: number;
  eligibleAt: string;
  state: "pending" | "available" | "reversed";
  policyVersion: string;
}

function timestamp(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error("invalid_timestamp");
  return result;
}
function cents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid_money");
}
function email(value: string): string { return value.trim().toLowerCase(); }

/**
 * Supply COMPLETE paid history across web and stores, including refunded
 * purchases and noncommissionable products. Missing history must block the
 * adapter, not silently treat a known customer as new. Recompute on late events.
 * A refunded first purchase still consumes first-purchase eligibility.
 */
export function evaluateCommission(input: {
  partner: Partner;
  referral: Referral;
  paymentId: string;
  purchases: readonly VerifiedPurchase[];
  historyComplete: boolean;
  now: string;
  mode: "test" | "live";
}): { commission: Commission | null; reason: string } {
  if (!input.historyComplete) return { commission: null, reason: "history_incomplete" };
  const { partner, referral } = input;
  if (!partner.id || !referral.customerUserId || referral.partnerId !== partner.id)
    return { commission: null, reason: "invalid_referral" };
  if (partner.status !== "approved") return { commission: null, reason: "partner_not_approved" };
  const now = timestamp(input.now);
  const attributed = timestamp(referral.attributedAt);
  const byId = new Map<string, VerifiedPurchase>();
  for (const purchase of input.purchases) {
    if (purchase.customerUserId !== referral.customerUserId ||
        purchase.livemode !== (input.mode === "live")) continue;
    if (!purchase.id) throw new Error("missing_payment_id");
    cents(purchase.subtotalCents); cents(purchase.refundedCents);
    timestamp(purchase.paidAt);
    const prior = byId.get(purchase.id);
    // Identical webhook replays are harmless. Conflicting snapshots require
    // reconciliation with the provider before any commission can be approved.
    if (prior && JSON.stringify(prior) !== JSON.stringify(purchase))
      return { commission: null, reason: "conflicting_payment_snapshot" };
    byId.set(purchase.id, purchase);
  }
  const history = [...byId.values()].filter(p => p.subtotalCents > 0)
    .sort((a, b) => timestamp(a.paidAt) - timestamp(b.paidAt) || a.id.localeCompare(b.id));
  const payment = history.find(p => p.id === input.paymentId);
  if (!payment) return { commission: null, reason: "payment_not_found" };
  if (partner.ownerUserId === payment.customerUserId ||
      !email(partner.email) || !email(payment.customerEmail) ||
      email(partner.email) === email(payment.customerEmail))
    return { commission: null, reason: "self_referral_or_missing_identity" };
  if (history[0]?.id !== payment.id || payment.isRenewal)
    return { commission: null, reason: "not_first_purchase" };
  if (payment.channel !== "web") return { commission: null, reason: "web_only" };
  if (payment.currency.toLowerCase() !== AFFILIATE_POLICY.currency)
    return { commission: null, reason: "unsupported_currency" };
  const paid = timestamp(payment.paidAt);
  // Exactly 30 days remains attributable; future/predated events never accrue.
  if (paid < attributed || paid > now || attributed > now ||
      paid - attributed > AFFILIATE_POLICY.attributionDays * DAY)
    return { commission: null, reason: "outside_attribution_window" };
  const amount = payment.product === "plus_annual" ? AFFILIATE_POLICY.plusCents
    : payment.product === "gathering_pass" ? AFFILIATE_POLICY.passCents : 0;
  if (!amount) return { commission: null, reason: "unsupported_product" };
  if (payment.subtotalCents < amount)
    return { commission: null, reason: "insufficient_collected_revenue" };
  const eligible = paid + AFFILIATE_POLICY.validationDays * DAY;
  const reversed = payment.status !== "paid" || payment.refundedCents > 0;
  return {
    reason: reversed ? "refund_or_dispute" : now < eligible ? "validation_hold" : "eligible",
    commission: {
      mode: input.mode,
      paymentId: payment.id, partnerId: partner.id,
      customerUserId: payment.customerUserId, amountCents: amount,
      eligibleAt: new Date(eligible).toISOString(),
      state: reversed ? "reversed" : now < eligible ? "pending" : "available",
      policyVersion: AFFILIATE_POLICY.version,
    },
  };
}

/** A preview for MANUAL approval, never a payment instruction. */
export function previewPayout(partner: Partner, commissions: readonly Commission[],
  alreadySettledPaymentIds: readonly string[], now: string, mode: "test" | "live" = "test") {
  const current = timestamp(now);
  const settled = new Set(alreadySettledPaymentIds);
  const seen = new Set<string>();
  const snapshots = new Map<string, string>();
  for (const c of commissions) {
    if (c.partnerId !== partner.id || c.mode !== mode) continue;
    const prior = snapshots.get(c.paymentId);
    if (prior && prior !== JSON.stringify(c)) throw new Error("conflicting_commission_snapshot");
    snapshots.set(c.paymentId, JSON.stringify(c));
  }
  const eligible = commissions.filter(c => {
    cents(c.amountCents);
    if (!c.paymentId || c.mode !== mode || c.partnerId !== partner.id || c.state !== "available" ||
        c.policyVersion !== AFFILIATE_POLICY.version ||
        timestamp(c.eligibleAt) > current || settled.has(c.paymentId) || seen.has(c.paymentId)) return false;
    seen.add(c.paymentId);
    return true;
  });
  const availableCents = eligible.reduce((sum, c) => sum + c.amountCents, 0);
  if (!Number.isSafeInteger(availableCents)) throw new Error("invalid_money");
  return {
    availableCents,
    paymentIds: eligible.map(c => c.paymentId),
    readyForManualApproval: partner.status === "approved" &&
      availableCents >= AFFILIATE_POLICY.minimumPayoutCents,
  };
}
