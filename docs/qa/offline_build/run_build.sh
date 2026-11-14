#!/usr/bin/env bash
# Reproducible PRODUCTION-EQUIVALENT web build with no internet and no Tina cloud account (A8, 2026-11-14).
# Dummy Supabase values are used ONLY so the build can finish; nothing connects anywhere. Run from the web repo root.
# 1) tinacms build --local ...  generates tina/__generated__ (gitignored by design)
# 2) NEXT_FONT_GOOGLE_MOCKED_RESPONSES replaces Google Fonts fetches (Next test hook)
# 3) `tinacms dev -c` starts Tina's local content server on :4001 for prerendering; NODE_ENV must be forced back to production.
set -euo pipefail
export NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=https://example-scratch.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key
export NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/docs/qa/offline_build/font_mock.cjs"
npx tinacms build --local --skip-cloud-checks --skip-indexing
node scripts/fix-tina-cache-path.mjs && node scripts/check-tina-codegen.mjs && node scripts/check-app-links.mjs
npx tinacms dev --noTelemetry --noWatch -c "env NODE_ENV=production npx next build"
# NOTE: tinacms build deletes the tracked file public/admin/README.md and writes public/admin/index.html; restore with: git checkout -- public/admin
