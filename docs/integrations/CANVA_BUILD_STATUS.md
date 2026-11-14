# Canva integration build status

Branch: `feature/canva-hosting-integration`. Draft PR: #26.
Canva draft: `AAHOGO4RP4c`. No merge, production deployment or marketplace
submission is authorized or performed.

## Verified current behavior — 24 October 2026 (Nashville)

The real Canva browser flow now passes: confirmed QA account sign-in, explicit
OAuth consent, authorized gathering selection, invitation opt-in, Publish now,
Canva's publication-success dialog, and Check it out into the QA gathering.
The original empty 800×600 Canva test design exported a 4,322-byte PNG. The
canonical private object was downloaded as the same authenticated QA host,
passed structural PNG validation, and has the expected 800×600 dimensions.
Canonical invitation mode is `uploaded`; the request ledger is completed and
its object path matches the gathering's artwork path.

Evidence: `canva-qa-real-publish-success.jpg` and
`canva-qa-published-gathering.jpg`. This proves the actual editor transport and
persistence flow; it is not a visual-quality test of a finished invitation.

A new synthetic, already-confirmed Free QA account and one test gathering were
prepared for the owner. No subscriptions/paid entitlements were added. Its
credentials remain outside the repository. This deliberately bypassed email
delivery for this one QA account. A subsequent normal QA email signup,
confirmation and sign-in passed after the owner repaired the SMTP credential;
see the 25 October update below.

## Permission regression repaired

The first real export exposed a bug in our private publishing guard: calling
the canonical invoker/RLS gathering list from a SECURITY DEFINER bypassed its
row filter, causing lifecycle checks on unrelated hosts' gatherings. The
canonical lifecycle function correctly denied that access, blocking publishing.

`canva_selected_gathering_guard.sql` replaces only the integration's private
guard. It checks canonical accepted membership first, then the selected
identifier's canonical lifecycle and duration. Canonical membership, lifecycle,
artwork-save functions and all RLS policies remain unchanged. Apply this patch
immediately after `canva_publisher_safeguards.sql`, before enabling publishing.
The regression fixture now includes two unrelated owners and models the real
invoker/RLS list plus guarded lifecycle function.

The QA Host Hub also lacked SELECT grants from the production bootstrap.
Authenticated SELECT on seven required tables was observed in production;
their QA RLS policies were hash-matched before granting the same SELECT rights
in QA only. No policies, production grants or write rights changed. The
post-publication gathering page now loads normally and displays Free access.

## Implementation and testing

- Official SDK/UI Kit isolated from the Next.js app; one QA-targeted bundle,
  1,313,948 bytes, with inline CSS. Latest tested bundle saved to the Canva draft.
- 111 web tests and 63 SDK/database tests pass; both TypeScript checks pass.
- 28 hosted QA HTTP checks pass with the additional unrelated host present,
  including consent, PKCE/replay, owner/cohost/stranger authorization, private
  PNG transfer, concurrent duplicate requests and completed-request replay.
- Live transaction-only quota/private-grant checks and seven entitlement states
  pass and roll back their fixtures. No paid capability was granted.
- Recoverable publish errors now reach an accessible settings alert through
  Canva's documented context callback. Only known localized error text is
  displayed; raw exceptions and unknown payloads are excluded. Safe server
  diagnostics contain bounded reason categories and validity booleans only.

Per-account limits: 60 gathering reads/minute, 5 publishing attempts/minute and
30/hour, 10 authorization-code issuances/10 minutes. Stable request IDs serialize
retries; canonical save and ledger completion share a transaction. Ambiguous
save responses preserve artwork. Completed request records remain for 24 hours.
QA-only cleanup every 15 minutes removes temporary codes, quota events and aged
request records, never accounts, gatherings, entitlements or artwork.

## Environment and remaining release gates

QA uses Supabase `edfqrmkrfqnovzrryrxa` and
`https://canva-qa.placeandplenty.com`. Only the feature preview is enabled. Copied
notification jobs and external push remain disabled. Production is unchanged.
Existing Vercel Tina credentials work; no Tina credentials are needed from the owner.

Remaining: renewable/revocable connections (current grants expire within ten minutes), broader device,
accessibility/localization and recovery testing, listing/security review and
owner release approval. No translation upload/review submission has occurred.

## QA email signup verified — 25 October 2026

The owner saved a replacement Resend SMTP credential in the isolated QA project,
completed normal email/password signup in their own browser, received the email
and confirmed it. Read-only QA backend verification found the new account created
at 04:05:42 UTC, confirmed at 04:06:13 UTC and signed in at 04:08:25 UTC. No email
address, password, API key or confirmation token is recorded here.

This clears the QA SMTP/signup-confirmation delivery blocker. The prior real
Canva export test also remains complete. These were separate flows: a brand-new
user's entire signup-to-Canva-return journey is not claimed as one continuous
browser test. Production email configuration was not changed or verified.

## Local connection completion — 25 October 2026

The next change implements explicit reconnect after expiry, selection/consent
reset, a Disconnect action, backend revocation checks and an OAuth revocation
endpoint. Grants remain bounded to ten minutes; silent refresh is not implemented.
Disconnect revokes only the Canva grant, not the normal Supabase session.

This implementation is local and has not replaced the working hosted QA version.
It requires `sql/canva_grant_revocation.sql` before the new backend is enabled.
Two Supabase migration attempts returned `Invalid or expired requestState`;
subsequent read-only checks confirmed the new table was absent. Do not publish
the mandatory revocation checks against a backend without this migration.
Read-only connector access still works. No production changes were attempted.

Local verification: 114 web tests, 70 SDK/database tests, both TypeScript checks,
and a QA-targeted SDK build (1,315,316 bytes). Updated HTTP regression checks
cover revocation, disconnect, fresh independent grants and preserving the normal
application session; they still need to run against the migrated live QA backend.
The full Next/Tina build has not been repeated for these local changes.

`CANVA_REVIEW_PACKAGE.md` contains draft listing copy, security/retention facts,
reviewer steps, media requirements and the remaining release checklist. Listing
media, continuous new-user browser testing, actual mobile/accessibility testing
and owner-approved translation/review submission remain open.

## QA revocation verified — 25 October 2026

After owner approval of the dashboard fallback, GitHub sign-in reached the
`canva-publisher-qa` preview SQL editor. The revocation SQL completed in one
transaction, with a visible success result. Production was not opened or changed.
The earlier connector error no longer blocks the QA schema. Evidence:
`canva-qa-revocation-applied.jpg`.

The current local Next backend against the live isolated QA database passed all
36 HTTP checks, including ten new revocation/disconnect checks. Revoked grants
cannot list or publish, fresh grants remain independent, repeated revocation is
idempotent, unknown tokens are non-enumerating, and the ordinary Place & Plenty
session remains valid. Existing owner/cohost/stranger, private PNG, concurrency
and retry checks also passed. This local run does not claim signed-in browser
consent or the hosted preview update; those are the next verification steps.
