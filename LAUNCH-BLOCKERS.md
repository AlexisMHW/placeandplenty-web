# LAUNCH BLOCKERS — the open items, and who can close each one

**For:** Alexis
**Date:** 28 August 2026 · legal-copy update 13 November 2026
**Why this exists:** the words "under review" were removed from the
visible legal copy on 28 Aug 2026. They read to a customer as an
unfinished website rather than as the disclosure they are. **The
underlying items are not closed** — they moved here, where they are a
worklist instead of a stain on the page.

Nothing below is a code change waiting on me. Every one needs a fact, a
decision, or a person I am not.

---

## A. LEGAL — outstanding review items

The public legal pages now identify AR Squared Inc. and the postal contact
address published in the Google Play listing. The pre-launch placeholder
promises have been removed. This copy cleanup does not resolve the remaining
legal-review decisions below or certify the policies against current app behavior.

| # | Item | Where it appears | Who closes it |
|---|---|---|---|
| A1 | **Company identity and postal contact — completed 13 November 2026** | `/privacy` §Who we are · `/terms` intro/contact | AR Squared Inc.; 4264 Brick Church Pike, Whites Creek, TN 37189-9176, United States; verified against public Google Play listing |
| A2 | **Governing law and venue — still undecided** | No jurisdiction or exclusive venue is designated in the public Terms; existing non-waivable rights language is retained | You + counsel |
| A3 | **Arbitration / class-action waiver — yes or no** | `/terms` — currently absent entirely | Counsel. Absent is a valid answer; it just has to be a decided one |
| A4 | **Is the liability cap enforceable as drafted?** | `/terms` §What we do not promise | Counsel |
| A5 | **US state-specific rights (CA/CO/CT/VA)** | `/privacy` §Your choices and rights | Counsel, once the launch market is fixed |
| A6 | **EU/UK transfer language** | `/privacy` | Counsel — only if you launch there at V1 |
| A7 | **Payment provider's processor terms** | `/privacy` §Third parties | Follows from the Stripe decision (§B) |

**A1 is complete.** Counsel review remains open for A2–A7; do not infer it
from the absence of placeholder wording on the public pages.

> **Note on A3.** The Terms currently contain no arbitration clause. That
> is a real choice with real consequences and it should be made
> deliberately rather than by omission — which is exactly why it is on
> this list rather than quietly absent.

---

## B. COMMERCE — blocks web purchase only

Web purchase is built and gated. Free accounts work today regardless.

| # | Item | Who |
|---|---|---|
| B1 | Open the Stripe account | You |
| B2 | Create the two products with the `canonical_product_id` metadata keys, Stripe Tax on | You |
| B3 | Three Vercel env vars | You |
| B4 | Two Supabase secrets | You |
| B5 | Deploy `create_purchase_intent` + the `web-purchase-webhook` Edge Function | App Claude |
| B6 | `app/api/checkout/route.ts` against the real processor, then flip `WEB_CHECKOUT_LIVE` | Me, once B1–B5 exist |
| B7 | One real sandbox purchase, then confirm it on a phone signed into the same account | You |

Full detail, including both functions written out, is in
`WEB-PURCHASE-HANDOFF.md`.

---

## C. CONTENT AND ASSETS

| # | Item | Who |
|---|---|---|
| C1 | **29 photographs** closing 36 slots | You — `PHOTOGRAPHY-MANIFEST.md` |
| C2 | **Confirm the founder photograph** and supply full resolution | You — the current file is a ~80 KB social crop |
| C3 | Official Apple + Google badge artwork | You |
| C4 | Store URLs into `lib/app-links.ts` | You, when the listings exist |
| C5 | First real Show Us How You Gather submissions, with consent | Nobody can shortcut this |

---

## D. BACKEND HARDENING — pre-beta, carried forward unchanged

| # | Item | Notes |
|---|---|---|
| D1 | **Enable leaked-password protection** | Authentication → Policies. **Now a live surface** — `/signup` and password reset both exist |
| D2 | Supabase redirect URLs | `https://placeandplenty.com/auth/callback` and `placeandplenty://reset-password` |
| D3 | Rate limiting on the two public form paths | A decision, not an oversight — see `RECONCILIATION-NOTES.md` |
| D4 | 91 `authenticated_security_definer_function_executable` advisories | Previously theoretical; there are authenticated web clients now |
| D5 | `process-communication-events` has no cron | Nothing on the site claims otherwise |
| D6 | Push the native repo | App Claude |

**D1 is the highest-value single toggle on this list.** Web sign-up and
password reset are both live, so it now applies to a real surface.

---

## E. VERIFICATION STILL OWED

| # | Item | Who |
|---|---|---|
| E1 | **Signed-in visual check of `/host` and `/host/g/<id>`** against `host_web_home.png` and `host_web_gathering.png` | You — I have no credentials |
| E2 | Reset-email flow end to end | You — needs a real mailbox |
| E3 | Device + screen-reader pass | You, before store submission |
| E4 | Invitation-artwork signing path | Unexercised — no gathering has `invitation_artwork_path` set |

---

## WHAT IS NOT ON THIS LIST

Because they are done: the twelve-card Hub taxonomy, pricing language
everywhere, the invitation-flexibility positioning, cross-platform
entitlement disclosure, feature-availability disclosure, the public
site's composition against all eight reference PNGs, free web account
creation, and the two production bugs found during the audit.
