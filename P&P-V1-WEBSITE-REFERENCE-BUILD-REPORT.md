# P&P V1 WEBSITE — BUILD TO THE APPROVED REFERENCES

**Date:** 28 August 2026
**Branch:** `main`, on top of `9f4e844`
**Built against:** `PLACE-AND-PLENTY-V1-WEBSITE-VISUAL-EXPERIENCE-MASTER-DIRECTIVE.md`
(look, composition, pacing) and
`PLACE-AND-PLENTY-V1-WEBSITE-FINAL-RECONCILIATION.md` (product truth)

All ten reference PNGs were opened and used as direct visual targets.
Every page was then rendered locally at 1440px and at 390px and compared
against its reference — §21's completion standard, not a green build.

---

## 0. TWO BUGS FOUND IN LIVE PRODUCTION

Found during the audit, not introduced by this work. Both are fixed.

### The homepage hero photograph was broken on the live site

`content/homepage/home.json` sets `heroImage: "/images/hero-tabletop.jpg"`
— a real file in this repository. But `tina/config.ts` configures
`media.tina`, so the Cloud client rewrites **every** image field to
`https://assets.tina.io/<clientId>/<value>` when it reads a document.
That URL has never existed and returns **404**.

So the site's single most important photograph — one of only two real
photographs it has — was rendering as an empty forest panel on
placeandplenty.com. Verified against production before fixing.

Fixed in `lib/tina-content.ts` with `resolveMedia()`, which uses a
precise rule rather than a guess: Tina only hosts what was uploaded
through it, and everything it hosts lives under its `mediaRoot`
(`images/content/`). A CDN URL whose path is not under that root cannot
be a Tina asset, so the local path is restored. Applied at the read
boundary via `normaliseMedia()`, alongside the existing published and
consent gates, so no page component has to know about it.

### Next.js could not optimise any Tina-hosted image at all

`next.config.js` had no `remotePatterns`, so `/_next/image` returned
**400** for every `assets.tina.io` URL. **Every photograph uploaded
through the editor would have silently failed to render** — which would
have made the entire photography plan in `PHOTOGRAPHY-MANIFEST.md`
impossible to execute. Fixed.

---

## 1. WHAT WAS BUILT — the public site

A shared visual system first, because eight of the ten references share
it. That is what makes the site read as one product rather than eight
pages.

| New | What it is |
|---|---|
| `components/Icon.tsx` | The line-icon set, ~39 glyphs at one hairline weight |
| `components/PageHero.tsx` | The split editorial hero seven references open with |
| `components/Photo.tsx` | Every image slot, with the designed plate when empty |
| `components/Stamp.tsx` | The circular seal (Gathering Ideas, Show Us) |
| `components/Cards.tsx` | SplitCard / EditorialCard / TagCard / FeatureLede |
| `components/CtaBand.tsx` | The closing band every reference ends with |
| `components/FounderBand.tsx` | The founder band, with the Life with Lexi seal |
| `components/Wordmark.tsx` | The two-line P & P masthead lockup with its sprig |
| `components/CategoryRail.tsx` | Gathering Ideas' circular category chips |
| `components/PlanCards.tsx` | The three pricing cards, Plus raised in the centre |
| `components/ConversionPaths.tsx` | The four conversion paths |
| `BotanicalBough` | The long branch that bleeds off every hero's left edge |

Then every page composed to its reference:

| Page | Reference | State |
|---|---|---|
| Home | `Home_Page.png` | ✅ **8 bands, and four were REMOVED** — see §2 |
| How It Works | `how_it_works Page.png` | ✅ Hero · 5-step path · capability grid · guest loop · founder · CTA |
| What It Does | `What_it_does.png` | ✅ Hero · 12-card Hub in 3 groups · system capabilities · guest band · CTA |
| About | `about_me.png` | ✅ Hero · My Story · My Approach (5) · Why I Built This · sign-off |
| Pricing | `Pricing_Page.png` | ✅ Hero · 3 cards · How Plus works · one-account band · FAQ · trust strip · QR CTA |
| Gathering Ideas | `Gathering_Ideas_Page.png` | ✅ Hero + seal · category rail · tag cards with meta · CTA |
| The Coordinated Host | `the_coordinated_host.png` | ✅ Masthead · lead story straddling the hero · topic strip · grid · newsletter |
| Show Us How You Gather | `show_us_how_you_gather.png` | ✅ Hero + seal · 3 steps · gallery · counts-too band — **one deliberate divergence, §4** |
| Host Home | `host_web_home.png` | ✅ Forest sidebar · gatherings with artwork · upcoming hero · account panels |
| Gathering Command Central | `host_web_gathering.png` | ✅ Pale sidebar · HostReady dial · 5 stat tiles · at-a-glance cards |

### Where the references were corrected rather than copied

Product truth wins wherever they disagree, per the directive's own
governing rule. Each is commented at the point of divergence:

- **"My Shopping List" → My Shopping** (§9/§32) — in the What It Does
  grid, the homepage difference band, and the host stat tiles.
- **A standalone "My Budget" tile** — absorbed into My Shopping as List |
  Budget. On the host overview, spend is a line *inside* the Shopping
  tile, which is where it lives in the product.
- **"My Invitations" and "My Guest Book" as Hub cards** — the reference's
  twelve include both; §9's twelve include neither. Six of the approved
  twelve (Space Mode, Find Help, My Gathering Photos among them) are
  absent from the reference entirely.
- **"And So Much More"** — a filler tile standing where a real card
  belongs. Replaced with the twelfth actual card.
- **"+ applicable tax"** on both paid pricing cards — the exact wording
  §17 and §32 forbid. The reference's *typography* of the price is
  copied; its wording is not.
- **Two separate sign-in buttons** in the home reference's header — there
  is one Supabase identity, so there is one Log In.
- **Space Mode described as "your guests stay in the app"** — that
  describes the guest experience, not Space Mode.
- **Careers / Press / Help Center / Contact Us** in the footers — none of
  those routes exist, and §7/§18 forbid placeholders.
- **The four-screen app mockup was NOT published**, per the standing
  warning: it shows pre-consolidation naming.

---

## 2. THE HOMEPAGE LOST FOUR SECTIONS

The most important change on it. §5: *"Do not create endless-scroll
pages… Use fewer, stronger sections… More presence. Less scrolling."*

Removed: `HostingRealitySection` (that is /how-it-works), the pricing
block (that is /pricing, and it is in the primary nav), `CtaSection` (a
second closing CTA immediately above the first), and `FeatureGrid`.
Duplicating a subpage on the homepage is exactly what §5 forbids, and
each copy was a reason never to visit the real page.

The reference is eight bands. So is the homepage now, each with a
pathway out.

**Twelve superseded components were deleted** rather than left in the
tree, because a dead component that duplicates a live one is how a future
edit lands in the wrong file.

---

## 3. WEB PURCHASE, ACCOUNTS, AND CROSS-PLATFORM ENTITLEMENTS

Per the four mid-build instructions. Full detail in
`WEB-PURCHASE-HANDOFF.md`.

**The canonical model already existed and is already channel-agnostic.**
Nothing was added to the schema. `gathering_entitlements.canonical_product_id`
(`plus_annual` / `gathering_pass`) is the cross-platform product identity;
`provider` is only a note of where it was bought. There is no web plan and
no app plan.

| Requirement | State |
|---|---|
| Free web account creation | ✅ **Live** — `/signup`, works today |
| Use P&P entirely on web | ✅ 10 of 12 Hub cards, read and write |
| Buy a Gathering Pass on web | ✅ Surface built · ⛔ needs a payment processor |
| Buy Plus on web | ✅ Surface built · ⛔ needs a payment processor |
| Entitlements retained across platforms | ✅ Same rows, read through RLS |
| No duplicate purchases | ✅ Checkout refuses to sell Plus to an account that holds it |
| Billing area reflects canonical state | ✅ `/host/account` → `PlanPanel` |
| Start Free on Web / Buy on Web / iPhone / Android | ✅ `lib/conversion.ts`, on every closing band |

**The security posture decided the design.** `gathering_entitlements` and
`purchase_intents` are SELECT-only for users — no INSERT policy on
either. Entitlements are minted server-side after payment is verified.
So the website reads and never writes, and the webhook that does the
writing is handed over rather than deployed from here.

**The one blocker is a merchant account**, not code. `WEB-PURCHASE-HANDOFF.md`
§4 lists exactly what to supply; `isCheckoutConfigured()` switches the
button on when it is there.

The old claim that accounts could only be created in the app was checked
against the live database and does not hold: `on_auth_user_created` fires
for every client, and Free is the *absence* of an entitlement row.

### Cross-platform feature availability — disclosed, not implied

`FEATURE_AVAILABILITY_NOTE` appears verbatim on Pricing (twice), in the
Support FAQ, on the checkout page, in the account billing panel, and in
the Terms:

> Some Plus features require the Place & Plenty mobile app. Plus access
> follows your account across platforms, but feature availability may vary
> between web and mobile.

The Terms also carry the liability wording: not responsible for inability
to use a native-only feature where that results solely from choosing not
to install the app, subject to applicable law. Host Mode and Space Mode
are named with their product reasons everywhere, rather than left vague.

**Support's FAQ was cut to ten friction-reducing questions** as
instructed — web vs app, bring-your-own invitations, RSVPs, Who's
Bringing What, My People vs My Guest Book, plans, cross-platform
entitlements, app-only features, co-host access, billing, deletion.
Product tutorials and the contact prompt were removed.

---

## 4. THE ONE DELIBERATE DIVERGENCE FROM A REFERENCE

`show_us_how_you_gather.png` draws ten community gatherings with names,
cities and like counts. **There are zero real submissions**, and §13 says
plainly: *"Do not fabricate fake real-user stories as production
content."*

Ten invented gatherings with invented cities would be the most dishonest
thing this site could ship, because the entire premise of the page is
that these are real people. The grid architecture is built and renders
from Tina the moment consented stories exist; until then the space is a
designed invitation rather than a fake gallery.

Everything else on that page follows its reference.

---

## 5. PHOTOGRAPHY

**48 image slots have no photograph.** Every one is built at the right
size, ratio and position, and none is blank — each renders a designed
plate: house palette, woven hairline field, botanical linework, and where
the slot is large enough, the subject the photograph should be.

`PHOTOGRAPHY-MANIFEST.md` lists every slot with its page, its file name,
its aspect ratio, the line of code to change, and a shot brief. It is
ordered by impact: four Gathering Idea photographs fix eight slots and
the two most-visited pages.

The house style, formats and size ceilings are in the manifest.
**Nothing needs rebuilding to add one.**

One decision is needed: the founder photograph in the repository is a
~80 KB social crop and will look soft in the About hero, and the approved
board shows a *different* candidate. See manifest §8.

---

## 6. VERIFIED

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `next build` | ✅ 42 pages, no errors |
| Every public page rendered at 1440px against its reference | ✅ |
| Every page at 390px | ✅ **0px horizontal overflow** on home, pricing, what-it-does |
| Exactly one `<h1>` per page | ✅ all 9 |
| Images without `alt` | ✅ **0** |
| Sitemap | ✅ 20 URLs; `/signup`, `/checkout/*`, `/host/*`, `/login` correctly absent |
| `/host` unauthenticated | ✅ 307 → `/login?next=/host` |
| `/checkout/<unknown>` | ✅ 404 |
| Host route URLs after the `(account)` regroup | ✅ unchanged |

### NOT verified

1. **The two host web surfaces were not screenshotted** — they need a
   real signed-in account, which I do not have credentials for. They
   typecheck, build, and render server-side; the *visual* comparison
   against `host_web_home.png` and `host_web_gathering.png` has not been
   done and should be, by you, after logging in.
2. **The invitation-artwork signing path is unexercised.** No gathering
   in the project has `invitation_artwork_path` set, so `signArtwork()`
   has only ever returned an empty map and the identity plate is the only
   branch that has run.
3. **No real device or screen-reader pass.** Contrast was reasoned about
   and structure checked mechanically; neither substitutes for VoiceOver.
4. **The reset-email flow** still needs a real mailbox — unchanged from
   the previous report.

---

## 7. WHAT IS STILL OPEN

**Blocking a complete V1**

1. **Photography** — 48 slots. The largest remaining visible gap, and the
   manifest is written to make it a shooting list rather than a project.
2. **A payment processor** for web checkout. Everything either side is
   built.
3. **Show Us How You Gather has no stories** — by design until real ones
   arrive with consent.

**Carried forward, unchanged**

4. Native repo committed but not pushed.
5. Leaked-password protection is OFF — now a live surface, because
   `/signup` exists.
6. 91 `authenticated_security_definer_function_executable` advisories.
7. Rate limiting on the two public form paths.
8. `process-communication-events` has no cron.

**Known limitations**

9. HostReady is read, never recomputed on web — surfaced in the UI.
10. Style Board / Photos / Find Help are read-only for stated reasons.
11. No ESLint config; `tsc --noEmit` is the only static gate.
