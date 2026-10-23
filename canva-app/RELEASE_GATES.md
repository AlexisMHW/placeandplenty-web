# Canva publisher release gates

Status: implemented and locally tested; NOT APPROVED FOR RELEASE.

## Local verification

- Official Canva SDK/UI Kit dependencies and starter manifest isolated from Next.js.
- Root and Canva TypeScript checks pass.
- Web: 108 tests pass, including grant security, permission rejection and save cleanup.
- Canva: 50 tests pass, including publisher failure/success ordering and SQL role/RLS,
  PKCE mismatch, expiry and single-use code redemption tests in local PGlite.
- Single JavaScript SDK bundle with inline CSS: 1,312,706 bytes, below 5 MB.
- Build-only feature-branch CI workflow added. No deployment or submission steps.
- Full Tina/Next preview build and GitHub CI passed for 417e5d4. Current follow-up
  SDK follow-up adds a 30-second fetch timeout and account/retry behavior tests;
  production configuration is unchanged.

## Staging status

- Isolated QA schema, canonical private bucket and authorization-code SQL are ready.
- QA-only DNS, HTTPS and alias access exception verified; hosted feature flag enabled.
- Named public OAuth provider saved to the existing Canva draft; S256 PKCE required.
- Updated QA SDK bundle uploaded and rendered in Canva. Connect opens QA login.
- 24 hosted HTTP checks passed, including signed-in consent, exact callback,
  token exchange, selection, private artwork transfer and canonical save.
- Local API regression now passes 22 checks, adding damaged/truncated PNG and
  oversized token-body rejection. Hosted consent adds two checks when rerun.
- Seven live QA plan states preserve canonical access decisions and entitlement
  records after artwork save; transaction-only fixtures were rolled back.
- QA SMTP credential repair, browser sign-in and actual design export remain pending. Complete endpoint abuse
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

## Localization preparation

- 34 messages have stable IDs, English text and translator descriptions.
- Official FormatJS extraction runs during the build and writes
  translations/messages_en.json; catalog shape/limits and ICU formatting pass.
- Visible settings, preview/alternative text and publisher/API errors are localized.
- Preview error state is recoverable; error alerts and busy state are exposed.
- The source catalog is prepared for approval; it has not been submitted for
  translation or marketplace review. Actual translated locales, pseudolocalization,
  mobile and assistive-technology acceptance still require QA.
