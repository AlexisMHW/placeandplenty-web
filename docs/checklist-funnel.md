# Hosting checklist funnel

## Public entry points

- /gathering-checklists
- /gathering-checklists/before-the-doorbell
- /gathering-checklists/halloween
- /gathering-checklists/friendsgiving
- /gathering-checklists/thanksgiving
- /gathering-checklists/game-day

Five occasion pages share one form and handler. On successful contact capture,
the visitor can download the matching two-page PDF and explicitly create a free
account through the existing /signup flow. No accounts are created by requesting
a checklist. Existing users can open /host. No changes to entitlements or auth.

## Email connection (pending account setup)

Alexis already has MailerLite. Prefer that account for opt-in marketing unless
its actual plan and cost make a switch worthwhile. MAILERLITE_API_KEY and the five
MAILERLITE_*_GROUP_ID variables enable additive opt-in sync to that account.
This does not send a resource email; configure a MailerLite delivery/welcome
automation after checking account limits and testing with an owned address.
The Brevo delivery adapter below is optional, not a requirement to buy a second
service. MailerLite takes priority for marketing sync when its key is set.

Immediate PDF downloads and website-account links work without an email
provider. With no transactional sender configured, the page promises only the
immediate download. Email sending and marketing journeys are not live until
connected and verified. No mailboxes or DNS records were created by this change.

## Optional Brevo delivery setup

1. Configure BREVO_API_KEY in Vercel as a server-only secret. Authenticate the
   domain in Brevo and verify alexis@placeandplenty.com. Configure
   BREVO_CHECKLIST_SENDER with that address.
2. Create five Brevo lists, one per edition, and set the five list IDs documented
   in .env.example. Confirm FIRSTNAME is an available contact attribute.
3. Verify production public-form-submit accepts the existing guest_list contract
   and returns success:true. This flow reuses that endpoint's persistent rate
   limiter and canonical marketing_leads insert, including its existing duplicate
   handling. No migration is introduced here.
4. Run a controlled request using an owned test address. Confirm the database
   row, email receipt, PDF link, explicit consent, repeat requests, and free-account
   path. Then verify a second edition adds list membership without removing the
   first or resetting a previously suppressed contact. Mock tests are not proof
   of live service configuration or email receipt.
5. Publish the website changes. The email points to production PDF URLs, so
   don't send real delivery emails from previews before those PDFs are live.

## Contact and delivery behavior

Source is checklist_<edition>; upcoming_gathering_type is the edition name.
Consent is an optional unchecked checkbox and is passed explicitly. Only those
who opt in are synced to a Brevo marketing list. The requested resource email
is transactional. Do not send a marketing sequence to checklist-only recipients.
Brevo groups preserve multiple edition interests; the existing lead row may
retain only the latest source/occasion according to its existing trigger.

If capture fails, display an error and do not send. If email is unconfigured or
fails, the successful capture still displays a download with an honest email
status. Provider acceptance is not inbox delivery. No background retry queue is
introduced; failed email/group sync emits a non-PII server warning. Manually
reconcile opt-in records with failed sync before launching a marketing campaign.

PDF URLs are public assets, not confidential downloads or access-controlled
entitlements. Resource fulfillment is gated in the normal page flow, not DRM.
The API uses the Vercel-set IP header for the existing rate limiter and a fixed
user agent. On other hosts it uses a shared conservative limiter key.

## Analytics

Four events use the existing analytics wrapper: request, successful capture,
download click, and account CTA click, with edition only. The existing wrapper
is currently a production no-op. A reporting provider is still required before
these events can be used as conversion measurements. No PII is sent to analytics.

## Follow-up emails to configure in Brevo

The immediate resource email is implemented in lib/checklist-delivery.ts.
Marketing automations are not activated by this PR. For opted-in people only:

- Day 2: A practical tip from their edition and an invitation to start on the web.
- Day 5: A real founder demonstration or an approved customer story.
- Day 8: Ask what they are planning and offer help getting their plan started.

Use one welcome journey per contact, deduplicate across edition requests, include
unsubscribe links, and suppress account-creation invitations once account creation
can be reliably measured. No account lifecycle integration is claimed here.

## Regenerate PDFs

Export CHECKLISTS merged with CHECKLIST_HELP by slug to temporary JSON. Run
`python scripts/build-hosting-checklists.py /tmp/kits.json /tmp/fonts`.
Requires reportlab and these Google Fonts (SIL Open Font License):
- Lato-Regular.ttf from google/fonts/ofl/lato.
- PlayfairDisplay-Semibold.ttf: instantiate google/fonts/ofl/playfairdisplay
  variable font at weight 600 with fontTools.varLib.instancer.

PDFs embed the actual brand typefaces and use the existing P&P logo. Page one
is printable; page two connects tasks to named product areas. Review all
rendered pages after regeneration.

## Evergreen campaign

Hook: The doorbell rings. You're still in a towel.
Supporting copy: The food is almost ready. The house is mostly ready. You?
Not even close. Let’s make room for the person doing the hosting, too.
CTA: Help Me Beat the Doorbell.
Destination: /gathering-checklists/before-the-doorbell

The hub features this hook year-round. The checklist protects a personal
getting-ready break and explains delegation without promising that P&P has
a shower timer or automatic scheduling. Social copy is ready to use; no social
posts, campaigns, or emails were sent by this change.

## Verification

Tests cover all five resource mappings, rejected requests, persistent-limiter
failures, provider failures, HTML escaping, and opt-in-only provider sync.
A pre-existing Entitlement fixture omitted provider_customer_id; setting it to
null restores the full TypeScript check without changing production behavior.

