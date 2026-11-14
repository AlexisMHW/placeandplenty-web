#!/usr/bin/env node
// Build-time guard: fail a Vercel *Preview* build that resolves Supabase to production.
// No-op for production builds, local builds and CI (VERCEL_ENV not "preview").
// Prints reasons only, never env values. Run first in `npm run build`.
import { checkPreviewIsolation } from "./lib/preview-isolation.mjs";

const r = checkPreviewIsolation({
  vercelEnv: process.env.VERCEL_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!r.applies) {
  console.log("preview-isolation: not a Preview build (VERCEL_ENV != preview); skipped.");
  process.exit(0);
}
if (r.ok) {
  console.log("preview-isolation: OK, Preview build does not resolve to the production Supabase project.");
  process.exit(0);
}
console.error("preview-isolation: FAIL. Refusing to build this Preview.");
for (const reason of r.reasons) console.error(` - ${reason}`);
console.error("Fix: add Preview-scoped overrides for this branch (QA Supabase URL + anon key) BEFORE pushing the branch, then redeploy.");
process.exit(1);
