import { test } from "node:test";
import assert from "node:assert/strict";
import { HC_DEFAULTS, decideCommission, payoutEligibility, validationDueAt, withinAttribution } from "../lib/hc/policy.ts";
import { planLedgerCalls, ledgerWiringEnabled } from "../lib/hc/ledger.ts";
import { reconcileLedger } from "../lib/hc/reconcile.ts";
import { applicationApprovedMessage, applicationDeclinedMessage } from "../lib/hc/notifications.ts";
import { brandReadiness } from "../lib/hc/brand-readiness.ts";

const d = (s: string) => new Date(s);
const base = { product: "gathering_pass", hasClaim: true, touchedAt: d("2026-11-01"), purchasedAt: d("2026-11-10"), buyerWasExistingCustomerBeforeTouch: false, priorQualifyingPurchaseCount: 0, buyerUserId: "b", partnerUserId: "p" };

test("defaults match the owner decisions", () => assert.deepEqual({ ...HC_DEFAULTS }, { attributionDays: 30, validationDays: 45, minPayoutCents: 5000 }));
test("attribution window: day 30 counts, day 31 and a touch after purchase do not", () => {
  assert.ok(withinAttribution(d("2026-10-11"), d("2026-11-10")));
  assert.ok(!withinAttribution(d("2026-10-10"), d("2026-11-10")));
  assert.ok(!withinAttribution(d("2026-11-11"), d("2026-11-10")));
});
test("validation is due 45 days after purchase", () => assert.equal(validationDueAt(d("2026-11-10T00:00:00Z")).toISOString(), "2026-12-25T00:00:00.000Z"));
test("a normal first purchase by a new customer is eligible", () => assert.deepEqual(decideCommission(base), { eligible: true }));
for (const [label, patch, reason] of [
  ["multi-day product", { product: "multi_day" }, "not_qualifying_product"],
  ["no claim", { hasClaim: false }, "no_attribution"],
  ["old touch", { touchedAt: d("2026-09-01") }, "outside_attribution_window"],
  ["existing customer", { buyerWasExistingCustomerBeforeTouch: true }, "not_new_customer"],
  ["second qualifying purchase (Plus after a Pass)", { product: "plus", priorQualifyingPurchaseCount: 1 }, "not_first_qualifying_purchase"],
  ["self referral by id", { partnerUserId: "b" }, "self_referral"],
  ["self referral by email", { buyerEmailNorm: "a@x.com", partnerEmailNorm: "a@x.com" }, "self_referral"],
] as const) test(`not eligible: ${label}`, () => assert.deepEqual(decideCommission({ ...base, ...patch }), { eligible: false, reason }));

test("payout: only validated rows count, $50 minimum", () => {
  assert.deepEqual(payoutEligibility([{ cents: 3000, state: "validated" }, { cents: 2000, state: "validated" }]), { totalCents: 5000, eligible: true, shortfallCents: 0 });
  assert.deepEqual(payoutEligibility([{ cents: 4999, state: "validated" }, { cents: 9000, state: "held" }, { cents: 9000, state: "pending" }]), { totalCents: 4999, eligible: false, shortfallCents: 1 });
});

const purchase = { kind: "purchase", entitlementId: "e1", providerTransactionId: "t1", product: "plus", currency: "USD", subtotalCents: 5999, taxCents: 0, feeCents: 200, stripeCustomerId: null, paymentFingerprintHash: "h" } as const;
test("ledger plan: purchase records facts then reconciles, in that order", () => {
  const p = planLedgerCalls(purchase);
  assert.ok(p.ok); if (p.ok) { assert.deepEqual(p.calls.map((c) => c.rpc), ["record_purchase_facts", "reconcile_commission_for_entitlement"]); assert.equal(p.calls[0].args.p_currency, "usd"); }
});
test("ledger plan: refuses non-qualifying products, bad amounts and missing ids", () => {
  assert.deepEqual(planLedgerCalls({ ...purchase, product: "multi_day" }), { ok: false, reason: "not_qualifying_product" });
  assert.deepEqual(planLedgerCalls({ ...purchase, subtotalCents: -1 }), { ok: false, reason: "invalid_amounts" });
  assert.deepEqual(planLedgerCalls({ ...purchase, entitlementId: "" }), { ok: false, reason: "missing_ids" });
});
test("ledger plan: dispute, refund (never reverses by itself) and sweep", () => {
  assert.deepEqual(planLedgerCalls({ kind: "dispute", providerTransactionId: "t1", status: "open" }), { ok: true, calls: [{ rpc: "record_purchase_dispute", args: { p_provider_transaction_id: "t1", p_status: "open" } }] });
  const r = planLedgerCalls({ kind: "refund", entitlementId: "e1", providerTransactionId: "t1", partial: true });
  assert.ok(r.ok && r.calls.length === 1 && r.calls[0].rpc === "reconcile_commission_for_entitlement");
  assert.deepEqual(planLedgerCalls({ kind: "sweep" }), { ok: true, calls: [{ rpc: "sweep_commissions", args: {} }] });
});
test("wiring is off unless the flag is exactly true", () => { assert.ok(!ledgerWiringEnabled({})); assert.ok(!ledgerWiringEnabled({ HC_LEDGER_WIRING_ENABLED: "1" })); assert.ok(ledgerWiringEnabled({ HC_LEDGER_WIRING_ENABLED: "true" })); });

test("reconcile finds duplicates, orphans, unreversed refunds, open disputes and bad amounts", () => {
  const r = reconcileLedger(
    [{ entitlementId: "a", providerTransactionId: "t", subtotalCents: 1, refundedAt: "2026-11-01" }, { entitlementId: "b", providerTransactionId: "t2", subtotalCents: 1, disputeStatus: "open" }, { entitlementId: "c", providerTransactionId: "t3", subtotalCents: 1 }],
    [{ entitlementId: "a", state: "validated", cents: 500 }, { entitlementId: "b", state: "validated", cents: 500 }, { entitlementId: "c", state: "pending", cents: 500 }, { entitlementId: "c", state: "pending", cents: 500 }, { entitlementId: "z", state: "pending", cents: 0 }]);
  assert.deepEqual(r.counts, { refunded_but_not_reversed: 1, dispute_open_not_held: 1, duplicate_commission: 1, commission_without_fact: 1, negative_or_zero_amount: 1 });
  assert.deepEqual(reconcileLedger([], []).findings, []);
});

test("notification templates carry no money, rate, tax or legal wording", () => {
  const a = applicationApprovedMessage("Sam\nInjected", "https://placeandplenty.com/creator");
  const dcl = applicationDeclinedMessage("Sam", "Not a fit this season");
  for (const m of [a, dcl]) { assert.ok(!/\$|%|commission|rate|tax|payout|contract|exclusive/i.test(m.text), m.text); assert.ok(!/[\r\n]/.test(m.subject)); }
  assert.match(a.text, /^Hi Sam Injected,/);
  assert.match(dcl.text, /Not a fit this season/);
});

test("brand readiness lists exactly what is missing", () => {
  const empty = brandReadiness({ approved: false, platforms: 0, niches: 0, audienceSummary: "", collaborationInterest: 0, hasApprovedContent: false, hasUsagePermission: false, disclosureAcknowledged: false });
  assert.ok(!empty.ready); assert.equal(empty.missing.length, 7);
  const ok = brandReadiness({ approved: true, platforms: 1, niches: 1, audienceSummary: "Home cooks who host monthly.", collaborationInterest: 1, hasApprovedContent: true, hasUsagePermission: false, disclosureAcknowledged: true });
  assert.ok(ok.ready); assert.deepEqual(ok.missing, []);
});

test("A7: canonical web product id plus_annual qualifies (was silently skipped before); multi_day_pass does not", () => {
  assert.equal(planLedgerCalls({ ...purchase, product: "plus_annual" }).ok, true);
  assert.equal(planLedgerCalls({ ...purchase, product: "multi_day_pass" }).ok, false);
});
