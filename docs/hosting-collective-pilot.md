# Place & Plenty Hosting Collective — controlled pilot

Approved October 31, 2026. Community language: welcoming, achievable, enjoyable gathering. No founding-member language or invented program history.

## Approved commercial configuration

| Setting | Value |
| --- | --- |
| Plus annual, initial qualifying payment | USD 12.00 |
| Gathering Pass, initial qualifying payment | USD 0.50 |
| Commission calculation | Fixed amount; exclude tax; accrue each sale |
| Qualifying customer | First paid purchase across the canonical customer history; Free-to-paid qualifies |
| Qualifying channel | Website only |
| Attribution window | 30 days |
| Validation hold | 45 days from payment |
| Minimum combined payout balance | USD 50.00 |
| Partner entry | Manual approval |
| Renewals / later upgrades | No commission |
| Customer discount | None |
| Refund / dispute | Exclude/reverse; unresolved disputes cannot enter payouts |

The implementation conservatively holds the entire commission for any partial refund pending reconciliation. It does not reassign first-purchase eligibility after a refund. These operational choices require confirmation in the final published terms before accepting partners.

## Implemented in this branch

`lib/affiliate-policy.ts` evaluates normalized, authoritative purchase history and previews manual payouts. It uses integer cents, stable payment IDs, explicit test/live separation, deterministic ordering and a policy version. Tests cover attribution and validation boundaries, free-to-paid conversion, later upgrades, prior mobile purchases, refunds/disputes, self-referrals, replay/conflicting events, incomplete history and combined payout balances.

This is accounting logic, NOT deployed referral tracking or a payment integration. No application is collecting data, no tracking cookie/script is installed, no payout service is activated, and no production checkout/backend code is changed. Canva PR #26 is untouched.

## Provider configuration and integration gate

PromoteKit is connected to Stripe in the P&P workspace. Pro trial is verified active through November 14, 2026, renewing at USD 39/month. Manual payouts, USD, portal subdomain placeandplenty, and self-referral detection are saved. No campaign has been created and no tracking is live. Its documentation supports fixed/product-specific commissions and Stripe refund adjustment, but its default campaign behavior alone must not establish eligibility. First-purchase eligibility must cover prior native and unsupported-product purchases too; the vendor's first subscription payment is not necessarily the customer's first paid purchase.

Before implementing the production adapter, obtain the actual campaign identifiers and verify a sandbox account can enforce the approved rules. Keep automatic payouts disabled. Preserve the existing entitlement webhook as authoritative; never mint entitlements from affiliate callbacks.

1. Create/reuse the correct P&P vendor workspace, review its commercial plan, and create a test campaign. Accepting vendor terms or buying software requires the owner's action-time approval.
2. Configure partner approval, 30-day attribution, two fixed product rates, first-payment limits, 45-day validation, $50 minimum and no coupon. Check actual capability instead of assuming every setting exists.
3. Record attribution server-side and bind it to the canonical customer and purchase intent before payment. Specify first/last-touch and explicit-code precedence in terms; do not invent these rules in code.
4. Verify Stripe webhook signatures before reading events. Retrieve current payment/invoice state; do not trust browser amounts or delivery order. Include complete prior web/native purchase history and refuse commissions while that history is incomplete.
5. Persist commissions with a unique (mode, provider payment ID) key. Use atomic customer-level locking to prevent two simultaneous first purchases earning twice. Recompute on late events. Store no raw card data or unnecessary guest data.
6. Reconcile vendor commissions with the policy result. Later upgrades/renewals and nonqualifying products must not accrue. Handle vendor errors with an outbox/retry path independent of customer entitlement fulfillment.
7. Persist payout reservations atomically, recheck refunds/disputes and partner status immediately before approval, and settle each payment ID only once. Post-payout refunds create a recoverable adjustment, not a duplicate payment or silent ledger deletion.
8. Test click → existing Free signup/login → web checkout → verified payment → pending commission → validation → payout preview; then refund, partial refund, dispute, duplicate/out-of-order webhooks and native prior-purchase cases. Use synthetic customers, no live charges.
9. Publish partner-facing rules, application and onboarding only after end-to-end attribution/ledger tests pass. Launch the small manually approved pilot, then reconcile every commission before the first payout.

## Provider sources checked October 31

- https://www.promotekit.com/docs
- https://www.promotekit.com/docs/webhooks
- https://www.promotekit.com/pricing

No vendor API credential or campaign identifier is present in this change. Existing product permissions, entitlements, prices, discounts, Stripe checkout and billing behavior remain unchanged.

## Reconciliation and provider timing

`lib/affiliate-reconciliation.ts` compares complete server-retrieved vendor commission snapshots with the canonical policy. It blocks missing, duplicate, mismatched, already-paid and unvalidated records. Refunds flag unpaid records for voiding and paid records for recovery; it performs neither action itself. A reconciled payment is only a line-item check: partner-level $50 minimum, durable reservation and final refund recheck remain required.

PromoteKit Net terms schedule monthly payout reports; they do not mean a hold measured from each payment. The UI offers Net-0/15/30/60/90, without an exact 45-day validation option. No substitute term has been accepted. An attempted temporary $0/Net-60 campaign save was blocked by automatic review and was not retried. Resolve accurate two-product configuration and payout presentation before creating the campaign.

The provider documentation warns that manual commission creation is for commissions not automatically tracked through Stripe. Do not implement a second create-commission path for the same Stripe payment. Verify whether provider-generated records can be corrected/voided safely and how to represent the precise eligibility date; until then, keep provider writes disabled and do not onboard partners.

Sources: https://www.promotekit.com/docs/payouts and https://www.promotekit.com/docs/api-reference/commissions/create-commission (checked October 31, 2026).
