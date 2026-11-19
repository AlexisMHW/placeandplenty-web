import { AFFILIATE_POLICY, evaluateCommission, type Partner, type Referral, type VerifiedPurchase } from './affiliate-policy.ts';

/** Provider snapshots must be retrieved server-side, with complete pagination. */
export interface VendorCommission {
  id: string;
  paymentId: string;
  partnerId: string;
  mode: 'test' | 'live';
  currency: string;
  amountCents: number;
  status: 'unpaid' | 'paid';
}

/** Read-only reconciliation. Never creates provider commissions or sends money. */
export function reconcileAffiliatePayment(input: {
  partner: Partner;
  referral: Referral;
  paymentId: string;
  purchases: readonly VerifiedPurchase[];
  historyComplete: boolean;
  now: string;
  mode: 'test' | 'live';
  vendorHistoryComplete: boolean;
  vendorCommissions: readonly VendorCommission[];
}) {
  const blocked = (reason: string) => ({ reason, payoutAllowed: false, expectedCents: null as number | null });
  if (!input.vendorHistoryComplete) return blocked('vendor_history_incomplete');
  const rows = input.vendorCommissions.filter(c => c.paymentId === input.paymentId && c.mode === input.mode);
  if (rows.some(c => !c.id || !Number.isSafeInteger(c.amountCents) || c.amountCents < 0 || !['unpaid', 'paid'].includes(c.status)))
    return blocked('invalid_vendor_snapshot');
  // Duplicate API rows and multiple distinct commissions both require reconciliation.
  if (rows.length > 1) return blocked('duplicate_vendor_commission');
  const evaluation = evaluateCommission(input);
  if (evaluation.reason === 'history_incomplete' || evaluation.reason === 'conflicting_payment_snapshot')
    return blocked(evaluation.reason);
  const expected = evaluation.commission;
  const vendor = rows[0];
  if (!expected || expected.state === 'reversed') {
    return { reason: vendor ? (vendor.status === 'paid' ? 'recover_paid_commission' : 'void_vendor_commission') : evaluation.reason,
      payoutAllowed: false, expectedCents: 0 };
  }
  if (!vendor) return { reason: 'missing_vendor_commission', payoutAllowed: false, expectedCents: expected.amountCents };
  if (vendor.partnerId !== expected.partnerId || vendor.currency.toLowerCase() !== AFFILIATE_POLICY.currency ||
      vendor.amountCents !== expected.amountCents)
    return { reason: vendor.status === 'paid' ? 'review_paid_mismatch' : 'vendor_commission_mismatch',
      payoutAllowed: false, expectedCents: expected.amountCents };
  if (vendor.status === 'paid') return { reason: 'already_paid', payoutAllowed: false, expectedCents: expected.amountCents };
  return { reason: expected.state === 'available' ? 'reconciled' : 'validation_hold',
    payoutAllowed: expected.state === 'available', expectedCents: expected.amountCents };
}
