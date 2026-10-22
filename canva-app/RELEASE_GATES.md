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
