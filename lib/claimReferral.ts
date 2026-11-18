// Called from the auth callback (both the code and token_hash branches) after a session exists. Server-side only.
// Never surfaces the outcome to the user (no partner identity leaks); clears the cookie on any definitive answer.
import { REFERRAL_COOKIE, parseCookieValue } from './referral.ts';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
const FINAL = new Set(['claimed','already_claimed','invalid_code','expired_touch','touch_after_signup','claim_too_late','self_referral','existing_customer','invalid_touch']);

export async function claimReferralFromCookie(cookieValue: string | undefined, rpc: Rpc, now = Date.now()) {
  const touch = parseCookieValue(cookieValue, now);
  if (!touch) return { clear: !!cookieValue, status: 'no_touch' as const };
  const { data, error } = await rpc('record_referral_claim', { p_code: touch.code, p_touched_at: new Date(touch.touchedAt).toISOString() });
  if (error) return { clear: false, status: 'error' as const };
  const status = String(data?.status ?? 'error');
  return { clear: FINAL.has(status), status };
}
export { REFERRAL_COOKIE };
