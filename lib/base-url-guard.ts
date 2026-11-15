// BASE-URL GUARD (follow-up J). Pure, dependency-free TypeScript, BYTE-IDENTICAL in three places (native app lib/config/baseUrlGuard.ts, native edge functions
// supabase/functions/_shared/baseUrlGuard.ts, web lib/base-url-guard.ts); a test in each repo pins the copies to the same SHA-256.
//
// PURPOSE: a QA / preview / development environment must NEVER build a guest link, invitation link, share link, unsubscribe link, paper-order status call or checkout
// return URL that points at PRODUCTION (placeandplenty.com, www.placeandplenty.com), whether by an unset variable that silently defaults to production, or by a production
// value copied into a non-production environment (in any disguise: case, spaces, a trailing dot, full-width letters, percent-encoding, zero-width characters, user-info tricks,
// "placeandplenty.com.evil.test"). In those contexts the URL must come from an explicit configured value and generation REFUSES (a reason code, never a silent default).
//
// CONTEXT (detectContext) is decided by POSITIVE non-production signals; production keeps today's behaviour exactly (including its production default where one exists):
//   - an explicit environment flag (APP_ENV / PP_APP_ENV / EXPO_PUBLIC_APP_ENV) that is not "production";
//   - a hosting environment that is not production (Vercel: VERCEL_ENV = preview | development);
//   - a Supabase URL that is present and is not the production project (QA project gpzlytukyvshrrxrmooo, any other project, or a local stack).
// No signal at all (unit tests, tooling) = "production" (legacy behaviour). Nothing here reads the process environment; callers pass the values in.
export const PRODUCTION_SUPABASE_REF = 'iyvdxvotthwrerirdzwd';
export const QA_SUPABASE_REF = 'gpzlytukyvshrrxrmooo';
export const PRODUCTION_WEB_HOSTS: readonly string[] = ['placeandplenty.com', 'www.placeandplenty.com'];

export type RuntimeContext = 'production' | 'nonproduction';
export type RefusalReason =
  | 'unset'
  | 'invalid'
  | 'invalid_characters'
  | 'insecure'
  | 'credentials'
  | 'query_or_fragment'
  | 'non_ascii_host'
  | 'production_host'
  | 'lookalike_host';
export type StrictBase = { ok: true; url: string; origin: string } | { ok: false; reason: RefusalReason };

/** Error thrown by call sites that must stop (never carries the offending value). */
export class BaseUrlRefusedError extends Error {
  reason: RefusalReason;
  constructor(reason: RefusalReason, what = 'base URL') {
    super(`${what} refused (${reason}): this environment needs an explicit non-production value`);
    this.name = 'BaseUrlRefusedError';
    this.reason = reason;
  }
}

function supabaseRef(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const m = new URL(url.trim()).hostname.toLowerCase().match(/^([a-z0-9]{20})\.supabase\.(co|in)$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export interface ContextSignals {
  /** The project's Supabase URL (edge: SUPABASE_URL, native: EXPO_PUBLIC_SUPABASE_URL, web: NEXT_PUBLIC_SUPABASE_URL). */
  supabaseUrl?: string | null;
  /** Explicit environment flag value (APP_ENV / PP_APP_ENV / EXPO_PUBLIC_APP_ENV). Anything other than "production" (case-insensitive) is non-production. */
  appEnv?: string | null;
  /** Hosting environment (Vercel VERCEL_ENV). preview / development / anything other than production is non-production. */
  hostingEnv?: string | null;
}

export function detectContext(s: ContextSignals): RuntimeContext {
  const flag = (s.appEnv ?? '').trim().toLowerCase();
  if (flag && flag !== 'production' && flag !== 'prod') return 'nonproduction';
  const host = (s.hostingEnv ?? '').trim().toLowerCase();
  if (host && host !== 'production') return 'nonproduction';
  const url = (s.supabaseUrl ?? '').trim();
  if (url) return supabaseRef(url) === PRODUCTION_SUPABASE_REF ? 'production' : 'nonproduction';
  return 'production';
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

/** null = acceptable host; otherwise why it is refused. Production = placeandplenty.com and any number of leading "www." labels; lookalike = the production name embedded in a longer host. */
export function productionHostReason(hostname: string): 'production_host' | 'lookalike_host' | null {
  const h = hostname.toLowerCase().replace(/\.+$/, '');
  if (PRODUCTION_WEB_HOSTS.includes(h) || h.replace(/^(www\.)+/, '') === 'placeandplenty.com') return 'production_host';
  if (h.includes('placeandplenty.com') && !h.endsWith('.placeandplenty.com')) return 'lookalike_host';
  return null;
}

/**
 * Validates an explicitly configured base URL for a NON-production context. allowPath: keep the path (guest-link bases such as https://qa.example.com/invite);
 * otherwise only the origin is returned. Refuses: unset / blank, unparsable, hidden control or zero-width characters, http (except localhost / 127.0.0.1 / 10.0.2.2),
 * user-info, query or fragment, non-ASCII or punycode hosts, and the production host in any disguise.
 */
export function strictBaseUrl(raw: string | null | undefined, opts: { allowPath?: boolean } = {}): StrictBase {
  if (typeof raw !== 'string') return { ok: false, reason: 'unset' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'unset' };
  if (/[\p{Cc}\p{Cf}\s]/u.test(trimmed)) return { ok: false, reason: 'invalid_characters' };
  let url: URL;
  try {
    url = new URL(trimmed.normalize('NFKC'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.username || url.password || /@/.test(trimmed.split(/[/?#]/, 3)[2] ?? '')) return { ok: false, reason: 'credentials' };
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (/[^\x21-\x7e]/.test(host) || /(^|\.)xn--/.test(host)) return { ok: false, reason: 'non_ascii_host' };
  const prod = productionHostReason(host);
  if (prod) return { ok: false, reason: prod };
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(host))) return { ok: false, reason: 'insecure' };
  if (url.search || url.hash) return { ok: false, reason: 'query_or_fragment' };
  const origin = url.origin;
  const url2 = opts.allowPath ? origin + url.pathname.replace(/\/+$/, '') : origin;
  return { ok: true, url: url2, origin };
}

/** A fully built link (or any string URL) must not target production when the context is non-production. Returns the refusal reason, or null when it is fine. */
export function linkRefusalReason(link: string | null | undefined, ctx: RuntimeContext): RefusalReason | null {
  if (ctx === 'production') return null;
  if (typeof link !== 'string' || !link.trim()) return 'unset';
  let u: URL;
  try {
    u = new URL(link.trim().normalize('NFKC'));
  } catch {
    return 'invalid';
  }
  const host = u.hostname.toLowerCase().replace(/\.+$/, '');
  if (/[^\x21-\x7e]/.test(host) || /(^|\.)xn--/.test(host)) return 'non_ascii_host';
  return productionHostReason(host);
}
