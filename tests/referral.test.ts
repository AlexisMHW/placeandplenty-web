import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../lib/referral.ts';
import { claimReferralFromCookie } from '../lib/claimReferral.ts';
const D = 86_400_000, now = Date.UTC(2026, 10, 13);
test('normalizeCode', () => { assert.equal(h.normalizeCode(' Creator-One '), 'creator-one'); assert.equal(h.normalizeCode('a'), null); assert.equal(h.normalizeCode('bad code!'), null); assert.equal(h.normalizeCode(null), null); });
test('cookie roundtrip', () => { const v = h.buildCookieValue({ code: 'abc-1', touchedAt: now }); assert.deepEqual(h.parseCookieValue(v, now), { code: 'abc-1', touchedAt: now }); });
test('expired after 30d / future rejected / garbage rejected', () => {
  assert.equal(h.parseCookieValue(h.buildCookieValue({ code: 'abc', touchedAt: now - 31 * D }), now), null);
  assert.ok(h.parseCookieValue(h.buildCookieValue({ code: 'abc', touchedAt: now - 29 * D }), now));
  assert.equal(h.parseCookieValue(h.buildCookieValue({ code: 'abc', touchedAt: now + D }), now), null);
  for (const g of ['', 'abc', '.123', 'abc.x', 'ab!.123']) assert.equal(h.parseCookieValue(g, now), null);
});
test('first-touch wins; expired cookie is replaced', () => {
  const first = h.buildCookieValue({ code: 'first', touchedAt: now - 5 * D });
  assert.equal(h.nextTouch(first, 'second', now)?.code, 'first');
  const old = h.buildCookieValue({ code: 'first', touchedAt: now - 40 * D });
  assert.equal(h.nextTouch(old, 'second', now)?.code, 'second');
  assert.equal(h.nextTouch(null, 'bad code', now), null);
});
const V1 = h.DEFAULT_TERMS;
test('fixed amounts: $9.99 pass -> 50c, $59.99 plus -> 1200c, Multi-Day excluded', () => {
  assert.equal(h.snapshotCommission([V1], 'gathering_pass', now)!.amountCents, 50);
  assert.equal(h.snapshotCommission([V1], 'plus_annual', now)!.amountCents, 1200);
  assert.equal(h.snapshotCommission([V1], 'multi_day_pass', now), null);
  assert.equal(h.snapshotCommission([V1], 'multi_day_extension', now), null);
  assert.equal(h.isCommissionableProduct('plus_annual'), true);
});
test('terms snapshot is frozen and later versions never change an earlier commission', () => {
  const snap = h.snapshotCommission([V1], 'gathering_pass', now)!;
  const V2 = { version: 2, effectiveFrom: now + D, validationDays: 60, minPayoutCents: 10000, amounts: { gathering_pass: 100, plus_annual: 2000 } };
  assert.equal(h.snapshotCommission([V1, V2], 'gathering_pass', now)!.amountCents, 50);          // purchase before change: v1
  assert.equal(h.snapshotCommission([V1, V2], 'gathering_pass', now + 2 * D)!.amountCents, 100);  // after: v2
  assert.equal(h.snapshotCommission([V1, V2], 'gathering_pass', now + 2 * D)!.validationDays, 60);
  assert.equal(snap.amountCents, 50);
  assert.throws(() => { 'use strict'; (snap as { amountCents: number }).amountCents = 999; }, TypeError);
  assert.equal(h.termsInForce([V1, V2], now)!.version, 1);
  assert.equal(h.snapshotCommission([{ ...V1, amounts: { plus_annual: 1200 } }], 'gathering_pass', now), null);   // product row missing -> no invented amount
});
test('first paid purchase only (renewals, upgrades, repeats earn nothing)', () => { assert.equal(h.isFirstPaidPurchase(0), true); assert.equal(h.isFirstPaidPurchase(1), false); });
test('validation hold 45 days from the snapshot, fee not needed', () => {
  const s = h.snapshotCommission([V1], 'plus_annual', now)!;
  assert.equal(h.isValidatable(s, now + 44 * D), false); assert.equal(h.isValidatable(s, now + 45 * D), true);
});
test('$50 combined balance across products', () => {
  const plus = h.snapshotCommission([V1], 'plus_annual', now)!, pass = h.snapshotCommission([V1], 'gathering_pass', now)!;
  const four = [plus, plus, plus, plus];
  assert.deepEqual(h.payoutDecision(four), { total: 4800, min: 5000, eligible: false });
  assert.equal(h.payoutDecision([...four, pass, pass, pass]).eligible, false);       // 4950
  assert.deepEqual(h.payoutDecision([...four, pass, pass, pass, pass]), { total: 5000, min: 5000, eligible: true });
  assert.equal(h.payoutDecision([]).eligible, false);
});
test('claim helper: final outcomes clear cookie, errors keep it', async () => {
  const v = h.buildCookieValue({ code: 'abc', touchedAt: now });
  const ok = await claimReferralFromCookie(v, async () => ({ data: { status: 'claimed' }, error: null }), now);
  assert.deepEqual(ok, { clear: true, status: 'claimed' });
  const err = await claimReferralFromCookie(v, async () => ({ data: null, error: {} }), now);
  assert.equal(err.clear, false);
  const dis = await claimReferralFromCookie(v, async () => ({ data: { status: 'disabled' }, error: null }), now);
  assert.equal(dis.clear, false);
  let called = false;
  const none = await claimReferralFromCookie(undefined, async () => { called = true; return { data: null, error: null }; }, now);
  assert.equal(called, false); assert.equal(none.status, 'no_touch');
});
