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
