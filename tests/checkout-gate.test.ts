import test from "node:test";
import assert from "node:assert/strict";
import { isWebSellable, webCheckoutOpen, WEB_SELLABLE_PRODUCTS } from "../lib/checkout-gate.ts";

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
