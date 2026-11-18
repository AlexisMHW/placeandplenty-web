// Standalone public SMS opt-in (/sms-opt-in). Pure module (no Next imports) so node:test can import it.
//
// GATED: the form only works when NEXT_PUBLIC_SMS_STANDALONE_OPT_IN is exactly "true" (default OFF). With it off the page shows an honest
// "not open yet" state and POST /api/sms-opt-in answers 404, so a nonfunctional form is never presented as complete.
//
// BACKEND DEPENDENCY (not in this repo): the sms-consent edge function must accept { source: "standalone_page", ... } and wording_version "v3",
// and a gathering-less consent RPC must exist. Until then the edge answers an error and this module maps it to "unavailable" (never to success).
// Success is shown ONLY when the edge function answers 200 { ok: true }. Consent is never inferred from a host-entered number: this path
// carries only what the person typed into this page plus an explicit true checkbox.

export const STANDALONE_WORDING_VERSION = "v3";
export const STANDALONE_SOURCE = "standalone_page";

// COPY of CONSENT_WORDING.v3 that must be added to the edge function (supabase/proposed/sms-edge/src/consent.ts). The edge stores ITS OWN text
// for the version we send, so stored evidence equals what was shown only while the two are identical. COUNSEL MUST APPROVE BEFORE LIVE USE.
export const STANDALONE_CONSENT_WORDING =
  "Text me invitations, RSVP reminders, and gathering updates from Place & Plenty at this number. Message frequency varies, usually a few per gathering. Message and data rates may apply. Consent is not required to RSVP, host, or buy anything. Reply STOP to opt out at any time or HELP for help. Terms: placeandplenty.com/terms. Privacy: placeandplenty.com/privacy.";

// Same constants as lib/sms-guest-consent.ts (duplicated: node:test cannot resolve extensionless relative imports).
export const SMS_TERMS_URL_TEXT = "placeandplenty.com/terms";
export const SMS_PRIVACY_URL_TEXT = "placeandplenty.com/privacy";

export const STANDALONE_COPY = {
  needCheckbox: "Please tick the box to agree to texts.",
  needPhone: "Please enter a valid US mobile number.",
  success: "You're signed up. Place & Plenty will text this number about invitations, RSVP reminders and gathering updates. Reply STOP to any text to opt out, or HELP for help.",
  successStillOptedOut: "We saved your choice, but this number previously replied STOP, so no texts will be sent. Reply START to a Place & Plenty text to turn texts back on.",
  rateLimited: "Too many attempts. Please wait a few minutes and try again.",
  unavailable: "Signing up for texts isn't available right now. Nothing was saved. Your RSVPs and invitations are not affected.",
  failed: "Something went wrong and nothing was saved. Please try again.",
};

/** Anything other than the exact string "true" is OFF. */
export function isStandaloneOptInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_SMS_STANDALONE_OPT_IN === "true";
}

/** Fast US-number shape check (10 digits, or 11 with a leading 1). The edge function normalises strictly (NANP rules) and is authoritative. */
export function looksLikeUsPhone(phone: string): boolean {
  const t = phone.trim();
  const d = t.replace(/\D/g, "");
  return t.length <= 32 && (d.length === 10 || (d.length === 11 && d.startsWith("1")));
}

export const MIN_FILL_MS = 2500;      // a human cannot read, type and tick faster than this
export const MAX_FORM_AGE_MS = 6 * 60 * 60 * 1000;

export interface StandaloneInput { phone: string; accepted: true; honeypot: string; startedAt: number }
export type StandaloneValidation =
  | { ok: true; value: StandaloneInput }
  | { ok: false; error: "bad_request" | "invalid_phone" | "consent_required" };

export function validateStandaloneInput(body: unknown): StandaloneValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b !== "object" || Array.isArray(b)) return { ok: false, error: "bad_request" };
  if (b.accepted !== true) return { ok: false, error: "consent_required" };
  if (typeof b.phone !== "string" || !looksLikeUsPhone(b.phone)) return { ok: false, error: "invalid_phone" };
  const honeypot = typeof b.website === "string" ? b.website : "";
  const startedAt = typeof b.startedAt === "number" && Number.isFinite(b.startedAt) ? b.startedAt : 0;
  return { ok: true, value: { phone: b.phone.trim(), accepted: true, honeypot, startedAt } };
}

/** Best-effort in-memory limiter (per server instance). The edge function must ALSO rate limit by the hashed client key. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return function allow(key: string): boolean {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= limit) { hits.set(key, recent); return false; }
    recent.push(t); hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
    return true;
  };
}

export interface StandaloneConfig { supabaseUrl?: string; anonKey?: string; flagEnv?: Record<string, string | undefined>; clientKey?: string; now?: () => number }

export async function forwardStandaloneConsent(body: unknown, cfg: StandaloneConfig, transport: typeof fetch = fetch): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isStandaloneOptInEnabled(cfg.flagEnv ?? process.env)) return { status: 404, body: { error: "not_found" } };
  const v = validateStandaloneInput(body);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  const age = (cfg.now ? cfg.now() : Date.now()) - v.value.startedAt;
  // Bots: a filled honeypot or an implausibly fast submit. Nothing is stored or forwarded; answer neutrally so the bot learns nothing.
  if (v.value.honeypot.trim() !== "" || age < MIN_FILL_MS) return { status: 200, body: { ok: true, stillOptedOut: false, ignored: true } };
  if (age > MAX_FORM_AGE_MS) return { status: 400, body: { error: "expired" } };
  if (!cfg.supabaseUrl || !cfg.anonKey) return { status: 503, body: { error: "unavailable" } };
  let res: Response;
  try {
    res = await transport(`${cfg.supabaseUrl}/functions/v1/sms-consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
      body: JSON.stringify({ source: STANDALONE_SOURCE, phone: v.value.phone, accepted: true, wording_version: STANDALONE_WORDING_VERSION, client_key: cfg.clientKey ?? null }),
      cache: "no-store",
    });
  } catch {
    return { status: 503, body: { error: "unavailable" } };
  }
  let data: { ok?: boolean; error?: string; still_opted_out?: boolean } | null = null;
  try { data = await res.json(); } catch { data = null; }
  if (res.ok && data?.ok === true) return { status: 200, body: { ok: true, stillOptedOut: data.still_opted_out === true } };
  if (res.status === 429) return { status: 429, body: { error: "rate_limited" } };
  if (res.status === 400 && data?.error === "invalid_phone") return { status: 400, body: { error: "invalid_phone" } };
  return { status: 503, body: { error: "unavailable" } };   // includes an edge that does not know this source yet: fail closed, never "success"
}
