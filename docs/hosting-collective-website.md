# Hosting Collective website and intake

Owner approved October 31, 2026: Collective Member, Contributor and Partner. Affiliate Partner is a commercial designation within Partner, alongside separately scoped content and hosting projects. Collective membership never modifies app entitlements.

Implemented public routes on this draft branch:
- /hosting-collective: branded landing page, membership levels, two entry paths, affiliate summary and FAQ.
- /hosting-collective/join: community signup entry.
- /hosting-collective/apply: partner application entry.

Tally workspace: My workspace (3xRDOy).
- Member form: Ge6R1Q, created as DRAFT, closed.
- Partner application: OQa7Pk, created as DRAFT, closed; three question pages and a thank-you page.
- Both use P&P forest/offwhite and Lato; no paid feature enabled or purchased.
- No form published, no marketing integration or automated email configured, no sample personal data submitted.

The website embeds are gated by lib/collective.ts. Both open flags are false, so the website shows an honest opening-soon state and makes no Tally request. Enable each separately only after publishing that form, opening intake, and verifying a real synthetic submission. Forms have separate confirmation copy, data-use notices and no payment/tax/credential fields. Member emails relate specifically to the Collective; partner applications do not subscribe applicants to marketing.

Review and access:
- Initial application records will be visible in the existing authenticated Tally workspace only.
- A custom application review dashboard, status notifications, MailerLite synchronization/unsubscribe handling, partner terms acceptance, protected resources and provider earnings dashboard are NOT implemented by this change.
- Membership tiers are explanatory content, not authorization roles or subscription entitlements.
- No public reviewer/admin route or mock partner login is added.
- Partner activation remains blocked by unresolved provider eligibility/payout configuration.

Before public launch: review privacy coverage for creator applications and Tally, approve retention/reviewer access, finalize partner terms, verify notification and consent processing, test submissions and mobile embeds, add the landing page to navigation/sitemap and remove its temporary noindex metadata. Keep join/apply noindex. Existing old Founding Host Application form rjZ6yL was observed but not edited or reused; audit existing links to it separately before launch.

Validation: TypeScript and existing suite pass. Local server process could start but was not reachable through a later command; no successful local HTTP or visual verification claimed. Use the branch Vercel preview for visual QA once its build is READY.

## Existing-account hub access

The /hosting-collective/hub route now uses the existing cookie client and Auth getUser(), redirecting unsigned visitors through /login with a safe return path. Signup can use the same /signup?next=/hosting-collective/hub flow; no second password or identity model is created. Public intake routes stay unauthenticated. Fixed the previous broad /host prefix check, which also captured /hosting-collective.

The hub authorizes confirmed, non-anonymous users with an Auth-admin-managed app_metadata.hosting_collective object: role contributor or partner, status active. It ignores user_metadata, query parameters, paid plans and form fields. Suspended/revoked/pending/unknown roles fail closed. Every server render retrieves current Auth user details; there is no client-only gate or shared user cache. This is a pilot access record, not the final audited application approval workflow. No metadata grants were made and no live Auth configuration changed.

Approved resources are rendered only after authorization. Ordinary users get an access explanation without resources. Partner status does not imply Affiliate Partner activation; no earnings, link or fake payout data is shown. Every future protected resource/API/download must independently use the same server verification and role check; do not place private files in public/.

Still required: secure application-to-canonical-user identity linking, owner review interface with auditable approval/revocation, terms acceptance record, signup/login end-to-end staging verification with synthetic identities, resource access tests using real sessions, and affiliate provider activation. Never grant access from an email match or an unverified Tally submission alone.
