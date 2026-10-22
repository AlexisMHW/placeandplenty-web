# Place & Plenty Canva app — work in progress

Canva app ID: `AAHOGO4RP4c`
Distribution: Public (draft)
Intent: Content Publisher
Required permission: Design Read

## Source files
- `src/PublisherChoices.tsx`: single-day / multi-day and invitation opt-in UI
- `src/handoff.ts`: handoff selection contract

## Not yet runnable
These are initial React/TypeScript source components, not a compiled Canva bundle.
The Canva SDK starter, compiled bundle, authorization flow, existing gathering
selection, itinerary persistence, server handoff, and real content export handler
still need implementation. `prepareContentPublisher` is registered and settings
and preview screens now render, but the publisher deliberately returns an error
rather than claiming a successful upload. Do not upload these source files to Canva's
JavaScript bundle field; it requires a compiled application bundle.

## Safety
No changes to native code, OTA updates, app store builds, production databases,
or deployed web routes are included in this branch.

## Next implementation order
1. Scaffold the Canva Apps SDK project using the current Content Publisher starter.
2. Register the publisher intent and integrate PublisherChoices in the supported UI.
3. Verify existing web host auth, gathering and itinerary endpoints.
4. Build a secure host handoff and optional invitation import, with RLS.
5. Test with Canva preview; compile and upload only after validation.

## Confirmed website auth integration contract

The existing website already handles `/signup`, `/login`, `/auth/callback`, and `/host`. Canva must use these existing account routes; it must not implement a second identity provider or create paid entitlements. The callback's `safeNext` accepts same-origin relative destinations only. A Canva return flow therefore requires a separate short-lived, single-use server-side state exchange; never use an external Canva URL as `next`.

The Canva Content Publisher remains disabled until this return flow, authenticated gathering selection, and actual media transfer are implemented and tested. Existing database permissions and product entitlements remain unchanged by founder direction.

## Verified October 22 integration status

The source now renders initial settings and preview views and offers links to the existing Place & Plenty website. This does **not** establish an authenticated Canva session or complete a publishing operation. The production web app, database, and native apps remain unchanged. The Canva CLI project, compatible dependencies, compilation, test execution, one-time return state, authorized gathering selection, and durable artwork transfer remain release blockers. Never interpret a successful Next.js preview build as a compiled Canva Apps SDK bundle.
