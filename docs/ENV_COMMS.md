# Communications / founder notification configuration

Config only. Never hardcode these in source (a test enforces it).

| Variable | Default | Meaning |
|---|---|---|
| COMMS_SEND_ENABLED | unset (off) | Exactly `true` allows real provider sends. |
| FOUNDER_NOTIFY_ENABLED | unset (off) | Enables the founder email channel (inbox is always recorded). |
| FOUNDER_NOTIFICATION_EMAIL | documented default: alexis@placeandplenty.com (founder-confirmed 2026-11-14) | Destination. Set per environment; not read from source. |
| FOUNDER_NOTIFICATION_EMAIL_VERIFIED | `false` | Must be exactly `true` before any founder email is sent. Set only after destination + delivery are verified. |
| FOUNDER_NOTIFY_RETRY_SECONDS | 60,300,1800 | Retry backoff. |
| FOUNDER_NOTIFY_MAX_ATTEMPTS | 4 (cap 10) | Max delivery attempts. |
| SITE_URL | none | Base for the inbox link `/command-center/inbox/{id}`. |

Recommended initial values: `FOUNDER_NOTIFICATION_EMAIL=alexis@placeandplenty.com`, `FOUNDER_NOTIFICATION_EMAIL_VERIFIED=false`.
