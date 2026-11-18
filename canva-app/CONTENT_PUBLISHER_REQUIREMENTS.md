# Content Publisher implementation map

Official guide: https://www.canva.dev/docs/apps/intents/content-publisher/implementation-guide/

- Register once: `src/index.tsx`.
- Output configuration, real export transfer and durable-save confirmation:
  `src/intents/content_publisher/index.tsx`.
- App UI Kit settings, deferred OAuth, RLS-filtered gathering selection and unchecked
  invitation opt-in: `settings_ui.tsx`.
- Actual SDK preview media: `preview_ui.tsx`.
- Strict 32 KB settings parser without credentials: `publish_settings.ts`.
- Existing host auth consent, PKCE exchange and opaque token: web `host/canva/authorize`,
  `api/canva/token`, `lib/canva-security.ts`, `lib/canva-server.ts`.
- Existing gathering RPC and private invitation artwork contract:
  `api/canva/gatherings`, `api/canva/publish`, `lib/canva-publisher.ts`.

Opt-out is planning only. No completed publish result is returned without actual
artwork persistence. Existing subscription/entitlement code and policies are not
modified. `README.md` and `RELEASE_GATES.md` describe configuration and remaining
staging validation. No merge, deployment or Canva submission is authorized.
