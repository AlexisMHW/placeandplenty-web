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

## Private application inbox (November 1)

Added /hosting-collective/review. Auth getUser() runs before any provider call; confirmed, non-anonymous accounts must have a separately managed app_metadata.hosting_collective_reviewer boolean true. Contributor/Partner roles do not imply reviewer permission. No account received reviewer permission in this change. Anonymous visitors return through login; unauthorized signed-in users receive not-found.

The read-only inbox calls the fixed Partner application form using server-only TALLY_API_KEY, a pinned tally-version, no-store fetch, a timeout and bounded pagination. It displays completed answers as escaped text, omits unknown/hidden questions and raw provider metadata, and fails visibly on malformed responses or vendor errors. No secret or raw vendor error is returned to the browser. The connector confirms the partner form has zero submissions and supplies the questions/questionId/submittedAt response contract. A real HTTP API integration with a credential has NOT been verified.

Remaining activation dependencies: securely configure TALLY_API_KEY in the preview environment; explicitly authorize the reviewer identity through the trusted admin process; verify with a synthetic submission and confirm least-privilege data access. The inbox cannot store a decision, send notifications, link an applicant to an Auth identity, or assign access yet. Those need durable audited workflow storage and an administrative mutation path; do not treat reading an application as approval.

Preview verification November 1: deployed landing, join and apply routes return 200; intake remains opening-soon. Hub request leads to login content and private/no-store response; no authenticated-role end-to-end verification is claimed. PromoteKit support thread still contains only the original outgoing question.

## Command Center (November 1)

Owner approved the private administrative home at /command-center. Added its authenticated home and /command-center/applications inbox. Both require the separate reviewer capability, never creator membership or paid access. Former /hosting-collective/review now redirects to the canonical queue. Middleware protects the exact Command Center segment and the inbox also checks authorization before fetching data.

Tally partner application self-email is configured to alexis@placeandplenty.com with a subject, submission reference and canonical queue link. No applicant answers are included in the custom email body. Form remains closed and DRAFT; actual notification delivery has not been tested. The queue production URL will not work until this branch is deployed and reviewer access is configured; email includes Tally workspace fallback guidance during setup. No email sent by this configuration change.

No fabricated new-application count, financial figure or working approval button is displayed. The application queue is read-only; marketing/PR/affiliate sections explicitly show their connection status. Still required: Tally server credential, reviewer provisioning with owner authorization, secure durable decision/audit storage, verified account linking, notification delivery test, and real-session browser QA. Do not open intake until the owner can successfully review a synthetic application and act on it.
