# Canva QA verification

Feature branch: `feature/canva-hosting-integration`. Draft PR: #26.
No merge, production deployment or Canva Marketplace submission is authorized.

## Story and evidence

A host connects from the official Canva Content Publisher, chooses an authorized
existing gathering, opts into invitation artwork, and saves the PNG through the
canonical private storage bucket and existing artwork RPC.

| Boundary | Evidence | Status |
| --- | --- | --- |
| Official SDK UI in Canva draft | `canva-draft-preview.jpg`; fixed real FormatJS message IDs | Passed disconnected preview |
| Automated checks | 104 web tests, 33 SDK tests, both TypeScript checks | Passed |
| Feature CI and full Tina/Next preview | Commit `417e5d433ca7d7710869855d67efad144fb9df6e`; preview deployment `dpl_BBUGiqfaCss4Kq7fQK3qRf4Jo56o` | Passed |
| Real database roles/RLS | Transaction-only `qa/canva-permissions.sql`: owner/cohost allow; invitee/stranger denial; code ownership/read denial/PKCE/replay | Passed |
| HTTP → Auth → private Storage → canonical RPC | `scripts/verify-canva-qa.mjs`: real synthetic QA sign-ins, token exchange, gather selection, opt-in, invalid PNG/access denial, byte-identical download, replacement preservation, concurrent requests | Passed 21 hosted checks |
| Login return path | Unauthenticated host route redirects to login with exact relative OAuth request in `next` | Passed |
| Signed-in login → consent → Canva callback | Hosted test with real QA session cookies rendered consent and returned 303 to the exact callback with code/state; token exchange and replay denial passed | Passed hosted HTTP |
| Canva OAuth provider and export | Named QA provider saved in draft; PKCE required; 1,306,648-byte bundle uploaded and loaded; Canva popup opens correct QA login | Browser sign-in/export pending |

## Isolation and parity

- Supabase QA project: `edfqrmkrfqnovzrryrxa`; production data was not copied.
- Scheduled host reminders/communication jobs are inactive; external push trigger
  disabled in QA. Synthetic addresses use `example.invalid`; no mail is sent.
- Replay needed QA prerequisites `pg_trgm` and `rls_auto_enable`. Existing production
  table grants for gatherings, gathering_members and profiles were matched in QA.
  RLS policies were preserved. No production database changes were made.
- Fifteen existing entitlement/subscription/pass/multi-day and publisher-related
  function definitions match production exactly (hash comparison).
- Synthetic QA users, a gathering and test artwork are retained for review. Private
  credentials are outside git. No production users or records were changed.
- Security advisors were reviewed. The code-redemption security-definer function
  is intentionally executable by anon, denies table reads, uses an empty search
  path, and requires random-code knowledge plus the PKCE challenge. Do not treat
  the advisor warning as a reason to broaden grants or remove RLS.

## Staging DNS handoff

Vercel now associates **only** `canva-qa.placeandplenty.com` with the feature branch.
The existing apex and www domains retain their production assignments. Current
project protection also covers custom preview domains. An explicit access
exception was applied only to the QA alias after DNS was added; project-wide
protection and production settings were not changed. The QA certificate was
issued, and unauthenticated HTTPS /login returned 200. No Vercel bypass token
is embedded in the SDK.

Authoritative DNS is at Bluehost. The owner added the following record, and
Vercel verified it with no conflicts (`misconfigured: false`):

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `canva-qa` | `42114b3d73cef216.vercel-dns-017.com` | Default |

Do not replace apex, www, MX, TXT or nameserver records. DNS propagation and HTTPS
must be verified before enabling the QA flag or configuring the Canva draft.
No new domain purchase is needed.

After DNS is ready:

1. Verify QA HTTPS and branch/database isolation; test the real login/consent path.
2. Enable the Canva flag only for this feature-branch preview and rebuild preview.
3. Configure draft public OAuth client `place-and-plenty-canva-qa`, PKCE S256 on,
   authorization URL `https://canva-qa.placeandplenty.com/host/canva/authorize`, token
   URL `https://canva-qa.placeandplenty.com/api/canva/token`, callback
   `https://www.canva.com/apps/oauth/authorized`, exact scopes
   `gatherings:read invitation:write`. No client secret is required in public mode.
4. Rebuild SDK with `CANVA_BACKEND_URL=https://canva-qa.placeandplenty.com` and upload
   only to the existing approved Canva draft, then verify actual design export.
5. Complete paid-plan matrix, expiry/cancellation/reconnection, network-loss retry,
   endpoint abuse limits and authorization-code retention before release review.

The feature-branch-only flag is enabled on QA preview cf885b7. The full Tina/Next
build is ready. Hosted consent/API verification passed 21 checks. SDK now names
the configured provider explicitly (`placeandplenty`, single account).
The actual Canva editor connection reaches QA login and is awaiting secure
browser sign-in. No production account was copied to QA.
No production rollout is implied by DNS.

## QA signup email repair

Live QA signup attempts returned HTTP 500 with SMTP error
`535 Authentication credentials invalid`. This is separate from the earlier
password-login error. Dashboard inspection confirmed custom Resend SMTP is
enabled on the QA branch at smtp.resend.com:465, with a stored hidden credential.
The failing credential has not been replaced or exposed.

The QA Auth Site URL was also still pointing to production. It is now saved as
https://canva-qa.placeandplenty.com, and the exact QA /auth/callback entry has been
added to the redirect allowlist. Existing entries were retained. Screenshot:
canva-qa-auth-urls.jpg. No production Auth settings were changed.

Remaining blocker: the owner must enter a valid Resend API key as the QA SMTP
password (SMTP username resend), then save it. Browser security requires manual
entry/submission when replacing authentication credentials. Do not put the key
in chat, git, screenshots or client code. Keep email confirmation enabled.
Afterward verify actual signup email delivery and the return to QA before
continuing the Canva editor connection.

## Additional plan and upload validation

`qa/canva-entitlements.sql` passed against the isolated QA database as one
transaction and rolled back its fixtures. Seven cases cover Free, Gathering
Pass, Plus, Multi-Day, expired Plus, refunded Plus and revoked Multi-Day.
It verifies the canonical Plus/Smart Closet/Multi-Day predicates before and
after artwork save, unchanged entitlement rows, and denial for a paid stranger.
It does not claim a full billing or all-feature plan audit.

The API harness now also tests damaged PNG CRCs, missing final chunks and token
requests over 8 KiB. The tiny PNG fixture was corrected to have a valid IDAT CRC;
previous byte-equality checks alone did not establish chunk integrity.
SMTP was deliberately deferred at the owner's request. Confirmed synthetic
accounts permit API testing; human signup and actual editor transfer remain gates.

## SDK account and retry follow-up

Commit e710f7d passed both GitHub CI runs and the full Tina/Next preview build;
its hosted consent/API regression passed 24 checks. The updated SDK adds bounded
30-second API fetches without automatic retries. A lost save response asks the
host to check their gathering; manual retries are not cross-request idempotent.
Six component behavior tests cover opt-in reset, disconnected/expired/canceled/
reconnected account paths and Not now. Seven API tests cover grants, cookies,
timeout signals, errors and no retries. These tests mock UI Kit rendering and
do not certify real keyboard, screen-reader, mobile or localization behavior.

Live Canva preview renders with JavaScript bundle selected in Preview options.
The fresh browser default used the development URL localhost:8080 instead.
Connect opened the QA login. Closing that popup alone left Canva connecting;
Canva's explicit Cancel returned to the safe disconnected state. Not now opened
QA login with next=/host. Actual editor export remains unverified.

Localization preparation: 34 centralized react-intl messages include English
source and translator notes. The official FormatJS CLI generates the catalog
at build time. Catalog tests enforce the required schema/limits and validate
all source messages with real FormatJS. Localized image alternative text and
failed-preview recovery are component-tested. The QA SDK is 1,312,658 bytes.
The translation catalog is prepared locally; translation submission/approval and
actual translated-language acceptance remain pending.

Actual draft localization check: the 1,312,658-byte bundle is uploaded and renders
with the shorter Connect account / Create a gathering / Not now labels. Both
left-to-right and right-to-left pseudolocales rendered in Canva; this exercises
the disconnected screen, not authenticated selection or a mobile device. The
initial long button labels clipped under expansion and were shortened. The
final English preview is saved as canva-qa-localized-sdk.jpg. No translation file
or marketplace review was submitted. Commit 41505f6 passed both GitHub CI runs
and Vercel preview build; the final short-label follow-up is locally tested.

## Safeguards regression — 23 October 2026

- QA-only rate-limit/idempotency migration and temporary cleanup schedule applied.
- 26 real API checks pass locally against isolated QA Auth/PostgREST/Storage;
  signed-in browser consent is not claimed by local API mode.
- Concurrent identical publishes complete once or return safe in-progress;
  completed replay retains the exact canonical path; changed-content reuse fails.
- 111 web and 60 SDK tests pass; both typechecks and QA SDK build pass.
- Live transaction-only quota/account/grant checks and seven-state entitlement
  matrix pass, with synthetic SQL fixtures rolled back.
- Admin-only private tables intentionally have RLS and no client policies/grants;
  the security advisor's informational no-policy findings are expected for them.
- Cleanup affects temporary Canva records only. No canonical artwork is deleted.
- Remaining: hosted regression of this revision, refreshed Canva draft upload,
  human email delivery/sign-in, actual editor export, renewal/revocation and
  wider device/accessibility/review acceptance. No production release approved.
