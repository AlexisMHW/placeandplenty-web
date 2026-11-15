# Communications / founder notification configuration

Config only. No founder address is hardcoded anywhere in source, tests or these docs (a test enforces it).

## Founder notifications: ONE canonical path
- Inbox: `cc_notifications` (Command Center, `/command-center/inbox`). Always recorded, permission controlled.
- Email configuration: `cc_notification_settings` (database), set and verified by the owner in Command Center, Inbox and notification settings. Starts unset, disabled and unverified.
- The Hosting Collective inbox page has no destination form. The earlier `hc_notification_destinations` UI and the env-based `lib/comms/founder-notify.ts` module were removed; there is no second config source in web code.
- Deployment values (operator reference, used only when entering the setting; the web app does not read them): `FOUNDER_NOTIFICATION_EMAIL` = the designated address, set per environment, never committed; `FOUNDER_NOTIFICATION_EMAIL_VERIFIED` = `false` until delivery has been verified.

## Send switches (all default OFF)
| Variable | Default | Meaning |
|---|---|---|
| COMMS_SEND_ENABLED | unset (off) | Exactly `true` allows real provider sends. |
| HC_NOTIFY_DISPATCH_ENABLED | unset (off) | Exactly `true` lets `/api/hosting-collective/dispatch` (and the post-decision hook) drain queued applicant approval/decline emails. |
| HC_DISPATCH_SECRET | unset | Bearer secret (16+ chars) required by the dispatch route. |
| SUPABASE_SERVICE_ROLE_KEY | unset | Read only by `lib/hc/dispatch-server.ts` and only when the dispatch flag is on. |
| SITE_URL | none | Base for links in messages. |

Approval/decline enqueue happens once, atomically, in the database (`hc_review_application`). Web never enqueues a second time. No real mail provider exists in this repo: the disabled provider refuses every send. SMS stays disabled.
