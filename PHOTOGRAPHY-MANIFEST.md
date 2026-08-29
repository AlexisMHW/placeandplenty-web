# PHOTOGRAPHY MANIFEST — every image slot on the Place & Plenty website

**For:** Alexis
**Date:** 28 August 2026
**Why this exists:** Visual directive §19 — *"If final production
photography is missing: preserve the visual architecture, use approved
temporary imagery only where appropriate, and give the founder an exact
list of missing production assets and intended placement."*

---

## THE SHORT VERSION

The site now has **every image slot the approved references show**, built
at the right size, in the right place, in the right aspect ratio.

**48 of them have no photograph yet.** None of them is blank. Each one
renders a designed plate — the house palette, botanical linework, and the
subject the photograph is meant to be, set in small caps. It reads as a
brand surface rather than as a hole, and dropping in the real image moves
nothing on the page: same box, same ratio, same spacing.

**You have two production photographs today:**

| File | Used for |
|---|---|
| `public/images/hero-tabletop.jpg` | Homepage hero (your own table) |
| `public/images/alexis-founder.jpg` | About hero, founder bands, About sign-off |

Everything below is what would replace a plate.

### The five that would change the site most, in order

1. **Four Gathering Idea cards** — they appear on the homepage AND on
   /gathering-ideas, so four photographs fix eight slots and the two
   most-visited pages at once.
2. **The seven page heroes** — every public page except the homepage
   opens on a plate right now.
3. **The Coordinated Host lead + three articles.**
4. **The twelve Hosting Hub cards** on /what-it-does.
5. **The How It Works capability grid** (six).

---

## HOUSE STYLE — applies to every shot below

From the approved Visual Identity board: **Warm · Natural Light · Real
Homes · Inviting · Elevated Everyday.**

- Real homes, not studios or venues. Apartments and ordinary kitchens
  belong here as much as a long farmhouse table.
- Natural light, warm white balance. No flash, no cool tones, no heavy
  filters.
- The Place & Plenty palette should be *findable* in the frame — cream,
  forest, sage, warm wood, a little brass or gold. Not styled to match.
- Food that looks eaten-from, tables that look sat-at. §13's rule
  applies to photography as much as to community stories: **not a
  perfect-party competition.**
- Avoid: pumpkin overload, generic autumn-leaf stock, Thanksgiving
  template styling, luxury-event styling, sterile SaaS graphics,
  fake-candid stock party imagery.
- **Never stock for the founder.** §16 — the About photograph must be you.

### Formats

- **JPEG**, sRGB, quality ~80. Next.js re-encodes to AVIF/WebP.
- Longest edge **2400px** is plenty; the largest slot renders at ~1400px.
- Keep them under ~600 KB each. `hero-tabletop.jpg` is 599 KB and is the
  homepage LCP image — treat that as the ceiling, not the target.
- Filenames: lowercase, hyphenated, exactly as listed in the tables.

### Where they go

Two different places, and it matters:

- **Tina fields** — anything under Gathering Ideas, The Coordinated Host
  or Show Us How You Gather. Upload through the editor at `/admin`. No
  code change, no deploy.
- **`public/images/`** — page heroes and product cards. These need a file
  committed to the repository, plus one line pointing at it. The pointer
  lines are listed per section.

---

## 1. GATHERING IDEA CARDS — highest impact

**Upload through Tina** → Gathering Ideas → each document → `cardImage`
(or `heroImage`, which the card falls back to). Also write `heroImageAlt`.

Ratio **4:3**. Used at ~520×390 on the ideas grid and ~400×300 on the
homepage.

| Idea | The photograph |
|---|---|
| Game Day Without the Scramble | A coffee table or kitchen island of game-day food — wings, dips, a big bowl of chips — with a TV glowing out of focus behind. People's hands reaching in. Not a sports bar. |
| A Backyard Dinner Before It Gets Cold | A backyard table at dusk, string lights on, blankets over the backs of chairs, one course out. Late-season warmth rather than autumn décor. |
| The Halloween Get-Together | Adults' Halloween — a doorstep bowl of sweets, one or two carved pumpkins, drinks and a grazing board indoors. Restrained, per §3: Halloween must not take over the fall identity. |
| Friendsgiving, Before Everyone's Calendar Fills Up | A mismatched table, eight or nine places, food already served, wine poured, everyone mid-conversation. Warm and slightly chaotic. |

---

## 2. PAGE HEROES

**`public/images/`**, then set the `image` prop in the page's `PageHero`
(each file below names the line). Ratio **3:2 landscape**, and the type
sits over the left ~40% on desktop — **keep the left third uncluttered.**

| File | Page | Line to edit | The photograph |
|---|---|---|---|
| `hero-how-it-works.jpg` | How It Works | `app/(marketing)/how-it-works/page.tsx` → `image={null}` | A long table set for dinner at home, candles lit, greenery down the middle, nobody seated yet. |
| `hero-what-it-does.jpg` | What It Does | `app/(marketing)/what-it-does/page.tsx` → `image={null}` | A host at home holding a phone showing her plan, flowers and candles behind her, kitchen soft-focus. |
| `hero-pricing.jpg` | Pricing | `app/(marketing)/pricing/page.tsx` → `image={null}` | A candlelit table set for a small dinner — linen napkins, wine glasses, a hand-lettered place card. |
| `hero-gathering-ideas.jpg` | Gathering Ideas | `app/(marketing)/gathering-ideas/page.tsx` → `image={null}` | A laid table with greenery and candles, a place card reading *gather*. The stamp sits bottom-right, so leave that corner quiet. |
| `hero-coordinated-host.jpg` | The Coordinated Host | `app/(marketing)/coordinated-host/page.tsx` → `image={null}` | An olive-branch centrepiece on a laid table, glassware and candles, evening light. Editorial, magazine-cover weight. |
| `hero-show-us.jpg` | Show Us How You Gather | `app/(marketing)/show-us-how-you-gather/page.tsx` → `image={null}` | Hands holding a phone, photographing a laid table from above. The gesture is the subject. |
| `about-why.jpg` | About — "Why I built this" | `app/(marketing)/about/page.tsx` → the `Photo src={null}` in that band | A grazing table at home — cheeses, olives, candles, greenery in jars. Ratio 4:3. |

---

## 3. THE HOSTING HUB — twelve cards on What It Does

**`public/images/hub/`**, then set `image:` on the matching entry in
`lib/features.ts`. Each card shows the photograph in its **right 38%**,
so these are cropped narrow: shoot **square or portrait**, and keep the
subject centred.

| File | Card | The photograph |
|---|---|---|
| `hub-my-table.jpg` | My Table | An overhead dish on a laid table, warm daylight, home kitchen. |
| `hub-my-shopping.jpg` | My Shopping | A market basket of groceries set down on a kitchen counter. |
| `hub-hosting-closet.jpg` | My Hosting Closet | A cupboard shelf of stacked plates, glassware and serving bowls. |
| `hub-my-people.jpg` | My People | Four or five guests talking around a kitchen island, candid. |
| `hub-bringing-what.jpg` | Who's Bringing What | A guest at the front door holding a covered dish, being welcomed. |
| `hub-co-hosts.jpg` | My Co-Hosts | Two people plating food together at a counter, easy and unposed. |
| `hub-space-mode.jpg` | Space Mode | A living room mid-rearrangement, chairs pulled into a circle. |
| `hub-find-help.jpg` | Find Help | A host handing a task to a friend in an apron, kitchen background. |
| `hub-style-board.jpg` | My Style Board | Napkins, candles and greenery laid out as a flat-lay on linen. |
| `hub-music-media.jpg` | My Music & Media | A small speaker on a sideboard beside a bowl of fruit, evening light. |
| `hub-host-mode.jpg` | Host Mode | A phone face-up on a counter beside prep bowls, gathering underway. |
| `hub-gathering-photos.jpg` | My Gathering Photos | A guest photographing the table from above with a phone. |

The four system capabilities (Figure It Out For Me, HostReady, Next Up,
My Guest Book) render as icon cards on that page and **do not need
photographs** — their briefs are in `lib/features.ts` in case they are
ever wanted elsewhere.

---

## 4. HOW IT WORKS — the capability grid

Same narrow-right-crop as the Hub cards. **`public/images/hiw/`**, then
set `image` on the entry in `app/(marketing)/how-it-works/page.tsx`.

| File | Card | The photograph |
|---|---|---|
| `hiw-invitations.jpg` | Invitations & RSVPs | A phone showing an invitation, held at a set table. |
| `hiw-my-people.jpg` | My People | Guests around a kitchen island, mid-conversation. |
| `hiw-shopping.jpg` | My Shopping | A basket of groceries on a counter, warm daylight. |
| `hiw-bringing-what.jpg` | Who's Bringing What | A guest arriving at the door holding a covered dish. |
| `hiw-guest-book.jpg` | My Guest Book | An open notebook and pen beside a candle. |
| `hiw-the-rest.jpg` | …and the rest of it | A table mid-setup — plates stacked, greenery out, candles unlit. |

*(`hiw-my-people`, `hiw-shopping` and `hiw-bringing-what` overlap with
Hub shots. One photograph can serve both — just reference the same file.)*

---

## 5. THE COORDINATED HOST

**Upload through Tina** → The Coordinated Host → each article →
`featuredImage` + `featuredImageAlt`.

The lead story renders at **4:3** in a wide horizontal card; the grid
cards render at **16:10**. Shoot 4:3 and both crops work.

| Article | The photograph |
|---|---|
| How Much Ice Do You Actually Need? | A cooler or a big bowl of ice with bottles in it, condensation, outdoors or a garage. Unglamorous on purpose — the piece is about arithmetic. |
| The Night-Before List | A kitchen the night before: one lamp on, a list on the counter, everything else put away. Calm. |
| How to Organise a Potluck Without a Group Chat | A counter of arriving dishes, several different containers, obviously brought from elsewhere. |

Any new article needs one before it publishes — the card is photograph-led
and a plate is a fallback, not a design intent.

---

## 6. SHOW US HOW YOU GATHER

**These are the one category you must not commission.** §13: *"Do not
fabricate fake real-user stories as production content."* The gallery
fills from real submissions, through Tina, with `consentConfirmed` set —
which is a separate gate from publishing and is enforced in code.

Until then the page shows a designed invitation panel rather than a fake
gallery, which is deliberate and is the only place the build departs from
its reference.

Ratio when they arrive: **4:5 portrait**, `heroImage` on each story.

---

## 7. STORE BADGES — not photography, but the same kind of gap

Both are trademarked artwork with written presentation rules, so they are
the vendors' own files rather than anything drawn here.

1. Apple — *Download on the App Store* SVG, from Apple's marketing
   resources.
2. Google — *Get it on Google Play* PNG, from the Play brand guidelines.

Drop both into `public/images/`, then set `STORE_BADGES` in
`lib/app-links.ts`. Until then the download surfaces render accessible
text buttons in our own visual language, and the store paths stay hidden
entirely because `APP_STORE_URL` and `PLAY_STORE_URL` are still `null`.

---

## 8. THE FOUNDER PHOTOGRAPH — one decision needed

`public/images/alexis-founder.jpg` is the file that was in the
repository, and it is what About and the founder bands use now. It is
**958×960 but only ~80 KB**, which is a social-media crop rather than a
production asset — it will look soft in the About hero, which renders it
large.

The approved Visual Identity board shows a **different** founder photo —
cream sweater, seated at a table with a mug. Two candidates, and only you
can say which is meant.

**Either way, please supply a full-resolution version.** Replacing the
file at that path is the entire change; `lib/founder.ts` is the single
reference point and only the dimensions need updating if the replacement
is not square.

---

## HOW TO CHECK YOUR WORK

Any slot still showing a plate is a slot still missing a photograph —
they are visually obvious once you know what you are looking at: a
forest, sage or cream panel with olive linework and a line of small caps
describing the picture that belongs there.

Nothing needs rebuilding when you add one. Tina images appear on the next
Tina Cloud index; `public/images/` files appear on the next deploy.
