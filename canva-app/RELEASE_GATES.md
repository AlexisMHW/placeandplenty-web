# Current release gate update — 24 October 2026 (Nashville)

The actual browser sign-in, consent, selected-gathering publish, canonical private
PNG persistence, Canva success dialog and Check it out gathering page now pass.
A confirmed synthetic QA account initially skipped email delivery. On 25 October,
the owner completed normal QA signup, received its confirmation email and
confirmed it; backend confirmation and subsequent sign-in are verified. Latest local totals: 111 web + 63 SDK/database tests; both typechecks
and QA bundle build pass. Bundle: 1,313,948 bytes. Hosted QA regression: 28 checks.

The private guard must include `canva_selected_gathering_guard.sql` after
`canva_publisher_safeguards.sql`; never enumerate the canonical RLS list from a
privileged wrapper. The regression includes unrelated hosts and real RLS behavior.
QA-only Host Hub SELECT grants match observed production rights and policies.

Remaining: connection renewal/revocation, broader device,
accessibility/localization/recovery testing, listing/security review and owner
approval. No production deployment, merge or Canva submission is approved.

The sections below retain the earlier implementation checkpoints as history.

# Canva publisher release gates

Status: implemented and locally tested; NOT APPROVED FOR RELEASE.

## Local verification

- Official Canva SDK/UI Kit dependencies and starter manifest isolated from Next.js.
- Root and Canva TypeScript checks pass.
- Web: 111 tests pass, including grant security, permission rejection and save cleanup.
- Canva: 60 tests pass, including publisher failure/success ordering and SQL role/RLS,
  PKCE mismatch, expiry and single-use code redemption tests in local PGlite.
- Single JavaScript SDK bundle with inline CSS: 1,313,486 bytes, below 5 MB.
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
- QA SMTP credential repair, browser sign-in and actual design export remain pending. Rate limits, duplicate protection and temporary-record retention are now implemented
  and applied to QA only; hosted preview verification passed 28 checks on 50c0510a. See the QA verification report.

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
  translation or marketplace review. Disconnected LTR/RTL pseudolocales render in Canva; connected flows, actual
  translated locales, mobile and assistive-technology acceptance still need QA.

## Safeguards follow-up — 23 October 2026

QA migration `canva_publisher_rate_limits_and_idempotency` is applied. The earlier
interrupted attempt had not changed the database. Limits are per authenticated
account: 60 gathering reads/minute, 5 publish attempts/minute and 30/hour, and
10 authorization-code issuances/10 minutes. Rejected attempts return a bounded
Retry-After; the SDK displays localized guidance and never retries automatically.
Direct authenticated code INSERT is replaced with a user-bound issuance RPC.

Each opt-in creates a stable request UUID. An account/request/content ledger
serializes concurrent attempts; canonical artwork save and ledger completion
share one transaction. Replays return the completed result without uploading or
reapplying older artwork. Changed content requires a fresh opt-in. Unknown save
responses retain the new object because commit may already have occurred; only
a confirmed PostgreSQL rejection permits removing that attempt's object.

QA-only cleanup runs every 15 minutes: consumed/expired authorization codes,
quota events older than one hour, and completed or abandoned request records
older than 24 hours. It never deletes accounts, gatherings, entitlements or
artwork. The idempotency guarantee lasts through this retention window.

Current local verification: 111 web + 60 SDK tests, both typechecks and QA-targeted
SDK build pass. The real QA API harness passes 26 checks, including concurrent
identical requests, completed replay and changed-content conflict. Live SQL tests
verify quota boundaries/account isolation/private grants and rerun all seven
entitlement cases with rollback. Hosted consent and transfer passed 28 checks on 50c0510a; both CI runs and the
full Tina/Next preview build passed. The updated QA-targeted bundle was uploaded
and renders in the actual Canva editor (see canva-qa-safeguards-preview.jpg). Existing short-lived grants remain
unchanged; renewable/revocable connections are a separate release gate.

Verified hosted revision: `50c0510a2d8a49e99f6c30d611936f4e4691ba7f`.
Both GitHub CI runs succeeded. Vercel preview `dpl_DW12jkxqqzXEM3qB9x7iy9mnnPxB`
is READY on the feature branch and QA alias. Hosted verification passed 28 checks,
including signed-in consent plus the new duplicate/concurrency controls. The
1,313,486-byte QA bundle is saved in the existing Canva draft and renders.
No translation submission, marketplace review, merge or production deploy occurred.
