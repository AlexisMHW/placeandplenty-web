// SITE / GUEST-LINK BASE URLs for the web app (follow-up J). Fail closed in non-production contexts; production behaves exactly as before.
//
// Context (lib/base-url-guard.ts): non-production when VERCEL_ENV is not "production" (a Vercel Preview or Development deployment), when PP_APP_ENV / NEXT_PUBLIC_APP_ENV is set to anything but
// production, or when NEXT_PUBLIC_SUPABASE_URL is present and is not the production project (QA project gpzlytukyvshrrxrmooo, any other project, or a local stack). No signal = production
// (unit tests, tooling): the legacy defaults below.
//   * Production: NEXT_PUBLIC_SITE_URL, else https://placeandplenty.com (checkout return URLs, billing portal return, print studio); GUEST_PAGE_BASE_URL, else the production /invite page.
//   * Non-production: the value MUST be explicitly configured and must not be placeandplenty.com / www. in any disguise. Otherwise the caller REFUSES (a short reason code, 503
//     site_url_not_configured on the API routes; no link on pages). There is no silent default to production.
import { BaseUrlRefusedError, detectContext, strictBaseUrl, type RefusalReason, type RuntimeContext } from "./base-url-guard.ts";

export const PRODUCTION_SITE_URL = "https://placeandplenty.com";
export const PRODUCTION_GUEST_INVITE_BASE_URL = "https://placeandplenty.com/invite";

export type SiteEnv = Record<string, string | undefined>;

export function siteContext(env: SiteEnv = process.env): RuntimeContext {
  return detectContext({ supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL, appEnv: env.PP_APP_ENV || env.NEXT_PUBLIC_APP_ENV, hostingEnv: env.VERCEL_ENV });
}

/** The site origin for return URLs, or the reason it is refused. */
export function decideSiteUrl(raw: string | undefined, ctx: RuntimeContext): { url: string | null; reason: RefusalReason | null } {
  if (ctx === "production") return { url: (raw || PRODUCTION_SITE_URL).replace(/\/$/, ""), reason: null };
  const s = strictBaseUrl(raw, { allowPath: false });
  return s.ok ? { url: s.url, reason: null } : { url: null, reason: s.reason };
}

/** null when the site URL is usable in this environment, else the refusal reason (API routes answer 503 site_url_not_configured). */
export function siteUrlRefusal(env: SiteEnv = process.env): RefusalReason | null {
  return decideSiteUrl(env.NEXT_PUBLIC_SITE_URL, siteContext(env)).reason;
}

/** The site origin. THROWS BaseUrlRefusedError in a non-production context without an explicit non-production NEXT_PUBLIC_SITE_URL. */
export function siteUrl(env: SiteEnv = process.env): string {
  const d = decideSiteUrl(env.NEXT_PUBLIC_SITE_URL, siteContext(env));
  if (!d.url) throw new BaseUrlRefusedError(d.reason ?? "unset", "NEXT_PUBLIC_SITE_URL");
  return d.url;
}

/** Base of the guest invitation pages (".../invite") used for share-by-text links; null = no link may be built in this environment. */
export function guestInviteBaseUrl(env: SiteEnv = process.env): string | null {
  const ctx = siteContext(env);
  const raw = env.GUEST_PAGE_BASE_URL;
  if (ctx === "production") return raw || PRODUCTION_GUEST_INVITE_BASE_URL;
  const s = strictBaseUrl(raw, { allowPath: true });
  return s.ok ? s.url : null;
}

/** Creator referral base: production = the production site (unchanged); non-production needs an explicit site URL, else null (no link shown). */
export function referralSiteUrl(env: SiteEnv = process.env): string | null {
  return decideSiteUrl(env.NEXT_PUBLIC_SITE_URL, siteContext(env)).url;
}
