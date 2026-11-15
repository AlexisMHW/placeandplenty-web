// Preview isolation guard (RC-P2). A Vercel Preview build must never be wired to the
// production Supabase project. NEXT_PUBLIC_* values are inlined at build time, so the only
// reliable place to stop this is the build itself.
//
// Plain ESM JavaScript on purpose: it runs in `npm run build` before anything else, on whatever
// Node version the host uses, so it must not depend on TypeScript type stripping.

export const PRODUCTION_SUPABASE_REF = "iyvdxvotthwrerirdzwd";
// The only Supabase project a Preview build of this repo may be wired to (QA). Fail closed:
// anything else (missing, malformed, another project) is rejected, not just "not production".
export const QA_SUPABASE_REF = "gpzlytukyvshrrxrmooo";

// Input: { vercelEnv, supabaseUrl, anonKey, analyticsMode } (all optional strings) plus the SERVER-SIDE secret checks added by agent H (A8 M2), all optional:
//   scanEnv (object NAME -> value of every env var; any value shaped like a live Stripe key is rejected whatever its name), paymentSecretKeys (object: variable NAME -> value, e.g. { PAYMENT_PROCESSOR_SECRET_KEY, STRIPE_SECRET_KEY }), thirdPartyKeys (object NAME -> value for
//   GELATO_API_KEY / MAILERLITE_API_KEY / BREVO_API_KEY), qaThirdPartyOverride (value of PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS), serviceRoleKey, checkoutTesterIds.
// Reasons only ever name the VARIABLE, never a value or a part of one.
// Result: { ok, applies, reasons } where applies=false means the guard is a no-op and
// reasons never contain key material. There is deliberately no "allow production in preview" override.

/** Project ref from https://<ref>.supabase.co (or .supabase.in). null if not a Supabase host. */
export function refFromSupabaseUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9]{20})\.supabase\.(co|in)$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** "ref" claim of a Supabase anon/service JWT, without verifying it. null if absent/invalid. */
export function refFromJwt(token) {
  if (!token) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const ref = JSON.parse(json).ref;
    return typeof ref === "string" ? ref.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Decoded JWT payload object, or null. Strict: three base64url segments (no padding, no other characters), payload must be a JSON object. Signature is not verified (we do not hold the secret); this is a wiring check, not authentication. */
export function decodeJwtPayload(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** Character hygiene for every guarded value: printable ASCII only (0x21-0x7E), so no whitespace, control, zero-width or other non-ASCII characters, and no quote characters (a quoted value is a mis-pasted value). */
export function isCleanValue(value) {
  return typeof value === "string" && /^[\x21-\x7e]+$/.test(value) && !/["'`]/.test(value);
}

/** Lowercase form with zero-width/format characters, whitespace and quotes removed: used ONLY to detect a hidden production ref or live key, never to accept a value. */
function squash(value) {
  return String(value ?? "").normalize("NFKC").replace(/[\p{Cf}\p{Z}\s"'`]/gu, "").toLowerCase();
}

// Payment secret keys: ALLOWLIST. Unset/empty, or exactly a Stripe test key (lowercase prefix, alphanumeric body). Everything else is rejected.
const TEST_PAYMENT_KEY = /^(sk|rk)_test_[A-Za-z0-9]{8,}$/;
const LIVE_LOOKING = /(sk|rk)_live_/;

/** Strict Supabase URL form: https://<20-char lowercase ref>.supabase.co|in with at most one trailing slash. Rejects trailing-dot host, mixed case, port, path, query, userinfo. */
const STRICT_SUPABASE_URL = /^https:\/\/([a-z0-9]{20})\.supabase\.(?:co|in)\/?$/;

/** Explicit, clearly named QA-only override: lets a Preview keep Gelato / MailerLite / Brevo keys ONLY when they are sandbox/QA keys. Must be exactly "true". */
export const QA_THIRD_PARTY_OVERRIDE_VAR = "PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS";

export function checkPreviewIsolation(input) {
  // Only Vercel Preview builds are constrained. Production builds (VERCEL_ENV=production),
  // local dev and CI without VERCEL_ENV are unaffected by design.
  if ((input.vercelEnv ?? "").toLowerCase() !== "preview") {
    return { ok: true, applies: false, reasons: [] };
  }
  const reasons = [];
  const urlRef = refFromSupabaseUrl(input.supabaseUrl);
  const keyRef = refFromJwt(input.anonKey);
  const mentionsProd = (v) => squash(v).includes(PRODUCTION_SUPABASE_REF);

  // ---- Supabase URL (allowlist: exactly the QA project in strict URL form)
  if (!input.supabaseUrl) {
    // A preview with no Supabase URL cannot show the product; fail loudly rather than fall back.
    reasons.push("NEXT_PUBLIC_SUPABASE_URL is not set for this Preview build");
  } else {
    if (urlRef === PRODUCTION_SUPABASE_REF || mentionsProd(input.supabaseUrl)) {
      // any form: mixed case, trailing dot, path, port, whitespace, zero-width characters, unparseable
      reasons.push("NEXT_PUBLIC_SUPABASE_URL points at (or mentions) the production Supabase project");
    }
    const m = typeof input.supabaseUrl === "string" ? STRICT_SUPABASE_URL.exec(input.supabaseUrl) : null;
    if (!isCleanValue(input.supabaseUrl) || !m || m[1] !== QA_SUPABASE_REF) {
      reasons.push("NEXT_PUBLIC_SUPABASE_URL is not exactly the approved QA Supabase project URL (https://<qa-ref>.supabase.co, no spaces, quotes, trailing dot, port, path or non-ASCII characters)");
    }
  }

  // ---- anon key: clean value, JWT payload decoded, role anon, ref QA. A service-role key in the anon variable fails.
  checkSupabaseJwt(reasons, "NEXT_PUBLIC_SUPABASE_ANON_KEY", input.anonKey, "anon", { required: true, mentionsProd });
  if (keyRef === PRODUCTION_SUPABASE_REF) reasons.push("NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to the production Supabase project");

  // Analytics must be explicitly off (default "consent" would load GA4/PostHog after consent).
  if (input.analyticsMode !== "off") {
    reasons.push('NEXT_PUBLIC_ANALYTICS_MODE must be explicitly "off" for Preview builds');
  }

  // ---- server-side secrets (A8 M2/n3). A Preview that talks to QA must not hold anything that can spend real money or reach real customers.
  // Payment keys are an ALLOWLIST: unset, or exactly sk_test_/rk_test_ followed by an alphanumeric body.
  for (const [name, value] of Object.entries(input.paymentSecretKeys ?? {})) {
    if (value === undefined || value === "") continue;
    if (typeof value !== "string") { reasons.push(`${name} is not a string`); continue; }
    if (TEST_PAYMENT_KEY.test(value)) continue;
    if (LIVE_LOOKING.test(squash(value))) {
      reasons.push(`${name} is a LIVE payment key (or disguised as one); a Preview may only hold a test key or none`);
    } else if (!isCleanValue(value)) {
      reasons.push(`${name} contains whitespace, quotes or non-ASCII/zero-width characters; a Preview may only hold an exact sk_test_/rk_test_ key or none`);
    } else {
      reasons.push(`${name} is not an exact sk_test_/rk_test_ key (unknown prefix, wrong case or malformed); a Preview may only hold a test key or none`);
    }
  }
  // Defence in depth: ANY other variable whose value looks like a live Stripe key, whatever its name.
  for (const [name, value] of Object.entries(input.scanEnv ?? {})) {
    if (name in (input.paymentSecretKeys ?? {})) continue;
    if (typeof value === "string" && LIVE_LOOKING.test(squash(value))) {
      reasons.push(`${name} holds a value shaped like a LIVE payment key; remove it from the Preview scope`);
    }
  }
  const override = input.qaThirdPartyOverride === "true"; // exact compare, like analytics: "TRUE", "1", " true" do not count
  for (const [name, value] of Object.entries(input.thirdPartyKeys ?? {})) {
    if (typeof value !== "string" || value === "") continue;
    if (!override) {
      reasons.push(`${name} is set for this Preview build (real print orders / subscriptions / emails); remove it, or set ${QA_THIRD_PARTY_OVERRIDE_VAR}=true only if it is a sandbox/QA key`);
    } else if (!isCleanValue(value) || LIVE_LOOKING.test(squash(value))) {
      reasons.push(`${name} contains whitespace, quotes or non-ASCII characters`);
    }
  }
  if (typeof input.serviceRoleKey === "string" && input.serviceRoleKey !== "") {
    checkSupabaseJwt(reasons, "SUPABASE_SERVICE_ROLE_KEY", input.serviceRoleKey, "service_role", { required: false, mentionsProd });
  }
  if (typeof input.checkoutTesterIds === "string" && input.checkoutTesterIds !== "") {
    reasons.push("WEB_CHECKOUT_TESTER_USER_IDS must be empty for Preview builds");
  }
  return { ok: reasons.length === 0, applies: true, reasons };
}

// One shared check for the Supabase anon and service keys: hygiene, strict JWT decode, role and ref must both match what the variable is for.
function checkSupabaseJwt(reasons, name, value, expectedRole, { required, mentionsProd }) {
  if (value === undefined || value === null || value === "") {
    if (required) reasons.push(`${name} is not set for this Preview build`);
    return;
  }
  if (!isCleanValue(value)) {
    reasons.push(`${name} contains whitespace, quotes or non-ASCII/zero-width characters`);
    return;
  }
  const payload = decodeJwtPayload(value);
  if (!payload) {
    reasons.push(`${name} is not a decodable Supabase JWT`);
    return;
  }
  const ref = typeof payload.ref === "string" ? payload.ref : null;
  if (mentionsProd(JSON.stringify(payload))) {
    reasons.push(`${name} belongs to (or mentions) the production Supabase project`);
  }
  if (ref !== QA_SUPABASE_REF) {
    reasons.push(`${name} is not a key of the approved QA Supabase project (ref claim must be exactly the QA ref)`);
  }
  if (payload.role !== expectedRole) {
    reasons.push(`${name} must have role "${expectedRole}" (a different role, for example a service-role key in the anon variable, is rejected)`);
  }
}
