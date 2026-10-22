# Canva Content Publisher integration: release gates

Status: NOT READY TO SHIP. Feature branch only.

## Verified current repository facts
- The web app is Next.js 14 and has browser-safe Supabase public-form access.
- No authenticated `/api/gatherings` route was found at either `app/api/gatherings/route.ts` or `src/app/api/gatherings/route.ts`.
- The Canva integration directory currently lacks a standalone Canva CLI project, lockfile, compiled bundle, working settings/preview views, and authenticated publisher.
- The existing `src/intents/content_publisher/index.ts` is a **nonfunctional placeholder** and must be replaced using the official current template. Do not deploy or upload it.
- `src/handoff.test.ts` contains Vitest tests but Vitest has not been installed or the tests executed. Treat them as draft test specifications, not passing CI.

## Mandatory implementation and validation
1. Scaffold the official Content Publisher template using `@canva/cli` in an isolated development environment. Retain the template's version-compatible configuration and lockfile.
2. Build settings and preview UIs with Canva App UI Kit, and defer authentication until needed.
3. Add a dedicated, authorized Place & Plenty backend exchange that verifies the host's session, gathering ownership, subscription/entitlement, accepted media type and size, and protects against replay and cross-account access.
4. Reuse the existing invitation-artwork storage contract only after verifying its RPC arguments and RLS; never put service-role secrets in client bundles.
5. Implement upload and save of Canva output media, returning `completed` only after the backend confirms durable persistence.
6. Verify multi-day gathering date range and itinerary access. Do not imply itinerary creation is complete simply because the duration is selected.
7. Run typecheck, unit tests, SDK preview, end-to-end authenticated publish, rejected unauthorized publish, and rollback tests.
8. Obtain explicit approval before merging, production deployment, or Canva submission.

## Release separation
This work does not require modifying the native repositories, App Store Connect, Google Play, or OTA configuration. If requirements change, stop for approval.

## Official Canva SDK build procedure (verified against Canva documentation, 2026-10-22)

Do not attempt to build this directory as-is: it does not have a Canva CLI-generated project manifest, SDK dependency lockfile, or validated Content Publisher template.

1. In an isolated environment, use the Canva CLI to scaffold the **Content Publisher** template (official command: `canva apps create my-publisher --template content_publisher`). This must be a development project, not a new public Marketplace listing.
2. Install the template dependencies and preserve its generated manifest/configuration, versions, and lockfile. Migrate this branch's `PublisherChoices`, handoff validation, and host journey logic into that scaffold.
3. Replace the draft `renderSettingsUi` and `renderPreviewUi` with the template's version-compatible implementation using Canva App UI Kit. Validate the exact current Content Publisher callback types; do not assume the draft interface compiles.
4. Run `canva apps build` in the scaffold, producing `dist/app.js`. Canva requires a single JavaScript bundle, maximum 5 MB.
5. Run unit tests, typecheck, and Canva preview against the existing **draft** app. Do not upload for Marketplace review while the publisher returns `app_error`.
6. Build the secure one-time server-side account/gathering exchange and authorized upload endpoint, then test account switching, unauthorized gathering IDs, expired/replayed state, opt-out, multi-day entitlements, file limits, storage failures, and success persistence.
7. Only after the backend confirms durable invitation persistence may the Content Publisher return a completed publish result. Require approval before production merge or public submission.

Official references:
- https://www.canva.dev/docs/apps/intents/content-publisher/implementation-guide/
- https://www.canva.dev/docs/apps/app-templates/content-publisher/
- https://www.canva.dev/docs/apps/bundling-apps/

**Environment limitation:** This GitHub connector can edit repository files but does not execute the Canva CLI. A Vercel Next.js preview is not a Canva SDK build. Do not mark build or end-to-end tests passing without CI/build artifacts and logs.
