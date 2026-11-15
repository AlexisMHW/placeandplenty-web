# Follow-up J: payout access, partial-refund holds, photo window, environment-safe links

Separate from the reviewed 61-step package (which is unchanged). SQL: `cc_sql/followup/` (byte-identical copy of native `supabase/qa_package/followup/`, own `FOLLOWUP_ORDER.tsv`).

## GATE 8 PREREQUISITE
Paid referrals must NOT be enabled (`hc_activate_paid_referrals`) until the follow-up (217490, 217491) is applied and verified. Without it a commission held for a partial refund has no release path, and a non-owner with `hc.payout` could still create a payout draft at the database.

## Payout access: VIEW vs ACT (Task 2)
| | who | database | web |
|---|---|---|---|
| VIEW payout history, ledger, clawbacks, eligibility, partial-refund holds | `hc.payout` holders (today only the owner role holds it; a future finance role may) | `hc.payout` | `canViewPayouts` |
| ACT: draft, approve, record external payment, void, reverse, settle clawback, release/reverse a partial-refund hold, terms, paid-referrals switch | owner only | `hc_is_owner()` (draft: 217491; hold resolution: 217490; the rest: 217430) | `canActOnPayouts` / `requirePayoutOwner` (404 for anyone else) |
`hc_is_owner()` is true only for an ACTIVE staff member with role `owner`. A `hc.read`-only manager sees nothing. Nothing moves money; payments happen outside the app.
Existing suite `ts217470` labels L2..L8 pin the OLD rule ("a non-owner with hc.payout can draft"); after 217491 that block stops at L2 on purpose (10 labels, no FAIL). `ts217491` covers the new rule. The web test `command-center-ops` now expects 5 owner gates (the new hold-resolution action).

## Partial-refund hold resolution (Task 1)
Owner decides per held commission (`held` / `partial_refund_review`): release (back to `pending`, then the normal 45-day / $50 / owner-approved path) or reverse (terminal). Note and typed confirmation required. Refused for open dispute, lost dispute, full refund, invalid entitlement, or a commission already in a payout. Replays are no-ops; a LARGER partial refund than the one reviewed holds it again. UI: Payouts page, section "Partial-refund holds" (owner sees the two forms; others read-only).

## Photo window boundary (Task 3): NOT changed, behaviour documented
Rule: guests/members may add photos to a completed gathering while `now() < lifecycle_ends_at` (event end + 30 days), i.e. the window is half-open: it closes AT the instant, not after it.
Evidence: trigger `enforce_gathering_photo_window` (217450): `if v_ends is null or not (now() < v_ends) then raise 'gathering_read_only' ... hint 'photo_window_closed'`; the existing helper `gathering_photos_are_editable` (phase17) uses `now() < gathering_lifecycle_ends_at(...)`; test `ts217400` V0.2 expects `g30=false` ("boundary closed", gathering whose end is exactly now) while `g30m` (ends in 1 second) is `true`, and V1/V2 assert every photo operation is refused for `g30`.
One-line inclusive change (NOT applied; needs the same edit in the helper and the 217450 trigger, plus the V0.2 expectation): `now() < v_ends`  ->  `now() <= v_ends`.

## Environment-safe links (Task 4)
Guard `base-url-guard.ts` (identical in native `lib/config/baseUrlGuard.ts`, edge `_shared/baseUrlGuard.ts`, web `lib/base-url-guard.ts`; SHA identity tested). Non-production = QA Supabase ref / any non-production Supabase URL, hosting env other than production (`VERCEL_ENV`), or an app-env flag other than production. No signal = production (unchanged behaviour, so unit tests and existing production builds are unaffected). In non-production the base must be explicitly configured and is refused for placeandplenty.com / www. in any disguise (case, trailing dots, repeated www, ports, credentials, userinfo trick, lookalike host, punycode, unicode/zero-width/whitespace, query/fragment, http except localhost). Refusal means: no link (or HTTP 503 `site_url_not_configured` on the web API routes), never a silent production link.
Guarded call sites: native password reset redirect and print-studio link (`webBaseUrl`), share-by-text base, invitation-email guest link, unsubscribe link, email footer (last line of defence), paper-order status source (`sync-paper-order-status`), EAS build isolation rule (`EXPO_PUBLIC_WEB_BASE_URL`); web checkout, billing portal, paper-suite checkout / quote / print-file return URLs, host share-by-text base, creator referral link, checklist emails, HC notification dispatch.
Intentionally production in every environment: SEO canonical URLs, sitemap, robots, structured data, OpenGraph, marketing pages (`app/layout.tsx`, `StructuredData`, marketing page metadata), the auth redirect allow-list parser (`lib/auth-redirects.ts`, a relative-path check, not a link), the unused `APP_DOWNLOAD_URL`, support / reply-to addresses (`@placeandplenty.com`), legal and store URLs. Production defaults for the guarded sites remain placeandplenty.com when the context is production.
Operator note: QA / preview deployments now NEED explicit `NEXT_PUBLIC_SITE_URL`, `GUEST_PAGE_BASE_URL` (web), `EXPO_PUBLIC_WEB_BASE_URL`, `EXPO_PUBLIC_GUEST_PAGE_BASE_URL` (native), `EMAIL_UNSUBSCRIBE_BASE_URL`, `GUEST_PAGE_BASE_URL`, `PAPER_STATUS_SOURCE_BASE_URL` (edge functions) set to non-production hosts, otherwise the related links/features are refused by design.
