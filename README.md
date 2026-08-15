# Place & Plenty — Marketing Website

The public marketing site for **Place & Plenty** at placeandplenty.com.
This is the site that *sells and explains* Place & Plenty — the native
app *is* Place & Plenty. See the source PRD/addenda for full context.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (brand tokens in `tailwind.config.ts`)
- Supabase (waitlist + Founding Host application storage)
- MailerLite (email sending — sync from Supabase, see below)
- Deployed on Vercel; domain stays registered at Bluehost

## Brand tokens

Colors, type (Playfair Display / Lato), spacing, and shadows are all
defined in `tailwind.config.ts` and `app/globals.css`, matching the
confirmed native app brand system exactly.

## Launch states

Everything CTA/visibility-related is controlled from one file:
`lib/launch-state.ts`. Change `LAUNCH_STATE` to `"pre-launch"`,
`"beta"`, or `"public"` to switch the whole site's primary CTA and
which sections show (App Store badges, pricing) — no per-component
edits needed.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

## Waitlist data flow

Guest List and Founding Host forms write directly to Supabase tables
(`marketing_leads`, `founding_host_applications`). Syncing those rows
into MailerLite (for actual campaign sends) is not yet wired up —
recommended path is a scheduled Supabase → MailerLite sync (edge
function or Zapier-style integration) rather than sending straight
from the form, to avoid duplicate signups and keep one source of
truth in Supabase.

## Required Supabase tables

```sql
create table marketing_leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  email text not null,
  upcoming_gathering_type text,
  source text not null,
  consent boolean not null default true,
  created_at timestamptz not null default now()
);

create table founding_host_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  email text not null,
  hosting_what text not null,
  gathering_date date,
  estimated_guest_count text,
  hosting_frequency text,
  interest_reason text,
  created_at timestamptz not null default now()
);
```

## Deployment (Vercel + Bluehost domain)

1. Push this repo to GitHub.
2. Import the repo in Vercel, add the env vars from `.env.example`.
3. In Bluehost's DNS settings for placeandplenty.com, point the domain
   at Vercel (either an A record to Vercel's IP + CNAME for `www`, or
   use Vercel's nameservers — Vercel's project settings show the exact
   records to add once the project exists).
4. Domain stays registered/billed at Bluehost; only DNS changes.

## Before public launch — do not skip

- [ ] Replace placeholder Privacy Policy / Terms with attorney-reviewed copy
- [ ] Replace placeholder app screenshots with real ones
- [ ] Confirm pricing before enabling `showPricing`
- [ ] Wire up real App Store / Google Play URLs before `LAUNCH_STATE = "public"`
- [ ] Set up Supabase → MailerLite sync
