# Canva review preparation — draft, 25 October 2026

This is a preparation package, not a submission. Production changes, merge,
translation uploads and submission require owner approval. Work belongs to
`feature/canva-hosting-integration`, draft PR #26.

## Listing copy for owner review

Name: Place & Plenty

Short description: Publish invitation designs to your gathering plan

Description: Create your invitation design, then save it to a gathering in
Place & Plenty. Continue planning guests, menus, shopping and who’s bringing
what in your Place & Plenty account. An account is required; existing gathering
permissions and plan limits apply.

Company: https://placeandplenty.com

Privacy: https://placeandplenty.com/privacy

Terms: https://placeandplenty.com/terms

Support: https://placeandplenty.com/support

These are proposed existing public destinations; verify their anonymous responses
and the portal's required fields before submission. Do not add Canva endorsement,
featured status, unsupported export formats or automatic guest delivery claims.

## Listing media and translations

- Select the official brand mark from existing assets with the owner. Prepare a
  nontransparent 512 × 512 square icon; do not redraw or distort the brand mark.
- Prepare the featured image using the current Developer Portal template. Show a
  finished invitation and the actual gathering selection/publication experience.
  The existing blank-canvas export proves transfer, but is not a finished-design
  marketing example. Confirm current featured-image dimensions before creating it.
- Existing QA screenshots document the real publish success and destination page.
  Review visible personal information before using them externally.
- UI strings are extracted to `canva-app/translations/messages_en.json`, including
  disconnect/reconnect errors. Review wording, narrow layouts and longer strings;
  translation upload is a separate owner-approved submission action.

## Reviewer instructions to prepare privately

1. Provide a dedicated confirmed reviewer account privately in Canva's review
   form; never commit passwords, tokens or email confirmation links.
2. Give that account an eligible gathering through normal application behavior.
   Keep normal plan restrictions; do not grant a review-only paid bypass.
3. Open a design, select Place & Plenty, connect and sign in. Confirm the named
   authorization consent, choose an authorized gathering and explicitly opt in to
   replacing its invitation artwork. Publish one PNG and open the destination.
4. Confirm the artwork appears in that gathering. Disconnect and reconnect;
   publishing requires a fresh selection and opt-in after expiry or disconnect.
5. Explain that invitation artwork is transferred, while gathering permissions,
   lifecycle and subscription entitlement decisions remain with Place & Plenty.

Only use QA credentials with the QA draft. Prepare the final production reviewer
instructions after approval of the production configuration.

## Security and retention facts

- OAuth uses exact callbacks, S256 PKCE and single-use 60-second authorization
  codes stored as hashes. Access grants are encrypted and last at most ten minutes
  or the underlying Supabase session expiry, whichever comes first.
- Reconnection requires authorization again; silent refresh is not implemented.
- Backend requests validate the existing user session and retain canonical
  membership, lifecycle, RLS and plan decisions. No service-role bypass is used.
- Artwork is private, size-limited and validated as PNG. Selection and replacement
  consent are explicit. Failed or repeated requests do not silently repeat an old
  replacement. Ambiguous committed-save responses preserve the uploaded object.
- Limits: 60 gathering reads/minute, 5 publish attempts/minute and 30/hour,
  10 code issuances/10 minutes, per account. Completed retry records last 24 hours.
- The pending revocation update stores grant hashes, user identifiers and expiry,
  not raw grants. Disconnect restricts Canva access without signing out the normal
  application. Its cleanup removes expired temporary integration records only.
- QA temporary-record cleanup runs every 15 minutes. It does not remove accounts,
  gatherings, invitations or entitlements. The new revocation extension is not
  live until the QA migration succeeds.

Review the published privacy wording against these facts before release. This
document does not amend the public privacy policy or assert legal review.

## Verification and release gates

| Gate | Evidence / remaining action |
| --- | --- |
| Existing real Canva export | Passed twice; private PNG and destination verified |
| Normal QA email signup | Owner confirmed email and sign-in; backend verified |
| New user through Canva → signup → email → Canva → publish | Still needs one continuous browser run |
| Revocation / expiry implementation | Local automated coverage; live QA blocked on migration |
| Revocation provider URL | Configure QA `/api/canva/revoke` after backend is ready |
| Full QA regression | Rerun updated HTTP harness after migration and preview update |
| Mobile and accessibility | Test actual Canva mobile, keyboard, focus, labels, alert announcements, light/dark and narrow layouts; record results |
| Recovery | Exercise expired session, rejected permissions, unavailable backend and disconnect failure in the real editor |
| Listing | Owner review of copy, approved brand icon and finished-design featured image |
| Submission | Portal checklist, private reviewer credentials, translations and owner approval remain |

Sequence: apply QA-only revocation SQL → publish feature preview → run hosted
regression → update draft SDK/provider → real browser tests → complete listing
media/reviewer package → present exact release plan for approval. Do not deploy
production or submit merely because QA passes.

## Official references

- https://www.canva.dev/docs/apps/authenticating-users/oauth/
- https://www.canva.dev/docs/apps/api/latest/user-auth-init-oauth/
- https://www.canva.dev/docs/apps/app-listing-guidelines/
- https://www.canva.dev/docs/apps/app-listing-guidelines/written-content/
- https://www.canva.dev/docs/apps/app-listing-guidelines/app-icon/
- https://www.canva.dev/docs/apps/app-listing-guidelines/featured-image/
- https://www.canva.dev/docs/apps/submission-checklist/
- https://www.canva.dev/docs/apps/design-guidelines/mobile/
- https://www.canva.dev/docs/apps/design-guidelines/accessibility/
