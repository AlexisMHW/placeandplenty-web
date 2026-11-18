// Anonymous referral link-open counting (follow-up 260000). OFF by default and never blocks or changes the redirect.
// - Counts only when BOTH NEXT_PUBLIC_HC_REFERRALS and HC_CLICK_COUNTING_ENABLED are exactly "true", and never when Global Privacy Control is on.
// - Sends ONLY the public referral code to the database (service-role function hc_record_referral_click). No IP, user agent, referrer or cookie value leaves this module.
// - Any failure (missing key, database function not installed, timeout) is swallowed: the visitor is redirected exactly as before.
// Pure logic plus one function written against a minimal client so it can be tested with a fake. No Next.js imports.
export const CLICK_CODE = /^[a-z0-9-]{3,32}$/;
export type ClickEnv = Record<string, string | undefined>;
export interface ClickClient { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data?: unknown; error: { message: string } | null }> }

export function shouldCountClick(env: ClickEnv, gpcHeader: string | null | undefined, code: string): boolean {
  if (env.NEXT_PUBLIC_HC_REFERRALS !== "true" || env.HC_CLICK_COUNTING_ENABLED !== "true") return false;
  if (gpcHeader === "1") return false;
  return CLICK_CODE.test(code.trim().toLowerCase());
}

export async function countClick(client: (() => ClickClient | null), code: string, timeoutMs = 800): Promise<"counted" | "skipped" | "error"> {
  try {
    const c = client(); if (!c) return "skipped";
    const call = Promise.resolve(c.rpc("hc_record_referral_click", { p_code: code.trim().toLowerCase() }));
    const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), timeoutMs));
    const res = await Promise.race([call, timeout]);
    if (res === "timeout" || res.error) return "error";
    return (res.data as { status?: unknown } | null)?.status === "counted" ? "counted" : "skipped";
  } catch { return "error"; }
}

export interface FunnelRow { code: string; displayName: string; clicks: number; signups: number }
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** hc_admin_referral_funnel. null when the shape is wrong (page says "not available"). */
export function parseFunnel(raw: unknown): { days: number; rows: FunnelRow[]; note: string | null } | null {
  const o = rec(raw); if (!o || !Array.isArray(o.rows) || typeof o.days !== "number") return null;
  const rows = o.rows.flatMap((x) => { const r = rec(x); return r && typeof r.code === "string" && typeof r.clicks === "number" && typeof r.signups === "number" ? [{ code: r.code, displayName: typeof r.display_name === "string" ? r.display_name : "(no name)", clicks: r.clicks, signups: r.signups }] : []; });
  return { days: o.days, rows, note: typeof o.note === "string" ? o.note : null };
}
/** Signups per 100 link opens, or null when there are no opens (never divides by zero, never invents a rate). */
export const signupsPer100 = (r: { clicks: number; signups: number }): number | null => (r.clicks > 0 ? Math.round((r.signups / r.clicks) * 1000) / 10 : null);
