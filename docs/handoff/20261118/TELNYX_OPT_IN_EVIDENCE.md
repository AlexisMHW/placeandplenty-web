# Telnyx / 10DLC opt-in evidence: Place & Plenty (WS1)

Prepared 2026-11-18 on branch `integration/20261118/core-release` (uncommitted, not published). SMS remains OFF (QA `sms_enabled=false`, `kill_switch=true`; no production SMS tables exist).

## 1. STATUS IN ONE LINE
The public opt-in page and its gated API exist in code and work locally against a mock backend. **The live consent form cannot be activated**: production has no SMS consent tables/RPC/edge function, QA has no consent edge function, and the existing consent RPC cannot store a consent that is not tied to a gathering. Nothing here is live or deployed.

## 2. Opt-in workflow (as built)
1. Person opens `https://placeandplenty.com/sms-opt-in` (no login). Page explains optional SMS: invitations, RSVP reminders, gathering updates; sender Place & Plenty; frequency varies (usually a few per gathering); message and data rates may apply; STOP to opt out, HELP for help; links to Privacy Policy and Terms.
2. Person types their OWN US mobile number. Consent is never inferred from a number a host entered; a host adding a guest does not opt that guest in (stated on the page).
3. Consent checkbox is UNCHECKED by default and is not required to RSVP, host or buy. Submit with an unticked box is refused client- and server-side.
4. Abuse protection: hidden honeypot field, minimum fill time (2.5 s), per-client rate limit (5 per 10 min per server instance, hashed IP, raw IP never forwarded), same-origin check, 2 KB body cap. Edge function must also rate limit by the hashed `client_key`.
5. Server route `/api/sms-opt-in` forwards `{source:"standalone_page", phone, accepted:true, wording_version:"v3", client_key}` to the `sms-consent` edge function. The browser never sends the wording; the edge records ITS OWN text for the version.
6. Evidence stored (per existing schema `sms_consents`): keyed phone hash + last4 (no raw number), `level=guest_confirmed`, `source`, `wording_version`, exact `wording_text`, `evidence` json, `captured_at` timestamp. An earlier STOP (`sms_suppressions`) is never cleared by the web checkbox; the guest is told to reply START.
7. Success is displayed ONLY when the edge answers `200 {ok:true}`. Any other outcome shows "nothing was saved". Gate: `NEXT_PUBLIC_SMS_STANDALONE_OPT_IN` must be exactly `true`; otherwise the page shows "Text sign-up is not open yet" with no form and the API answers 404.

Consent wording v3 (shown next to the checkbox; must be identical in the edge function; counsel approval pending):
> Text me invitations, RSVP reminders, and gathering updates from Place & Plenty at this number. Message frequency varies, usually a few per gathering. Message and data rates may apply. Consent is not required to RSVP, host, or buy anything. Reply STOP to opt out at any time or HELP for help. Terms: placeandplenty.com/terms. Privacy: placeandplenty.com/privacy.

## 3. Sample messages (templates must be confirmed against `templates.ts` in the app repo before submission)
- Invitation: "Place & Plenty: Sam invited you to Friday Supper on Nov 22. RSVP: https://placeandplenty.com/invite/<link>. Msg&data rates may apply. Reply STOP to opt out, HELP for help."
- RSVP reminder: "Place & Plenty: Reminder to RSVP for Friday Supper (Nov 22). https://placeandplenty.com/invite/<link>. Reply STOP to opt out, HELP for help."
- Gathering update: "Place & Plenty: Update for Friday Supper: the start time is now 7:00 PM. Reply STOP to opt out, HELP for help."
- HELP reply: "Place & Plenty: For help email support via placeandplenty.com/support. Msg&data rates may apply. Reply STOP to opt out."
- STOP reply: "Place & Plenty: You are opted out and will get no more texts. Reply START to resubscribe."
Names, dates and links above are illustrative placeholders, not real sends. No SMS has been sent.

## 4. URLs
| URL | Status |
|---|---|
| https://placeandplenty.com/privacy | NOT VERIFIED LIVE. WebFetch was refused for this host in this session ("URL not on the session's allowlist"). Route exists in repo (`app/(marketing)/privacy`). Its source header says "PENDING LEGAL REVIEW". Whether it currently states SMS terms was not checked. |
| https://placeandplenty.com/terms | NOT VERIFIED LIVE (same reason). Route exists in repo. SMS program terms not confirmed present. |
| https://placeandplenty.com/sms-opt-in | NOT LIVE / not verified. New in this working tree; requires publish. Expected to 404 today. |
Action: someone with fetch access should confirm privacy and terms return 200 and add SMS language (program name, frequency, rates, STOP/HELP, no sharing of mobile numbers for marketing) before submission.

## 5. Screenshot evidence
- LOCAL (not live) real renders of the real page from `next dev` with the flag on and a MOCK edge backend, headless Chrome, synthetic number 202-555-0123: `docs/handoff/20261118/screenshots/LOCAL_sms-opt-in_desktop_form.png`, `..._desktop_success.png`, `..._mobile_form.png`. The success state there came from a mock, so it is not evidence that consent was stored. The analytics banner in them is the site's own cookie notice.
- A screenshot of the LIVE form is only possible after the page is published, the flag is on, and the backend works. None exists.

## 6. Production blocker (read-only inspection of iyvdxvotthwrerirdzwd, 2026-11-18)
- Public tables `sms%`: none. Functions `sms%` and `share_link_rate_hit`: none. Edge functions: no `sms-consent` (none of the sms-* functions exist).
- QA (gpzlytukyvshrrxrmooo): tables and RPCs exist (`sms_consents`, `sms_suppressions`, `sms_record_guest_consent`, `sms_resolve_party_by_token`, `share_link_rate_hit`; config `sms_enabled=false`, `kill_switch=true`), but edge functions listed are only `sms-webhook` for SMS: **`sms-consent` is not deployed to QA**.
- Design gap even on QA: `sms_record_guest_consent` requires a real gathering (`gathering_not_found` otherwise; `sms_consents.owner_user_id` is NOT NULL). A standalone page has no gathering, so it needs a new gathering-less RPC, `v3` wording and a `standalone_page` branch in the edge function (all in the native/DB repo, outside WS1).

QA tests run (synthetic only, single transaction that ended in a deliberate exception so everything rolled back): existing RPC with synthetic gathering/hash: first insert `ok, existing=false`; repeat is idempotent (`existing=true`); a hash pre-marked opted_out returns `still_opted_out=true` (STOP honored, not cleared); gathering-less call fails `P0001:gathering_not_found`. Post-check: `sms_messages=0`, `sms_consents=0`, `sms_suppressions=0`, synthetic users/gatherings 0, `sms_audit_log` unchanged at 4. The true web-to-edge-to-DB flow on QA could NOT be run (edge function missing), so it is not claimed.

## 7. Smallest approval request
Approve, in this order, with QA first and SMS flags unchanged:
1. (Native/DB agent) a new migration adding a gathering-less consent RPC (service-role only; nullable owner or a fixed system owner; `source='guest_page_opt_in'`, `wording_version='v3'`), `v3` in `CONSENT_WORDING`, and a `standalone_page` branch + hashed-`client_key` rate limit in `sms-consent`. Deploy to QA only; re-run the QA flow with synthetic numbers and roll back.
2. After QA passes and counsel approves the wording: production migration of the SMS foundation set (SMS-A..SMS-5 plus step 1) and `sms-consent` deploy, then set `NEXT_PUBLIC_SMS_STANDALONE_OPT_IN=true` and publish the web app. Until then production keeps the "not open yet" page.
Neither step is taken here.

## 8. Update 2026-11-21 (WS-C)
- Consent recording and the new voluntary "Stop texts" form on `/sms-opt-in` no longer depend on `SMS_ENABLED`; sending stays off. The page tells people they can reply STOP to any text or enter their number to stop texts; signing up again on the page never reverses a stop (only replying START does).
- Publish requirements, approval gates and the exact live-screenshot procedure: `placeandplenty-native/docs/handoff/20261118/SMS_OPT_IN_PUBLISH_GATES.md`. The LOCAL_ screenshots above predate the Stop texts section and are not live evidence; a live capture is still required after publish.
