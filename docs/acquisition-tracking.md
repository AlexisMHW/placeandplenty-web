# Acquisition tracking

Use campaign tags on links from outside P&P. Do not add UTMs to internal navigation,
account links, or Google organic search links. GA4 derives acquisition from the
incoming URL and referrer. Never send names, emails, guest IDs, or invitation tokens.

Generate a consistent link:

```sh
node scripts/campaign-url.mjs /gathering-checklists/before-the-doorbell instagram social before_the_doorbell bio
```

| Placement | source | medium | campaign | content |
| --- | --- | --- | --- | --- |
| Instagram bio | instagram | social | before_the_doorbell | bio |
| Pinterest checklist pin | pinterest | social | before_the_doorbell | checklist_pin |
| Welcome email | mailerlite | email | before_the_doorbell | welcome_01 |
| Podcast appearance | actual_show_slug | referral | founder_press | show_notes |
| Paid Instagram ad | instagram | paid_social | before_the_doorbell | video_01 |

Keep campaign names stable; change content to distinguish creatives. These are
ready-to-generate links, not already-published campaigns.

## Event fields

- client_platform: web. Do not use source to identify the client platform.
- entry_point: guest_list or search_landing for lead forms.
- topic: the landing page's static occasion slug.
- edition: the checklist's static edition slug.

The compact lead source stored with form submissions stays unchanged. It is no
longer sent as analytics source; raw URL campaign strings should not be duplicated
into event metadata. Existing historical attribution cannot be rewritten.

## Beta funnel

Track checklist_requested -> checklist_signup_completed -> checklist_account_clicked,
then account creation and first successful gathering. The legacy account_created
and gathering_created tracker currently uses UI/route heuristics; validate against
successful backend operations before treating either as a reliable key event.
A purchase=success URL is also not authoritative purchase confirmation.

Lead capture events fire after successful responses. Register checklist_signup_completed
and guest_list_signup_completed as GA4 key events when configuring the beta dashboard.
Check Events/DebugView on an owned session after deployment. Avoid recording test
purchases while checkout is off. Match dates, exclude test traffic where identifiable,
and use an actual ordered user funnel rather than dividing unrelated event totals.

## Email follow-up

Verify MailerLite opt-in sync and delivery with an owned test address before launch.
An immediate PDF download is already supported; marketing email journeys need separate
configuration. Send marketing follow-up only to opted-in contacts. Recommended journey:
resource, helpful setup tip, founder demonstration, invitation to create a gathering.
