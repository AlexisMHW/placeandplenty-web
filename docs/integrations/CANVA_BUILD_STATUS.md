# Canva integration build status

Draft app: AAHOGO4RP4c. Branch: feature/canva-hosting-integration. Draft PR: #26.

The official Canva SDK/UI Kit publisher compiles to one 1,306,648-byte JavaScript
bundle with inline CSS. Both TypeScript checks pass; 104 web tests and 33 Canva
tests pass. The named single-account OAuth provider is explicit in SDK code.

Feature CI and full Tina/Next preview builds passed. Existing Vercel Tina
credentials are sufficient; no additional Tina credentials are needed from the
owner. QA preview cf885b7 is ready and uses isolated Supabase edfqrmkrfqnovzrryrxa.

The owner added the new Bluehost CNAME. DNS, branch routing and HTTPS are verified
for canva-qa.placeandplenty.com. An access exception applies only to that QA alias;
project-wide protection and production domains were not changed. The feature flag
is enabled only on the feature-branch preview. The QA hostname receives noindex
headers in the next feature build.

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

Remaining gates: secure browser sign-in and actual Canva editor export; paid-plan
matrix and lifecycle/expiry/cancellation/reconnection; ambiguous network-loss retry;
endpoint abuse limits and authorization-code retention; accessibility/localization
and release review. No merge, production deployment or submission is authorized.

See CANVA_QA_VERIFICATION.md and canva-app/RELEASE_GATES.md for evidence and limits.
