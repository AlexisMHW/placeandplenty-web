# Place & Plenty Canva Content Publisher

Development only, branch `feature/canva-hosting-integration`, draft PR #26.
Existing Canva draft app: `AAHOGO4RP4c`. No portal registration, upload or
submission is needed to run the local build or tests below.

## Local SDK build

The Canva CLI 2.15.0 Content Publisher starter files were downloaded locally.
The scaffold command was then blocked by automatic approval review when it
contacted Canva's API despite `--offline`. It was not retried. The checked-in
manifest, SDK/UI dependencies, declarations, styles and license come from
that downloaded starter. The placeholder implementation has been replaced.

```sh
cd canva-app
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
```

The local esbuild script generates **one** `dist/app.js`, including UI Kit CSS,
checks the 5 MB ceiling, and makes no Canva portal calls. This is an official
SDK application compiled with a local bundler, not a completed `canva apps build`
or a Canva preview test. The local build defaults to `http://localhost:3000`.
Set `CANVA_BACKEND_URL` to the approved staging HTTPS origin before preview.
Do not upload a localhost-configured CI bundle as a release build.

## Authentication and backend

- Deferred OAuth through `auth.initOauth()`; no embedded credential collection.
- Authorization URL: `<backend>/host/canva/authorize`. Existing login/signup and
  safe relative `next` carry the request back to an explicit consent page.
- Token URL: `<backend>/api/canva/token`, authorization-code grant only.
- Exact registered client and callback, S256 PKCE, fixed scopes
  `gatherings:read invitation:write`, client-secret authentication at exchange.
- Random codes are stored hashed, expire in 60 seconds and are consumed atomically.
  A review-only SQL proposal is in `docs/integrations/sql/canva_authorization_codes.sql`.
  It has **not** been applied to any shared database. Local PGlite tests execute
  this SQL with test auth identities and PostgreSQL roles/RLS.
- Supabase access tokens are AES-256-GCM encrypted server-side. The opaque OAuth
  token expires within ten minutes or at the underlying session expiry. No
  refresh token is stored or issued; reconnect when expired.
- API calls revalidate the underlying user and execute as that user, using the
  existing anon key and RLS. There is no service-role client.

Staging-only server configuration (not committed):

| Variable | Purpose |
| --- | --- |
| `CANVA_PUBLISHER_ENABLED=true` | Explicit gate; disabled by default |
| `CANVA_APP_ORIGIN` | Exact app iframe origin copied from the existing draft app |
| `CANVA_OAUTH_CLIENT_ID` | Registered OAuth client ID |
| `CANVA_OAUTH_CLIENT_SECRET` | Server-only client secret, configured in Canva OAuth |
| `CANVA_OAUTH_REDIRECT_URI` | Exact OAuth callback copied from Canva; never guessed |
| `CANVA_TOKEN_ENCRYPTION_KEY` | Server-only random 32-byte key encoded in base64 |
| Existing public Supabase URL/anon key | Same backend; no service-role secret |

Canva OAuth must be configured for PKCE S256, these exact scopes and endpoints.
These portal settings have not been changed. Verify Canva's client authentication
mode against the staging token endpoint before calling the connection complete.

## Gatherings and invitations

The gathering list uses `list_my_gatherings_with_lifecycle` under the host's RLS.
Only draft/active rows are offered; authorization/lifecycle are rechecked before
upload. Existing creation opens `/host/create`; after planning, return and refresh.
Single-day and multi-day creation, itineraries and upgrades stay in the existing
host app. This integration does not create gatherings or grant subscriptions.

Invitation opt-in starts unchecked. `Not now` only opens planning. An explicit
opt-in enables Canva publishing; the preview uses actual SDK preview media. The
publisher accepts one PNG, streams and bounds it to 10 MB, then posts bytes to the
backend (the server never fetches an arbitrary media URL). The backend checks PNG
signature/header and dimensions, uploads a new key in the private
`invitation-artwork` bucket and calls the existing `save_invitation_artwork` RPC.
Existing storage/RPC permissions remain authoritative. A failed metadata save
attempts removal of only the new object. Success is returned only after save.

A retry uses a fresh storage key, matching the current native upload convention.
Cross-request idempotency, concurrent replacement behavior, cleanup failure and
network loss after a successful save need staging QA. No immediate revocation
endpoint is provided; grants expire in at most ten minutes and underlying user
validation runs on every request. Do not release until the gates below pass.

See `RELEASE_GATES.md` for remaining validation and approvals.
