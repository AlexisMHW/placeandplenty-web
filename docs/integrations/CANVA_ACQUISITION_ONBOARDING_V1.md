# Canva acquisition-first onboarding — approved V1 amendment

**Approval:** Canva must acquire new Place & Plenty hosts, not only serve existing accounts.

## User journeys (all V1)
1. **New visitor:** Preview the value proposition -> choose Create a gathering -> secure Place & Plenty sign-up in an external authorization tab -> return to the same Canva session -> create the first gathering -> optionally publish the design.
2. **Existing account / new gathering:** Sign in -> Create a gathering -> single-day or multi-day wizard -> optionally publish.
3. **Existing account / existing gathering:** Sign in -> choose an eligible gathering -> optionally publish.

## UX rules
- Initial screen explains the value before authentication.
- Authentication occurs through a compliant separate browser tab, not embedded credential collection.
- The flow must preserve context through an opaque, short-lived, one-time state value. No user email, access token, or Canva design media in query strings.
- New users must be able to finish web onboarding without installing iOS/Android.
- Never preselect 'use my Canva design'. 'Not now' continues planning without exporting or publishing artwork.
- When an invitation is opted in, return to Canva for a preview and actual publisher action; never claim publication when no media is transferred.
- Multi-day gathering creation must use the same entitlement checks as normal Place & Plenty.
- Do not sell or advertise print services inside Canva.

## Measurement and attribution
Instrument (only after consent and privacy review):
`canva_app_open`, `canva_signup_started`, `canva_signup_completed`,
`canva_login_completed`, `canva_gathering_create_started`,
`canva_gathering_created`, `canva_existing_gathering_selected`,
`canva_design_opt_in`, `canva_design_published`,
`canva_handoff_completed`.
Record source `canva_marketplace` on acquisition and avoid duplicating signup counts on retries. Attribute first-gathering conversion and paid upgrades, not just app opens. Respect consent requirements.

## Engineering acceptance gates
- Both new-account and returning-account auth tested, including expired/canceled login.
- Existing account can create a new gathering, including multi-day.
- New account can create a first gathering and use web-only onboarding.
- Existing gathering selection enforces host membership.
- 'Not now' never exports design media.
- Opt-in preview precedes authorized media transfer.
- Invalid/expired/replayed auth state cannot be reused.
- Gathering and subscription entitlements match the existing app.
- Attribution survives auth return without putting secrets in URLs.
- No native code, app-store, or production change without explicit approval.

## Dependencies
Verify web account creation, session/callback endpoints, native-backed gathering service contracts and itinerary persistence before wiring live APIs. Current Canva publisher code is a fail-closed scaffold, not a functioning integration.
