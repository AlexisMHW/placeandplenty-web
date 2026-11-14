// A7 entitlement / billing-rules matrix over the PURE web resolvers. Local, no network. Database-decided rules (open-gathering caps 1/6, Plus
// 12 lock-ins, Gather Again, archive) are NOT executable without the production schema: listed in docs/payments/ENTITLEMENT_MATRIX_A7.md as NOT TESTED.
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarise, isLive, type Entitlement } from "../lib/entitlements.ts";
import { isWebSellable, checkoutOpenFor } from "../lib/checkout-gate.ts";
import { isReadOnlyStatus } from "../lib/gathering-readonly.ts";

const NOW = new Date("2026-11-14T12:00:00Z");
const base = { active: true, purchased_at: "2026-11-01T00:00:00Z", expires_at: null, consumed_at: null, refunded_at: null, revoked_at: null, provider: "web", source: null, provider_customer_id: null } as const;
const pass = (o: Partial<Entitlement> = {}): Entitlement => ({ ...base, id: "p", entitlement_type: "gathering_pass", canonical_product_id: "gathering_pass", scope: "gathering", gathering_id: "g1", ...o });
const plus = (o: Partial<Entitlement> = {}): Entitlement => ({ ...base, id: "pl", entitlement_type: "plus", canonical_product_id: "plus_annual", scope: "account", gathering_id: null, expires_at: "2027-11-01T00:00:00Z", ...o });
const multi = (o: Partial<Entitlement> = {}): Entitlement => ({ ...base, id: "md", entitlement_type: "gathering_pass", canonical_product_id: "multi_day_pass", scope: "gathering", gathering_id: "g2", ...o });
const tier = (es: Entitlement[]) => summarise(es, NOW).tier;

test("Free: no entitlements", () => assert.equal(tier([]), "Free"));
test("Gathering Pass -> Gathering Pass, never expires", () => { assert.equal(tier([pass()]), "Gathering Pass"); assert.equal(summarise([pass()], new Date("2040-01-01")).tier, "Gathering Pass"); });
test("Plus -> Plus; Plus outranks a Pass", () => { assert.equal(tier([plus()]), "Place & Plenty Plus"); assert.equal(tier([pass(), plus()]), "Place & Plenty Plus"); });
test("Multi-Day pass counts as a gathering pass tier", () => assert.equal(tier([multi()]), "Gathering Pass"));
test("Plus after Gathering Pass: both rows live, tier Plus, pass preserved", () => { const s = summarise([pass(), plus()], NOW); assert.equal(s.passes.length, 1); assert.ok(s.plus); });
test("refund removes access", () => { assert.equal(tier([pass({ refunded_at: "2026-11-10T00:00:00Z" })]), "Free"); assert.equal(tier([plus({ refunded_at: "2026-11-10T00:00:00Z" })]), "Free"); });
test("revoked (e.g. lost dispute) removes access", () => assert.equal(tier([plus({ revoked_at: "2026-11-12T00:00:00Z" })]), "Free"));
test("inactive row grants nothing", () => assert.equal(tier([pass({ active: false })]), "Free"));
test("cancelled subscription keeps access until the paid term ends, then drops", () => {
  const e = plus({ expires_at: "2026-11-20T00:00:00Z" }); // cancel_at_period_end: row stays, expiry unchanged
  assert.equal(isLive(e, NOW), true); assert.equal(isLive(e, new Date("2026-11-20T00:00:00Z")), false); assert.equal(isLive(e, new Date("2026-11-21T00:00:00Z")), false);
});
test("renewal pushes expiry forward (live again)", () => assert.equal(isLive(plus({ expires_at: "2027-12-01T00:00:00Z" }), new Date("2027-11-15T00:00:00Z")), true));
test("co-host: another host's gathering pass never elevates the viewer's own tier", () => assert.equal(tier([]), "Free")); // co-hosts hold no entitlement row; access is per-gathering permission (cohost-permissions.test.ts)
test("passes are scoped per gathering", () => { const s = summarise([pass({ id: "a", gathering_id: "g1" }), pass({ id: "b", gathering_id: "g3" })], NOW); assert.deepEqual(s.passes.map((p) => p.gathering_id).sort(), ["g1", "g3"]); });
test("channels list provenance only", () => assert.deepEqual(summarise([pass({ provider: "apple" }), plus({ provider: "web" })], NOW).channels.sort(), ["apple", "web"]));

test("web sells only Gathering Pass and Plus; Multi-Day and extensions are closed", () => {
  assert.ok(isWebSellable("gathering_pass")); assert.ok(isWebSellable("plus_annual"));
  assert.ok(!isWebSellable("multi_day_pass")); assert.ok(!isWebSellable("multi_day_extension"));
});
test("checkout half-configured reads as closed; tester list cannot bypass missing config", () => {
  const full = { PAYMENT_PROCESSOR_SECRET_KEY: "x", STRIPE_PLUS_ANNUAL_PRICE_ID: "p", STRIPE_GATHERING_PASS_PRICE_ID: "g" };
  const uid = "11111111-1111-4111-8111-111111111111";
  assert.equal(checkoutOpenFor(true, { ...full, STRIPE_PLUS_ANNUAL_PRICE_ID: undefined }, uid, uid), false);
  assert.equal(checkoutOpenFor(false, { ...full, STRIPE_PLUS_ANNUAL_PRICE_ID: undefined }, uid, uid), false);
  assert.equal(checkoutOpenFor(false, full, uid, uid), true); assert.equal(checkoutOpenFor(false, full, "someone-else", uid), false);
});
test("read-only lifecycle (D2): completed/cancelled/archived read-only, active/draft not", () => {
  for (const s of ["completed", "cancelled", "archived"]) assert.equal(isReadOnlyStatus(s), true);
  for (const s of ["draft", "active", "upcoming", undefined, null]) assert.equal(isReadOnlyStatus(s as never), false);
});
