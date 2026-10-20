# Place & Plenty × Canva — Integration Specification (V1)
Status: Approved product direction; implementation in progress
Branch: feature/canva-hosting-integration

## Product position
**Design in Canva. Gather with Place & Plenty.**
Canva is the creative design destination. Place & Plenty is the consumer home-hosting coordination system for everything between "people are coming" and the doorbell ringing. The preparation serves the people. The people are the point.

## Marketplace description (draft)
Your invitation is designed. Now get ready for your people. Place & Plenty turns the moment you finish designing into a manageable plan for your gathering. Coordinate RSVPs, menus, shopping, guest contributions, co-host responsibilities, and hosting readiness. Planning a multi-day gathering? Organize itineraries, activities, locations, schedules, and who is joining each part of the experience. Optionally use your Canva design as the digital gathering invitation—without leaving Canva behind for design or printing.

## Differentiation (prominent in listing and onboarding)
- Not an invitation designer: Canva remains the place to create and edit artwork.
- Not a print service: do not promote Place & Plenty/Gelato printing within the Canva app.
- Not a professional event-management suite: designed for ordinary hosts getting ready for people.
- Beyond RSVP: HostReady, My Table, My People, My Shopping List, My Hosting Closet, guest contributions, co-hosting, and realistic planning.
- Beyond one date: multi-day itineraries with activities, locations, timing, and participation.
- Optional design reuse: importing the current Canva design must be explicit opt-in, never automatic.

## Canva app flow
1. Host opens Place & Plenty from a Canva design.
2. Explain coordination value with single-day and multi-day examples.
3. Host signs in securely or creates a Place & Plenty account using approved authorization flow.
4. Host chooses existing gathering or creates a new one. New gathering supports single-day or multi-day.
5. If multi-day, collect dates and optional itinerary stops/activities; do not require all details at setup.
6. Ask: "Use this Canva design as your digital gathering invitation?" Choices: "Yes, use this design" / "Not now". No preselected opt-in.
7. If yes, export only with the host's action and permitted Canva SDK APIs; show a confirmation preview; associate asset with gathering using existing invitation service and storage rules.
8. If no, do not export or store the design. Continue directly to gathering dashboard.
9. Return a secure deep link to the appropriate gathering, with a browser fallback.
10. Keep editing and printing in Canva; do not include competitive print upsells in the Canva app.

## Multi-day requirements
- Itinerary day/date sections and activity cards (title, start/end time, venue/location, description).
- Optional per-activity attendance or RSVP where existing backend supports it.
- Guest updates, schedule changes, and co-host visibility.
- Shared contribution coordination across days.
- Support bachelorette weekends, family reunions, and wedding weekends without assuming one fixed itinerary template.
- Preserve existing Multi-Day Pass entitlement/paywall behavior; never grant premium rights through Canva alone.

## Technical guardrails
- Reuse existing Supabase auth, RLS, gathering IDs, invitation asset storage, and multi-day schema.
- Do not introduce a parallel invitations table, guest list, or event database.
- Validate Canva SDK capabilities and current developer policies before choosing export mechanism.
- Use server-side authorization and short-lived state tokens; never expose service-role keys in Canva client.
- Restrict media type/size, validate authorization, handle duplicate import and retry safely.
- No automatic design import, hidden upload, or blanket access to user's Canva projects.
- Analytics: canva_app_open, canva_auth_complete, canva_gathering_created, canva_multi_day_selected, canva_design_import_opt_in, canva_design_import_complete, canva_handoff_complete.
- Feature flag and preview-only deployment until QA and owner approval.

## Acceptance tests
1. Single-day gathering can be created without importing design.
2. Multi-day gathering can be created and opened to itinerary.
3. Opt-in imports only the selected Canva design and only to authorized gathering.
4. Opt-out does not export, save, or link artwork.
5. Existing host can select a gathering without creating a duplicate.
6. Unauthenticated user returns to correct flow after login.
7. Unauthorized users cannot attach assets to others' gatherings.
8. Entitlement enforcement is unchanged.
9. Canva app contains no print-service competitive CTA.
10. Web/native deep links and browser fallback behave safely.

## Pending code verification
Locate current gathering services, invitation asset schema, multi-day itinerary schema, and shared auth/deep-link implementation before writing production handlers. README files may be stale. Canva developer app registration, permissions, and marketplace review are external prerequisites.
