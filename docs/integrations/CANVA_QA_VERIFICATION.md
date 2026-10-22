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
| HTTP → Auth → private Storage → canonical RPC | `scripts/verify-canva-qa.mjs`: real synthetic QA sign-ins, token exchange, gather selection, opt-in, invalid PNG/access denial, byte-identical download, replacement preservation, concurrent requests | Passed 19 API checks |
| Login return path | Unauthenticated host route redirects to login with exact relative OAuth request in `next` | Passed |
| Signed-in login → consent → Canva | Test client session validates; local Edge middleware reports `AuthRetryableFetchError: fetch failed` in restricted runtime | Requires unrestricted staging test |
| Canva OAuth provider and export | Draft provider not yet configured; QA feature flag false on hosted preview | Pending |

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

The feature-branch-only flag has been enabled for the next QA preview rebuild.
The prior deployment remains unchanged until that rebuild is ready.
No production rollout is implied by DNS.
