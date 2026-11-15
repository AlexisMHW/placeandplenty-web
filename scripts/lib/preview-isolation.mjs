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

// Input: { vercelEnv, supabaseUrl, anonKey, analyticsMode } (all optional strings).
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
  return { ok: reasons.length === 0, applies: true, reasons };
}
