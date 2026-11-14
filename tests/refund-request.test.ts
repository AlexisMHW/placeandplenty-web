import test from "node:test";
import assert from "node:assert/strict";
import { refundRequestMailto, SUPPORT_EMAIL } from "../lib/refund-request.ts";

test("refund request mailto goes to the existing support mailbox and carries no payment details", () => {
  const url = refundRequestMailto("plus", "2026-11-14T15:24:02.496+00:00", "88a6e4e1-5504-403c-aa4a-fee60d06498e");
  assert.ok(url.startsWith(`mailto:${SUPPORT_EMAIL}?`));
  const body = decodeURIComponent(url.split("body=")[1]);
  assert.match(body, /Place & Plenty Plus/);
  assert.match(body, /2026-11-14/);
  assert.match(body, /88a6e4e1-5504-403c-aa4a-fee60d06498e/);
  assert.match(body, /do not include card numbers/i);
  assert.equal(/pi_|sub_|cus_|in_|ch_|sk_|rk_/.test(body), false, "no payment-provider ids or keys");
  assert.match(decodeURIComponent(url.split("subject=")[1].split("&")[0]), /Refund request: Place & Plenty Plus/);
});

test("refund request for a Gathering Pass names the pass and does not promise a refund", () => {
  const url = refundRequestMailto("gathering_pass", "not-a-date", "abc");
  const body = decodeURIComponent(url.split("body=")[1]);
  assert.match(body, /Gathering Pass/);
  assert.match(body, /request a review/i);
  assert.equal(/will be refunded|guarantee/i.test(body), false);
});
