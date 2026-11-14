import test from "node:test";
import assert from "node:assert/strict";
import { checkoutOpenFor, isWebSellable, parseTesterIds, webCheckoutOpen, WEB_SELLABLE_PRODUCTS } from "../lib/checkout-gate.ts";

const full = { PAYMENT_PROCESSOR_SECRET_KEY: "k", STRIPE_PLUS_ANNUAL_PRICE_ID: "p1", STRIPE_GATHERING_PASS_PRICE_ID: "p2" };

test("only Gathering Pass and Plus annual are sellable on the web", () => {
  assert.deepEqual([...WEB_SELLABLE_PRODUCTS].sort(), ["gathering_pass", "plus_annual"]);
  assert.equal(isWebSellable("gathering_pass"), true);
  assert.equal(isWebSellable("plus_annual"), true);
  for (const id of ["multi_day_pass", "multi_day_extension", "founder_unlimited", "", "plus"]) assert.equal(isWebSellable(id), false, id);
});
test("checkout is open only with the flag AND the secret AND both approved price ids", () => {
  assert.equal(webCheckoutOpen(true, full), true);
  assert.equal(webCheckoutOpen(false, full), false, "flag off wins over env");
  assert.equal(webCheckoutOpen(true, { ...full, PAYMENT_PROCESSOR_SECRET_KEY: "" }), false);
  assert.equal(webCheckoutOpen(true, { ...full, STRIPE_PLUS_ANNUAL_PRICE_ID: undefined }), false);
  assert.equal(webCheckoutOpen(true, { ...full, STRIPE_GATHERING_PASS_PRICE_ID: "" }), false);
  assert.equal(webCheckoutOpen(true, {}), false);
});

const T1 = "5a7ede75-1612-437d-b736-8911f54c180f";
const T2 = "11111111-2222-3333-4444-555555555555";
test("tester gate: flag off + no tester list = closed for everyone, including anonymous", () => {
  assert.equal(checkoutOpenFor(false, full, T1, undefined), false);
  assert.equal(checkoutOpenFor(false, full, T1, ""), false);
  assert.equal(checkoutOpenFor(false, full, null, T1), false);
});
test("tester gate: only the listed account passes while the flag is off", () => {
  assert.equal(checkoutOpenFor(false, full, T1, T1), true);
  assert.equal(checkoutOpenFor(false, full, T1.toUpperCase(), ` ${T1} `), true, "case/space tolerant");
  assert.equal(checkoutOpenFor(false, full, T2, T1), false, "another account stays closed");
  assert.equal(checkoutOpenFor(false, full, T2, `${T1},${T2}`), true);
});
test("tester gate: never bypasses missing processor or price configuration", () => {
  assert.equal(checkoutOpenFor(false, { ...full, PAYMENT_PROCESSOR_SECRET_KEY: "" }, T1, T1), false);
  assert.equal(checkoutOpenFor(false, { ...full, STRIPE_PLUS_ANNUAL_PRICE_ID: undefined }, T1, T1), false);
  assert.equal(checkoutOpenFor(false, { ...full, STRIPE_GATHERING_PASS_PRICE_ID: "" }, T1, T1), false);
  assert.equal(checkoutOpenFor(false, {}, T1, T1), false);
});
test("tester gate: junk list entries are ignored, list is capped, public behaviour unchanged", () => {
  assert.deepEqual(parseTesterIds("*, all, true, 123, " + T1), [T1]);
  assert.equal(checkoutOpenFor(false, full, "*", "*"), false);
  assert.equal(parseTesterIds(Array.from({ length: 6 }, (_, i) => `0000000${i}-2222-3333-4444-555555555555`).join(",")).length, 3);
  assert.equal(checkoutOpenFor(true, full, null, undefined), true, "flag on = open to the public as before");
  assert.equal(checkoutOpenFor(true, { ...full, PAYMENT_PROCESSOR_SECRET_KEY: "" }, T1, T1), false);
});
