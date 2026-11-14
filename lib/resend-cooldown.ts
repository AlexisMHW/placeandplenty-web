// Confirmation-email resend rules, shared by sign-up and sign-in.
//
// WHY: Supabase rate-limits auth emails per address and per project. Before this, pressing "Resend" twice produced
// the raw provider message or a generic error, and nothing stopped a person tapping it repeatedly (which only makes the
// limit worse). A fixed client cooldown keeps requests under the limit; a rate-limit reply is mapped to a clear
// "wait, then try again" message rather than "something went wrong".
//
// Pure functions only (no React, no network) so the rules are unit-tested. Native has an identical copy:
// the native app: features/auth/services/resendCooldown.ts. Keep the two in step.

export const RESEND_COOLDOWN_SECONDS = 60;

/** Whole seconds left before another resend is allowed; 0 means allowed now. Clock going backwards never locks the button. */
export function resendSecondsRemaining(
  lastSentAtMs: number | null | undefined,
  nowMs: number,
  cooldownSeconds: number = RESEND_COOLDOWN_SECONDS
): number {
  if (lastSentAtMs == null || !Number.isFinite(lastSentAtMs)) return 0;
  const elapsed = nowMs - lastSentAtMs;
  if (elapsed < 0) return 0;
  const remaining = Math.ceil((cooldownSeconds * 1000 - elapsed) / 1000);
  return remaining > 0 ? remaining : 0;
}

export type AuthEmailErrorKind = 'rate_limited' | 'network' | 'unknown';

/** Classifies a Supabase auth error (or anything thrown) without exposing its raw text to the person. */
export function classifyAuthEmailError(error: unknown): AuthEmailErrorKind {
  const e = (error ?? {}) as { message?: unknown; status?: unknown; code?: unknown; name?: unknown };
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const code = typeof e.code === 'string' ? e.code.toLowerCase() : '';
  if (
    e.status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('security purposes') ||
    /after \d+ seconds?/.test(message)
  ) {
    return 'rate_limited';
  }
  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    e.name === 'AuthRetryableFetchError'
  ) {
    return 'network';
  }
  return 'unknown';
}

/** Seconds Supabase asked us to wait ("...after 41 seconds"), else the default cooldown. Clamped to 1..600. */
export function retryAfterSeconds(error: unknown, fallback: number = RESEND_COOLDOWN_SECONDS): number {
  const message = String(((error ?? {}) as { message?: unknown }).message ?? '');
  const m = /after (\d+) seconds?/i.exec(message);
  const n = m ? parseInt(m[1], 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(600, Math.max(1, n));
}

/** True for Supabase's "Email not confirmed" sign-in failure, in either wording it has used. */
export function isEmailNotConfirmed(error: unknown): boolean {
  const e = (error ?? {}) as { message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
  const code = typeof e.code === "string" ? e.code.toLowerCase() : "";
  return code === "email_not_confirmed" || message.includes("email not confirmed") || message.includes("email_not_confirmed");
}

/** Person-facing wording for a failed auth email. Raw provider text is never shown. */
export function authEmailErrorMessage(error: unknown): string {
  switch (classifyAuthEmailError(error)) {
    case "rate_limited":
      return "We've sent a few emails already. Please wait a minute, then try again.";
    case "network":
      return "We couldn't reach the server. Check your connection and try again.";
    default:
      return "We couldn't send that email just now. Please try again in a moment, or contact support if it keeps happening.";
  }
}
