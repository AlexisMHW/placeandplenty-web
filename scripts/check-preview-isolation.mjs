#!/usr/bin/env node
// Build-time guard: fail a Vercel *Preview* build that resolves Supabase to production.
// No-op for production builds, local builds and CI (VERCEL_ENV not "preview").
// Prints reasons only, never env values. Run first in `npm run build`.
import { checkPreviewIsolation, QA_THIRD_PARTY_OVERRIDE_VAR } from "./lib/preview-isolation.mjs";

const r = checkPreviewIsolation({
  vercelEnv: process.env.VERCEL_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  analyticsMode: process.env.NEXT_PUBLIC_ANALYTICS_MODE,
  // server-side secrets (A8 M2): values are read only to be classified; they are never printed
  paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: process.env.PAYMENT_PROCESSOR_SECRET_KEY, STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY },
  thirdPartyKeys: { GELATO_API_KEY: process.env.GELATO_API_KEY, MAILERLITE_API_KEY: process.env.MAILERLITE_API_KEY, BREVO_API_KEY: process.env.BREVO_API_KEY },
  qaThirdPartyOverride: process.env[QA_THIRD_PARTY_OVERRIDE_VAR],
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  checkoutTesterIds: process.env.WEB_CHECKOUT_TESTER_USER_IDS,
});

if (!r.applies) {
  console.log("preview-isolation: not a Preview build (VERCEL_ENV != preview); skipped.");
  process.exit(0);
}
if (r.ok) {
  console.log("preview-isolation: OK, Preview build targets only the approved QA Supabase project with analytics off and no live/real server-side secrets.");
  process.exit(0);
}
console.error("preview-isolation: FAIL. Refusing to build this Preview.");
for (const reason of r.reasons) console.error(` - ${reason}`);
console.error("Fix: add Preview-scoped overrides for this branch (QA Supabase URL + anon key + NEXT_PUBLIC_ANALYTICS_MODE=off, no live payment key, no Gelato/MailerLite/Brevo keys, QA service key or none, empty WEB_CHECKOUT_TESTER_USER_IDS) BEFORE pushing the branch, then redeploy.");
process.exit(1);
