# Canva integration — verified repository contracts (2026-10-20)

## Verified from current native source
- `features/gatherings/services/gatheringService.ts` defines `createGathering(input, ownerUserId)` and writes to the existing `gatherings` table. It persists `duration_type` and `gathering_end_date` for multi-day gatherings.
- `types/database.ts` defines `Gathering.duration_type: 'single_day' | 'multi_day'`, `gathering_date`, and `gathering_end_date`.
- `features/invitations/services/invitationService.ts` defines `uploadInvitationArtwork(gatheringId, file)`. It uploads to the private `invitation-artwork` bucket and calls `save_invitation_artwork` RPC. Existing modes include `p_and_p`, `uploaded`, `details_only`.
- Native invitation uploads accept image and PDF formats. The Canva flow must use the existing storage and RPC contract; do not write invitation metadata directly.
- Existing gathering listing uses `list_my_gatherings_with_lifecycle` RPC.

## Design implications
1. Canva is an acquisition surface, not a new gathering backend. Do not create a second event schema.
2. Multi-day dates are already first-class on gatherings. The exact itinerary activity storage/API still requires verification; do not invent one.
3. Opt-in Canva invitation artwork must flow through the existing private storage and `save_invitation_artwork` authorization, or a server-side equivalent that preserves its permissions.
4. Opt-out must not export or store Canva design assets.
5. Use short-lived, server-validated state for Canva-to-Place & Plenty handoff, and ensure account authorization before any asset attachment.
6. Existing Plus, Gathering Pass, and Multi-Day Pass rules must remain authoritative.
7. The Canva marketplace app should not advertise competing printing services.

## Engineering checklist (not yet implemented)
- [x] Identify canonical gathering creation fields and duration support.
- [x] Identify invitation artwork bucket and RPC.
- [ ] Inspect web auth routes and decide secure Canva callback endpoints.
- [ ] Identify itinerary persistence/service for multi-day activities.
- [ ] Confirm current Canva SDK content-publishing capabilities and app registration.
- [ ] Implement Canva client app, server handoff, and tests.
- [ ] Run preview QA before submitting marketplace listing.

## Relevant source files
- https://github.com/AlexisMHW/placeandplenty-native/blob/v1-pre-monetization/features/gatherings/services/gatheringService.ts
- https://github.com/AlexisMHW/placeandplenty-native/blob/v1-pre-monetization/features/invitations/services/invitationService.ts
- https://github.com/AlexisMHW/placeandplenty-native/blob/v1-pre-monetization/types/database.ts
