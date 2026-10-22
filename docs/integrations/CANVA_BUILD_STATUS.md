# Canva integration build status

Draft app: AAHOGO4RP4c. Branch: feature/canva-hosting-integration. PR: #26.

The official SDK application compiles into one approximately 1.31 MB JavaScript
bundle with inline UI Kit CSS. Both TypeScript checks pass. Current local results:
104 web tests and 33 Canva tests pass, including PostgreSQL/PGlite authorization
code tests and the real FormatJS message-ID regression test.

The previous feature commit c4bc648 passed GitHub CI and the full Vercel Tina/Next
preview build. Existing preview credentials support Tina; no additional Tina
credentials are required from the owner. The local full build lacks those secrets.

The approved corrected bundle loads in the existing Canva draft. Disconnected
publishing is disabled and the Not now handoff opens the host route. Live OAuth
and artwork transfer are not yet verified end to end.

The approved isolated Supabase QA branch is edfqrmkrfqnovzrryrxa. Canonical
migrations and Canva authorization-code SQL are applied there. Its scheduled jobs
and external push trigger are disabled before fixtures are introduced. No production
data was copied. Branch-only Vercel preview variables point to QA, with the Canva
feature flag still false. The draft OAuth provider has not been saved.

Live transaction-only QA passed owner/accepted cohost selection, storage and RPC
writes; unaccepted invitee/stranger listing, storage and RPC denial; authorization
code ownership, denied table reads, PKCE mismatch and replay. The fixtures were
rolled back. QA required matching the existing production table grants for
gatherings, gathering_members and profiles; no production grants were changed.
See `qa/canva-permissions.sql` (guarded against nonempty databases).

Real HTTP API mode passed Auth, token exchange, storage bytes, canonical RPC saves,
access rejection and concurrent replacements. The signed-in consent test is still
blocked locally by restricted Edge-runtime egress. The full preview build and CI
passed for 417e5d4. See `CANVA_QA_VERIFICATION.md` for evidence and the exact new
Bluehost CNAME needed for the prepared feature-only QA domain.

Remaining gates: paid entitlement matrix, public staging
access compatible with Canva OAuth (current preview is Vercel protected), draft
OAuth setup, live transfer, retry/concurrency, endpoint rate limits and expired-code
retention. Production permissions, entitlements and configuration are unchanged.
No merge, production deployment or Canva submission is authorized.
