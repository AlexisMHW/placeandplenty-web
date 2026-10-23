# Canva publisher release gates

Status: implemented and locally tested; NOT APPROVED FOR RELEASE.

## Local verification

- Official Canva SDK/UI Kit dependencies and starter manifest isolated from Next.js.
- Root and Canva TypeScript checks pass.
- Web: 104 tests pass, including grant security, permission rejection and save cleanup.
- Canva: 33 tests pass, including publisher failure/success ordering and SQL role/RLS,
  PKCE mismatch, expiry and single-use code redemption tests in local PGlite.
- Single JavaScript SDK bundle with inline CSS: approximately 1.31 MB, below 5 MB.
- Build-only feature-branch CI workflow added. No deployment or submission steps.
- Full Tina/Next preview build and GitHub CI passed for 417e5d4. Current follow-up
  documentation and QA harness changes do not alter production configuration.

## Staging status

- Isolated QA schema, canonical private bucket and authorization-code SQL are ready.
- QA-only DNS, HTTPS and alias access exception verified; hosted feature flag enabled.
- Named public OAuth provider saved to the existing Canva draft; S256 PKCE required.
- Updated QA SDK bundle uploaded and rendered in Canva. Connect opens QA login.
- 21 hosted HTTP checks passed, including signed-in consent, exact callback,
  token exchange, selection, private artwork transfer and canonical save.
- Browser sign-in and actual design export remain pending. Complete endpoint abuse
  limits and expired-code retention before release. See the QA verification report.

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
- Concurrent API replacements passed in live QA. Exercise retries after ambiguous network failures;
  current uploads use unique keys and do not promise cross-request idempotency.
- Test `Not now` in Canva: no export or upload, and web-only planning works.
- Review grant expiry/reconnection UX, endpoint abuse limits, expired-code retention,
  accessibility/localization, mobile behavior and privacy disclosures.
- Obtain explicit owner approval before merge, production deployment or Canva submission.

Local database tests exercise PostgreSQL semantics in PGlite, not the live Supabase
PostgREST/storage environment or genuine simultaneous server connections.
