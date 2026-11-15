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
//   paymentSecretKeys (object: variable NAME -> value, e.g. { PAYMENT_PROCESSOR_SECRET_KEY, STRIPE_SECRET_KEY }), thirdPartyKeys (object NAME -> value for
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

/** Explicit, clearly named QA-only override: lets a Preview keep Gelato / MailerLite / Brevo keys ONLY when they are sandbox/QA keys. Must be exactly "true". */
export const QA_THIRD_PARTY_OVERRIDE_VAR = "PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS";
const LIVE_PAYMENT_KEY = /^\s*(sk|rk)_live_/i;

export function checkPreviewIsolation(input) {
  // Only Vercel Preview builds are constrained. Production builds (VERCEL_ENV=production),
  // local dev and CI without VERCEL_ENV are unaffected by design.
  if ((input.vercelEnv ?? "").toLowerCase() !== "preview") {
    return { ok: true, applies: false, reasons: [] };
  }
  const reasons = [];
  const urlRef = refFromSupabaseUrl(input.supabaseUrl);
  const keyRef = refFromJwt(input.anonKey);
  if (urlRef === PRODUCTION_SUPABASE_REF) {
    reasons.push("NEXT_PUBLIC_SUPABASE_URL points at the production Supabase project");
  }
  if (keyRef === PRODUCTION_SUPABASE_REF) {
    reasons.push("NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to the production Supabase project");
  }
  // A production host written in any other form (mixed case, trailing dot, path) still matches
  // via URL parsing; a raw substring match catches malformed values that fail to parse.
  if (!urlRef && (input.supabaseUrl ?? "").toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
    reasons.push("NEXT_PUBLIC_SUPABASE_URL mentions the production project ref");
  }
  if (!input.supabaseUrl) {
    // A preview with no Supabase URL cannot show the product; fail loudly rather than fall back.
    reasons.push("NEXT_PUBLIC_SUPABASE_URL is not set for this Preview build");
  }
  // Fail closed on anything that is not exactly the QA project.
  if (input.supabaseUrl && urlRef !== PRODUCTION_SUPABASE_REF && urlRef !== QA_SUPABASE_REF) {
    reasons.push("NEXT_PUBLIC_SUPABASE_URL is not the approved QA Supabase project");
  }
  if (!input.anonKey) {
    reasons.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set for this Preview build");
  } else if (keyRef !== PRODUCTION_SUPABASE_REF && keyRef !== QA_SUPABASE_REF) {
    reasons.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not an anon key of the approved QA Supabase project");
  }
  // Analytics must be explicitly off (default "consent" would load GA4/PostHog after consent).
  if (input.analyticsMode !== "off") {
    reasons.push('NEXT_PUBLIC_ANALYTICS_MODE must be explicitly "off" for Preview builds');
  }
  // ---- server-side secrets (A8 M2). A Preview that talks to QA must not hold anything that can spend real money or reach real customers.
  for (const [name, value] of Object.entries(input.paymentSecretKeys ?? {})) {
    if (typeof value === "string" && LIVE_PAYMENT_KEY.test(value)) {
      reasons.push(`${name} is a LIVE payment key (sk_live_/rk_live_); a Preview may only hold a test key or none`);
    }
  }
  const override = input.qaThirdPartyOverride === "true"; // exact compare, like analytics: "TRUE", "1", " true" do not count
  for (const [name, value] of Object.entries(input.thirdPartyKeys ?? {})) {
    if (typeof value === "string" && value !== "" && !override) {
      reasons.push(`${name} is set for this Preview build (real print orders / subscriptions / emails); remove it, or set ${QA_THIRD_PARTY_OVERRIDE_VAR}=true only if it is a sandbox/QA key`);
    }
  }
  if (typeof input.serviceRoleKey === "string" && input.serviceRoleKey !== "") {
    if (refFromJwt(input.serviceRoleKey) !== QA_SUPABASE_REF) {
      reasons.push("SUPABASE_SERVICE_ROLE_KEY is set but is not verifiably a service key of the approved QA Supabase project");
    }
  }
  if (typeof input.checkoutTesterIds === "string" && input.checkoutTesterIds !== "") {
    reasons.push("WEB_CHECKOUT_TESTER_USER_IDS must be empty for Preview builds");
  }
  return { ok: reasons.length === 0, applies: true, reasons };
}
