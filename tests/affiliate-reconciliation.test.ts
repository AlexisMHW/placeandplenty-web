import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileAffiliatePayment } from '../lib/affiliate-reconciliation.ts';

const base = {
  partner: { id: 'partner', ownerUserId: 'owner', email: 'owner@example.test', status: 'approved' as const },
  referral: { partnerId: 'partner', customerUserId: 'buyer', attributedAt: '2026-10-01T00:00:00Z' },
  paymentId: 'payment', historyComplete: true, vendorHistoryComplete: true,
  now: '2026-11-15T00:00:00Z', mode: 'test' as const,
  purchases: [{ id: 'payment', customerUserId: 'buyer', customerEmail: 'buyer@example.test', channel: 'web' as const,
    product: 'plus_annual', currency: 'usd', subtotalCents: 5999, refundedCents: 0,
    paidAt: '2026-10-01T00:00:00Z', status: 'paid' as const, isRenewal: false, livemode: false }],
  vendorCommissions: [{ id: 'commission', paymentId: 'payment', partnerId: 'partner', mode: 'test' as const,
    currency: 'usd', amountCents: 1200, status: 'unpaid' as const }],
};
test('matching provider commission opens only at the exact 45-day boundary', () => {
  assert.equal(reconcileAffiliatePayment({ ...base, now: '2026-11-14T23:59:59Z' }).payoutAllowed, false);
  assert.equal(reconcileAffiliatePayment(base).payoutAllowed, true);
});
test('wrong amount, duplicate, missing and incomplete vendor records block payout', () => {
  assert.equal(reconcileAffiliatePayment({ ...base, vendorHistoryComplete: false }).reason, 'vendor_history_incomplete');
  assert.equal(reconcileAffiliatePayment({ ...base, vendorCommissions: [] }).reason, 'missing_vendor_commission');
  assert.equal(reconcileAffiliatePayment({ ...base, vendorCommissions: [...base.vendorCommissions, ...base.vendorCommissions] }).reason, 'duplicate_vendor_commission');
  assert.equal(reconcileAffiliatePayment({ ...base, vendorCommissions: [{ ...base.vendorCommissions[0], amountCents: 50 }] }).reason, 'vendor_commission_mismatch');
});
test('refunds flag unpaid records for voiding and paid records for recovery', () => {
  const purchases = [{ ...base.purchases[0], refundedCents: 1 }];
  assert.equal(reconcileAffiliatePayment({ ...base, purchases }).reason, 'void_vendor_commission');
  assert.equal(reconcileAffiliatePayment({ ...base, purchases, vendorCommissions: [{ ...base.vendorCommissions[0], status: 'paid' }] }).reason, 'recover_paid_commission');
});
test('paid, wrong partner, foreign currency and incomplete purchase history cannot pass', () => {
  for (const patch of [{ status: 'paid' as const }, { partnerId: 'other' }, { currency: 'eur' }])
    assert.equal(reconcileAffiliatePayment({ ...base, vendorCommissions: [{ ...base.vendorCommissions[0], ...patch }] }).payoutAllowed, false);
  assert.equal(reconcileAffiliatePayment({ ...base, historyComplete: false }).payoutAllowed, false);
});
