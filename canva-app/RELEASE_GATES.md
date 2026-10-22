# Canva publisher release gates

Status: implemented and locally tested; NOT APPROVED FOR RELEASE.

## Local verification

- Official Canva SDK/UI Kit dependencies and starter manifest isolated from Next.js.
- Root and Canva TypeScript checks pass.
- Web: 103 tests pass, including grant security, permission rejection and save cleanup.
- Canva: 32 tests pass, including publisher failure/success ordering and SQL role/RLS,
  PKCE mismatch, expiry and single-use code redemption tests in local PGlite.
- Single JavaScript SDK bundle with inline CSS: approximately 1.31 MB, below 5 MB.
- Build-only feature-branch CI workflow added. No deployment or submission steps.
- Full `npm run build` blocked at Tina CMS: missing `NEXT_PUBLIC_TINA_CLIENT_ID`
  and `TINA_TOKEN`. This is not a passing website build.

## Before staging acceptance

1. Choose an isolated staging Supabase project/branch with current canonical
   gathering/storage/RPC contracts. Review and apply the proposed authorization
   code SQL there, including retention cleanup and rate limiting. No shared DB
   has been changed. The SQL deliberately exposes only a random-code/PKCE exchange
   function to anon; table reads are denied. Security-definer review is required.
2. Configure server-only encryption/client credentials, exact callback and app
   iframe origin, plus the disabled-by-default feature flag. Use actual draft
   Canva OAuth settings; do not guess the callback. Test Basic and/or form client
   auth as configured, S256 verifier delivery and cancellation/denial handling.
3. Provide Tina credentials to complete the normal web build. Verify CI result
   after pushing; a local pass is not a remote CI pass.
4. With approval, configure the existing Canva draft app for approved staging
   URLs and preview the compiled bundle. Automatic review blocked the CLI
   scaffolding command's portal/API access; no retry or portal mutation occurred.

## End-to-end release acceptance

- Existing account and new signup (including confirmation email) return to consent
  and the same Canva flow. Check canceled, expired and replayed authorization.
- Verify account switching cannot publish into an old account's selected gathering.
- Verify owner, accepted co-host with allowed writes, restricted co-host and
  unrelated user against the real storage/RPC policies.
- Verify Free, Gathering Pass, Plus and Multi-Day behavior matches existing app.
  Artwork import does not itself grant premium access. Multi-day itinerary editing
  stays behind existing host app guards.
- Confirm actual Canva media preview/export, 10 MB limits, damaged file rejection,
  storage/save/cleanup failure handling and canonical artwork visible in web/native.
- Exercise concurrent replacements and retries after ambiguous network failures;
  current uploads use unique keys and do not promise cross-request idempotency.
- Test `Not now` in Canva: no export or upload, and web-only planning works.
- Review grant expiry/reconnection UX, endpoint abuse limits, expired-code retention,
  accessibility/localization, mobile behavior and privacy disclosures.
- Obtain explicit owner approval before merge, production deployment or Canva submission.

Local database tests exercise PostgreSQL semantics in PGlite, not the live Supabase
PostgREST/storage environment or genuine simultaneous server connections.
