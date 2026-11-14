// Plain-language copy and small pure helpers for the email-confirmation path.
//
// WHY THESE ARE PURE FUNCTIONS. The wording is the product here: a person who
// clicks a confirmation link that did not work cannot tell an expired link
// from one an email program already opened for them, or from one opened on a
// different device than the one they signed up on. Supabase's own answer is
// the same for all three, so the page has to cover all three without blaming
// the person and without claiming to know which it was.
//
// NOTHING HERE CONFIRMS OR DENIES THAT AN ADDRESS HAS AN ACCOUNT. The resend
// message is identical whether or not the address is registered or already
// confirmed.

export type LoginNotice = {
  tone: "info" | "warning";
  title: string;
  body: string;
  /** Show the "send me a new confirmation link" control under the notice. */
  offerResend: boolean;
};

/**
 * Map the `?error=` code written by /auth/callback to a notice.
 * Unknown codes return null so a crafted URL cannot put its own text on the page.
 */
export function loginNotice(code: string | null | undefined): LoginNotice | null {
  switch (code) {
    case "link_expired":
      return {
        tone: "warning",
        title: "That link didn’t work.",
        body:
          "Email links work once and expire after a while. Some email programs open links automatically, and a link opened on a different device than the one you signed up on can fail too. If you already confirmed your email, just log in below. If not, we can send a fresh link — only the newest one works.",
        offerResend: true,
      };
    case "missing_code":
      return {
        tone: "info",
        title: "Almost there.",
        body:
          "If you just confirmed your email, you’re all set — log in below with your email and password. If you haven’t, we can send a new confirmation link.",
        offerResend: true,
      };
    case "invalid_type":
      return {
        tone: "warning",
        title: "That link wasn’t recognised.",
        body: "Try logging in below, or request a new link.",
        offerResend: true,
      };
    default:
      return null;
  }
}

/** One resend per address per minute, on top of Supabase's own limits. */
export const RESEND_COOLDOWN_MS = 60_000;

export function resendCooldownRemainingMs(
  lastSentAt: number | null | undefined,
  now: number,
  cooldownMs: number = RESEND_COOLDOWN_MS,
): number {
  if (typeof lastSentAt !== "number" || !Number.isFinite(lastSentAt)) return 0;
  const remaining = lastSentAt + cooldownMs - now;
  // A timestamp from the future (clock change) must not lock the button forever.
  if (remaining > cooldownMs) return 0;
  return Math.max(0, remaining);
}

/** Identical for registered, unregistered and already-confirmed addresses. */
export const RESEND_ACCEPTED_MESSAGE =
  "If that address is waiting for confirmation, a new link is on its way. Only the newest link works, so use the latest email. Already confirmed? Just log in.";

export const RESEND_RATE_LIMITED_MESSAGE =
  "Please wait a minute before asking for another email.";

export const RESEND_FAILED_MESSAGE =
  "We couldn’t send that just now. Please try again in a few minutes.";

/**
 * Supabase reports throttling with a message such as "For security purposes,
 * you can only request this after 45 seconds" or "email rate limit exceeded".
 * Anything else gets the generic wording so internal errors never reach the page.
 */
export function resendErrorMessage(
  error: { message?: string; status?: number; code?: string } | null | undefined,
): string {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  if (
    error?.status === 429 ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("only request this after") ||
    text.includes("over_email_send_rate_limit")
  ) {
    return RESEND_RATE_LIMITED_MESSAGE;
  }
  return RESEND_FAILED_MESSAGE;
}

export function formatCooldown(ms: number): string {
  return `${Math.ceil(ms / 1000)}s`;
}
