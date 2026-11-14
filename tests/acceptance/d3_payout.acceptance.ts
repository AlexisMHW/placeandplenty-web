// D3 (founder): payouts are MANUAL. pending -> validated -> approved -> paid are separate; approved != paid; "paid" only RECORDS an external
// payment (reference + explicit confirmation); never auto-transfer; voiding/clawbacks supported; history + audit. DB behaviour: docs/qa/sql/d3_payout_state.acceptance.sql.
import test from "node:test";
import assert from "node:assert/strict";
import { read, walk } from "./helpers.ts";
import { parsePayoutActionForm } from "../../lib/admin/cc.ts";

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
const ID = "123e4567-e89b-42d3-a456-426614174000";

test("D3: the only expressible payout operations are draft, approve, paid(record), void", () => {
  for (const kind of ["transfer", "send", "pay", "payout_now", "stripe_transfer", "ach", ""]) assert.equal(parsePayoutActionForm(form({ kind, payout_id: ID })).ok, false, kind);
});
test("D3: approve carries no payment reference and cannot mark anything paid", () => {
  const r = parsePayoutActionForm(form({ kind: "approve", payout_id: ID, external_ref: "bank-123", confirm: "yes" }));
  assert.ok(r.ok); assert.deepEqual(r.value, { kind: "approve", payoutId: ID });
});
test("D3: recording paid requires an external reference AND an explicit confirmation that the payment happened", () => {
  assert.deepEqual(parsePayoutActionForm(form({ kind: "paid", payout_id: ID })), { ok: false, error: "invalid_reference" });
  assert.deepEqual(parsePayoutActionForm(form({ kind: "paid", payout_id: ID, external_ref: "ab" })), { ok: false, error: "invalid_reference" });
  assert.deepEqual(parsePayoutActionForm(form({ kind: "paid", payout_id: ID, external_ref: "bank-ref-77" })), { ok: false, error: "confirmation_required" });
  assert.deepEqual(parsePayoutActionForm(form({ kind: "paid", payout_id: ID, external_ref: "bank-ref-77", confirm: "no" })), { ok: false, error: "confirmation_required" });
  const ok = parsePayoutActionForm(form({ kind: "paid", payout_id: ID, external_ref: "bank-ref-77", confirm: "yes" }));
  assert.ok(ok.ok);
});
test("D3: void needs a reason (reversal/clawback trail)", () => {
  assert.equal(parsePayoutActionForm(form({ kind: "void", payout_id: ID })).ok, false);
  assert.equal(parsePayoutActionForm(form({ kind: "void", payout_id: ID, reason: "wrong amount" })).ok, true);
});
test("D3: no code path in the web app moves money (no transfer/payout API calls, no payment-provider payout endpoints)", () => {
  const files = [...walk("app/(command-center)"), ...walk("lib/hc"), ...walk("lib/admin")];
  const bad = files.filter((f) => /(stripe\.transfers|stripe\.payouts|\/v1\/transfers|\/v1\/payouts|paypal.*payouts|plaid|dwolla|wise\.com)/i.test(read(f)));
  assert.deepEqual(bad, []);
});
test("D3: the payouts screen labels draft, approved and paid distinctly and states that nothing is sent automatically", () => {
  const s = read("app/(command-center)/command-center/hosting-collective/payouts/page.tsx");
  for (const w of [/draft/i, /approved?/i, /paid/i]) assert.match(s, w);
  assert.match(s, /(record|recorded|outside|manual|elsewhere)/i, "screen must say a paid mark only records an external payment");
});
test("D3: the paid form submits an explicit confirmation field", () => {
  const s = read("app/(command-center)/command-center/hosting-collective/payouts/page.tsx");
  assert.match(s, /name="confirm"/, "the 'mark paid' form has no confirm control, so confirmation_required can never be satisfied in the UI");
});
