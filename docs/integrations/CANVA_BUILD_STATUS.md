# Canva integration build status

Draft app: AAHOGO4RP4c. Branch: feature/canva-hosting-integration. Draft PR: #26.

The official Canva SDK/UI Kit publisher compiles to one 1,312,658-byte JavaScript
bundle with inline CSS. Both TypeScript checks pass; 108 web tests and 50 Canva
tests pass. The named single-account OAuth provider is explicit in SDK code.

Feature CI and full Tina/Next preview builds passed. Existing Vercel Tina
credentials are sufficient; no additional Tina credentials are needed from the
owner. QA preview e710f7d passed both CI runs, the full build and 24 hosted checks; it is ready and uses isolated Supabase edfqrmkrfqnovzrryrxa.

The owner added the new Bluehost CNAME. DNS, branch routing and HTTPS are verified
for canva-qa.placeandplenty.com. An access exception applies only to that QA alias;
project-wide protection and production domains were not changed. The feature flag
is enabled only on the feature-branch preview. The QA hostname receives noindex
headers, verified on the hosted feature build.

The existing Canva draft has the saved public OAuth provider placeandplenty,
client ID place-and-plenty-canva-qa, mandatory S256 PKCE, exact QA endpoints and
Canva callback. The updated bundle was uploaded and loads in the draft. The
actual editor Connect flow opens QA login with the expected authorization request.
No Canva release or marketplace submission has been made.

Live database role tests passed owner/cohost selection/storage/RPC allow,
unaccepted-invitee/stranger denial, code ownership/read denial, PKCE and replay.
Hosted HTTP verification passed 21 checks including real QA sign-in, exact login
return path, rendered signed-in consent, callback code/state, token exchange,
private byte-identical PNG transfer, canonical artwork save, prior-artwork
preservation, and concurrent replacements. No production requests were made by
these tests. Fifteen canonical entitlement/subscription/lifecycle/artwork function
definitions match production exactly. QA scheduled jobs and external push remain
disabled. Synthetic test accounts/artwork are retained in QA; credentials are not
in git.

A transaction-only live QA matrix also passed Free, Gathering Pass, Plus,
Multi-Day, expired/refunded Plus and revoked Multi-Day cases. Canonical
Plus/Smart Closet/Multi-Day decisions and entitlement rows remained unchanged
after artwork saves; a paid stranger still could not access another gathering.
All matrix fixtures rolled back. See qa/canva-entitlements.sql.

PNG validation now checks chunk boundaries, CRCs, IHDR fields, ordering and final
IEND without inflating untrusted data. This is structural validation, not a full
image decode. Token and artwork bodies are bounded during streaming, independent
of Content-Length. Unit tests cover missing/false lengths, cancellation, exact
limits, stream failures and damaged/truncated PNGs.

Remaining gates: QA SMTP credential repair and human signup delivery; secure
browser sign-in and actual Canva editor export; broader lifecycle/expiry/
cancellation/reconnection; ambiguous network-loss retry;
endpoint abuse limits and authorization-code retention; accessibility/localization
and release review. No merge, production deployment or submission is authorized.

See CANVA_QA_VERIFICATION.md and canva-app/RELEASE_GATES.md for evidence and limits.

SDK follow-up: API requests now time out after 30 seconds, with no automatic
retry after an ambiguous network failure. The error asks the host to check the
gathering before retrying. Six UI behavior tests cover disconnected startup,
opt-in reset, expired sessions, canceled reconnect, account change and Not now.
Seven API tests cover scoped grants, omitted cookies, timeout signals, reconnection
and failure/no-retry behavior. UI tests mock UI Kit controls and do not replace
actual mobile, keyboard, screen-reader or localization QA.

The actual Canva uploaded-bundle preview rendered. Connect reached QA login;
Canva's Cancel returned with opt-in disabled. Not now opened QA /login?next=%2Fhost.
The complete editor export still needs secure browser sign-in. Automated fixture
credentials have not been injected into browser sessions.

Localization preparation now uses react-intl descriptors and the official
FormatJS extractor. All 34 visible SDK labels, consent text, preview states and
SDK/API errors have English source messages with translator notes. Build writes
translations/messages_en.json; catalog tests verify required fields, limits and
real message formatting. Canva translation upload/review and actual translated
locale acceptance are still pending. These changes do not translate or alter the
canonical website, shared account system or entitlements. Preview failures now
show a recoverable localized error; error alerts and busy state are exposed to
assistive technology. Real screen-reader/mobile acceptance remains pending.

Commit 41505f6 passed both GitHub CI runs and Vercel preview build. The final
short-label follow-up is locally tested. The QA bundle renders after upload.
Canva pseudolocales exercised both text directions on the disconnected screen;
long buttons were shortened after visual clipping was observed. Actual translated
locales, authenticated layouts and mobile/device checks remain release gates.
