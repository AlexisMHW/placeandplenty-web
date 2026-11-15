// Plain-language text for the short error codes our server actions return. The database error text is NEVER shown (it could leak
// internals); only a code from a known list is mapped here, everything else becomes the generic line. Pure, no imports.
const MESSAGES: Record<string, string> = {
  saved: "Saved.",
  not_authorized: "Your role is not allowed to do this.",
  confirmation_required: "Tick the confirmation box first.",
  invalid_id: "That item could not be found. Refresh and try again.",
  invalid_kind: "That action is not recognised.",
  invalid_reference: "Enter the reference of the payment you made (3 to 120 characters, plain text).",
  invalid_external_ref: "Enter the reference of the payment you made (3 to 120 characters, plain text).",
  invalid_paid_on: "Enter the date you sent the payment. It cannot be in the future or older than a year.",
  invalid_reason: "Enter a reason (3 to 200 characters).",
  external_reference_already_used: "That payment reference is already recorded on another payout.",
  payout_already_paid_with_different_reference: "This payout is already recorded as paid with a different reference.",
  external_ref_already_used: "That payment reference is already recorded on another payout.",
  payout_not_draft: "This payout is no longer a draft.",
  payout_not_approved: "Approve the payout first. Approved does not mean paid; record the payment only after you have sent it.",
  payout_not_voidable: "A paid payout cannot be voided. Reverse it instead.",
  payout_not_paid: "Only a paid payout can be reversed.",
  below_minimum: "The balance is below the minimum payout.",
  partner_not_approved: "This member is not approved.",
  use_hc_record_external_payment: "Use “Record external payment”.",
  terms_must_be_effective_in_the_future: "New terms must start in the future.",
  tier_in_use: "Members are still on this tier. Move them first, then switch it off.",
  tier_not_found: "That tier does not exist.",
  tier_not_configured: "That tier does not exist.",
  invalid_slug: "Use lower-case letters, numbers and dashes for the tier key.",
  invalid_label: "Enter a tier name.",
  invalid_benefits: "Up to 12 benefits, each a short line.",
  invalid_email: "Enter a valid email address.",
  too_soon: "Please wait a minute before changing the address again.",
  nothing_to_verify: "There is no address waiting to be verified.",
  code_expired: "That code has expired. Send a new one.",
  too_many_attempts: "Too many wrong codes. Send a new one.",
  wrong_code: "That code is not right.",
  destination_not_verified: "Verify the address first.",
  invalid_severity: "Pick info, warning or critical.",
  invalid_hours: "Enter a number of hours from 1 to 720.",
  not_retryable: "That email cannot be retried.",
  already_resolved: "That item is already resolved.",
  not_found: "That item could not be found.",
  invalid_state: "That state is not allowed.",
  payout_not_found: "That payout could not be found.",
  external_reference_required: "Enter the reference of the payment you made (4 to 120 characters).",
  invalid_method: "Enter how you paid (for example bank transfer), 2 to 60 characters.",
  paid_referrals_not_active: "Paid referrals are switched off, so payouts cannot be approved. Switch them on first (owner only).",
  paid_referrals_disabled: "Paid referrals are switched off, so no payout can be drafted.",
  program_not_enabled: "The Hosting Collective program is not enabled yet.",
  terms_not_configured: "Commission terms are not configured yet.",
  reason_required: "Enter a reason (at least 3 characters).",
  not_authorized_referral_eligibility: "Only the owner can change whether a tier may earn paid referrals.",
  invalid_transition: "That change is not allowed for this member.",
  invalid_text: "Remove angle brackets and keep the text short.",
  invalid_sort: "Order must be a whole number from 0 to 999.",
  already_active: "Paid referrals are already switched on.",
  already_inactive: "Paid referrals are already switched off.",
  no_clawback: "That commission has no clawback to settle.",
  clawback_already_settled_differently: "That clawback was already settled with a different outcome.",
  clawback_already_netted: "That clawback was already netted into a payout.",
  invalid_resolution: "Choose recovered outside the app, or waived.",
  below_minimum_payout: "The balance is below the minimum payout.",
  failed: "That did not work. Nothing was changed. Try again, or ask the person who runs the site.",
};
export function messageFor(code: string | null | undefined): string {
  if (!code) return MESSAGES.failed;
  return MESSAGES[code] ?? MESSAGES.failed;
}
/** Extract a known code from a database error message; returns "failed" for anything unknown. */
export function knownCode(message: string | null | undefined): string {
  const m = /[a-z][a-z_]{2,}/g;
  for (const x of (message ?? "").match(m) ?? []) if (x in MESSAGES && x !== "saved" && x !== "failed") return x;
  return "failed";
}
