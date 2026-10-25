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
delivery for this one QA account; normal signup/confirmation delivery remains
unverified and QA SMTP still needs repair.

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

Remaining: normal signup and confirmation-email delivery, renewable/revocable
connections (current grants expire within ten minutes), broader device,
accessibility/localization and recovery testing, listing/security review and
owner release approval. No translation upload/review submission has occurred.
