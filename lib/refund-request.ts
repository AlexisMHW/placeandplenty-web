// Refund REQUEST path (not an automatic refund). Reuses the existing support mailbox.
// Kept free of "@/" imports so unit tests can import it directly.
// Policy wording lives in lib/refund-policy.ts and is not restated here.
export const SUPPORT_EMAIL = "support@placeandplenty.com";

/**
 * Pre-filled mailto for a web purchase. Identifies the purchase by product, date and the
 * internal account-record reference only. Never includes card or payment details.
 * Submitting it only asks Support to review the purchase under the published refund policy.
 */
export function refundRequestMailto(product: "gathering_pass" | "plus", purchasedAtIso: string, entitlementId: string): string {
  const label = product === "plus" ? "Place & Plenty Plus" : "Gathering Pass";
  const when = new Date(purchasedAtIso);
  const bought = Number.isNaN(when.getTime()) ? purchasedAtIso : when.toISOString().slice(0, 10);
  const subject = `Refund request: ${label}`;
  const body = [
    "Hello Place & Plenty Support,",
    "",
    "I would like to request a review of a purchase under your published refund policy.",
    "",
    `Purchase: ${label} (bought on placeandplenty.com)`,
    `Purchase date: ${bought}`,
    `Account record reference: ${entitlementId}`,
    "",
    "Anything you would like us to know (optional):",
    "",
    "Please do not include card numbers or passwords in this email.",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
