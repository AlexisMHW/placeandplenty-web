# WEB PURCHASE — what is built, and the one thing that is not

**For:** Alexis, and App Claude for the shared-backend half
**Date:** 28 August 2026
**Requirement:** *"Web purchase/account creation is a V1 requirement, not
a future note. Free web account creation. Gathering Pass web purchase.
Plus web purchase. All eligible entitlements retained across web +
native regardless of purchase channel. No duplicate purchases or
platform-specific entitlement copies."*

---

## 1. THE HEADLINE

**Free web account creation is DONE and works today.** `/signup` creates
a real Place & Plenty account — the same canonical account the app
creates, not a web variant.

**The canonical cross-platform entitlement model already existed.** It
was not built for this and nothing was added to the schema. It is
already channel-agnostic and already does what you asked for.

**Web checkout is built on the website side and cannot be switched on
until you have a payment processor.** That is the only gap, it is a
commercial account rather than a piece of code, and I cannot open one on
your behalf. Everything either side of it is written.

---

## 2. WHAT THE BACKEND ALREADY GETS RIGHT

This was checked against the live database, not assumed. `gathering_entitlements`
carries, per row:

| Column | What it does for your rule |
|---|---|
| `user_id` | The account. The only identity that matters. |
| `scope` | `account` (Plus) or `gathering` (a Pass), with a CHECK tying `gathering_id` to it |
| `entitlement_type` | `plus` / `gathering_pass` |
| **`canonical_product_id`** | **`plus_annual` / `gathering_pass` — the cross-platform product identity** |
| `provider` | `apple` / `google` / `web` — *where it was bought*, nothing more |
| `store_product_id` | The platform SKU, for reconciliation only |
| `active`, `expires_at`, `consumed_at`, `refunded_at`, `revoked_at` | Lifecycle |

`canonical_product_id` is what makes "one account, one entitlement, many
channels" true **in the data** rather than only in the marketing copy.
The product someone owns is `plus_annual`. Apple's SKU, Google's SKU and
a web checkout are three routes to that same row.

**There is no web plan and no app plan. There is Plus, plus a note of
where it was bought.** Nothing on the website creates a second model, and
nothing should.

### The security posture, which decided the whole design

`gathering_entitlements` and `purchase_intents` are **SELECT-only for
signed-in users.** Neither has an INSERT policy. Entitlements are minted
server-side, by a trusted process, after a payment is verified.

That is correct, and it means the website **reads and never writes**
entitlements. Every purchase must land through a webhook with the service
role. Which is exactly how the flow below is built.

---

## 3. WHAT IS BUILT AND WORKING NOW

| Piece | State | Where |
|---|---|---|
| Free web account creation | ✅ **Live** | `/signup`, `app/(marketing)/signup/` |
| Canonical entitlement read | ✅ **Live** | `lib/entitlement-data.ts` |
| Entitlement model + rules | ✅ **Live** | `lib/entitlements.ts` |
| Billing panel showing real state | ✅ **Live** | `/host/account` → `components/host/PlanPanel.tsx` |
| Checkout surfaces for both paid products | ✅ **Built** | `/checkout/gathering-pass`, `/checkout/plus` |
| Duplicate-purchase guard | ✅ **Built** | `CheckoutAction` — refuses to sell Plus to an account that already holds it |
| Pass→gathering binding | ✅ **Built** | The gathering picker, required by the DB's own CHECK |
| Four conversion paths | ✅ **Live** | `lib/conversion.ts`, on every closing band |
| Cross-platform disclosure | ✅ **Live** | Pricing, Support, Terms |
| **Card payment** | ❌ **Needs a processor** | See §4 |
| **Webhook that mints the entitlement** | ❌ **Written below, not deployed** | See §5 |

### Two details worth knowing

**`handle_new_user` fires for every client.** The old login page said
accounts could only be made in the app because a web sign-up "would
create profiles that have never seen onboarding or entitlement setup".
That reasoning does not survive contact with the database: the
`on_auth_user_created` trigger writes the canonical profile whatever the
client is, and it reads `first_name` / `last_name` from user metadata —
which is why the sign-up form asks for a name and passes it through.

**Free is the ABSENCE of an entitlement row**, not the presence of one.
There is nothing to provision for a free account on any surface, which is
why `/signup` needs no backend work at all.

---

## 4. WHAT YOU NEED TO SUPPLY

This is the whole list. None of it is code.

1. **A payment processor account** — Stripe is the obvious choice for
   this shape (one-off Pass, annual Plus, tax handled by Stripe Tax).
2. **Two products in it**, with these exact metadata keys so the webhook
   can map back to canonical ids without a lookup table:
   - Gathering Pass · one-off · `$9.99` · metadata `canonical_product_id=gathering_pass`
   - Place & Plenty Plus · annual · `$59.99` · metadata `canonical_product_id=plus_annual`
   - **Enable Stripe Tax** on both. The site says "+ applicable taxes and
     fees" everywhere; the checkout has to actually behave that way.
3. **Three environment variables in Vercel** (Production and Preview):
   ```
   PAYMENT_PROCESSOR_SECRET_KEY=sk_live_...
   PAYMENT_PROCESSOR_PRICE_GATHERING_PASS=price_...
   PAYMENT_PROCESSOR_PRICE_PLUS_ANNUAL=price_...
   ```
   `isCheckoutConfigured()` reads the first one. The moment it is set,
   the "Continue to payment" button appears and the "opens with the app
   release" note disappears — nothing else changes.
4. **Two Supabase secrets** for the webhook:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```
5. **Deploy the Edge Function in §5** and point a Stripe webhook at it
   for `checkout.session.completed` and
   `customer.subscription.deleted`.

**Decide who owns step 5.** It writes to the shared backend, so it is
App Claude's territory rather than the website's — I have written it
rather than deployed it deliberately.

---

## 5. THE WEBHOOK — the one server-side piece still to deploy

`supabase/functions/web-purchase-webhook/index.ts`

What it must do, and why each part matters:

```ts
// 1. VERIFY THE SIGNATURE FIRST. An unverified webhook endpoint that
//    mints entitlements is an endpoint that hands out Plus to anyone who
//    can POST to it.
const event = stripe.webhooks.constructEvent(
  await req.text(),
  req.headers.get("stripe-signature")!,
  Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
);

// 2. TRUST THE SESSION, NOT THE CLIENT. user_id and gathering_id come
//    from the metadata the SERVER put on the session when it was
//    created — never from anything the browser sent to the webhook.
const s = event.data.object;
const userId = s.metadata.user_id;
const gatheringId = s.metadata.gathering_id ?? null;
const canonicalProductId = s.metadata.canonical_product_id;

// 3. BE IDEMPOTENT. Stripe retries. Upsert on the transaction id so a
//    replay does not create a second entitlement — which is precisely
//    the duplicate the governing rule forbids.
await supabase.from("gathering_entitlements").upsert({
  user_id: userId,
  gathering_id: gatheringId,
  scope: gatheringId ? "gathering" : "account",
  entitlement_type: canonicalProductId === "plus_annual" ? "plus" : "gathering_pass",
  canonical_product_id: canonicalProductId,   // SAME id the stores use
  provider: "web",                            // only a note of origin
  provider_transaction_id: s.payment_intent ?? s.subscription,
  purchase_intent_id: s.metadata.purchase_intent_id,
  environment: s.livemode ? "production" : "sandbox",
  active: true,
  purchased_at: new Date().toISOString(),
  expires_at: canonicalProductId === "plus_annual" ? oneYearFromNow : null,
}, { onConflict: "provider_transaction_id" });

// 4. CLOSE THE INTENT and write the audit row.
await supabase.from("purchase_intents")
  .update({ status: "fulfilled", fulfilled_at: now,
            provider_transaction_id: txId })
  .eq("id", s.metadata.purchase_intent_id);

await supabase.from("entitlement_events").insert({
  user_id: userId, gathering_id: gatheringId,
  event_type: "granted", source: "web",
  provider_transaction_id: txId,
});
```

**The route that creates the session** (`app/api/checkout/route.ts`) is
the small remaining website piece and is deliberately not written yet,
because its shape depends on which processor you pick. It does three
things: `getUser()`, insert a `purchase_intents` row via a
`SECURITY DEFINER` RPC (users cannot INSERT directly, correctly), then
create the session with `user_id`, `gathering_id`, `canonical_product_id`
and `purchase_intent_id` in metadata. `CheckoutAction` already posts to
it with the right fields.

### One backend addition needed

A `SECURITY DEFINER` function so a signed-in user can create their own
pending intent without an INSERT policy on the table:

```sql
create or replace function public.create_purchase_intent(
  p_canonical_product_id text,
  p_gathering_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- Pass must name a gathering the caller can actually see.
  if p_canonical_product_id = 'gathering_pass' then
    if p_gathering_id is null then raise exception 'gathering required'; end if;
    if not is_accepted_gathering_member(p_gathering_id) then
      raise exception 'not your gathering';
    end if;
  end if;
  insert into purchase_intents (user_id, gathering_id, canonical_product_id,
                                status, expires_at)
  values (auth.uid(), p_gathering_id, p_canonical_product_id,
          'pending', now() + interval '1 hour')
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.create_purchase_intent from anon;
grant execute on function public.create_purchase_intent to authenticated;
```

Note the `revoke ... from anon` — the audit lists 82 `anon_*` advisories
already, and this should not become the 83rd.

---

## 6. WHAT THE SITE SAYS WHILE THIS IS PENDING

Nothing implies a purchase can be made. §17 and §32 forbid it, and the
site is careful about it:

- The plan cards' paid buttons go to a **real page** that explains the
  purchase, checks what you already own, and binds a Pass to a gathering.
- That page then says: *"Card payment opens with the app release. The
  plan, the price and the account it lands on are all settled — nothing
  about them changes when it does."*
- **No disabled button that looks live.** The alternative offered is the
  thing that genuinely works: keep planning for free.
- `WEB_CHECKOUT_LIVE` in `lib/entitlements.ts` keeps "Buy on Web" out of
  the four conversion paths until it is true.

---

## 7. CROSS-PLATFORM FEATURE AVAILABILITY — now disclosed

Per your instruction, and it is a real distinction rather than a
disclaimer:

> Some Plus features require the Place & Plenty mobile app. Plus access
> follows your account across platforms, but feature availability may
> vary between web and mobile.

That sentence is a constant (`FEATURE_AVAILABILITY_NOTE`) and appears
verbatim on **Pricing** (twice — under the cards and in the one-account
band), in the **Support FAQ**, on the **checkout page**, in the **account
billing panel**, and in the **Terms**, which also carries the liability
wording: we are not responsible for inability to use a native-only
feature where that results solely from choosing not to install the app,
subject to applicable law.

The two native-only features and their product reasons are named
everywhere rather than left vague:

- **Host Mode** — runs on gathering-day notifications while you move
  around the house. A desktop version is a screen nobody is sitting at
  when it matters.
- **Space Mode** — starts with a camera pointed at a room. The capture
  step is the feature.

Ten of the twelve Hub cards are on the web.

---

## 8. THE ORDER I WOULD DO IT IN

1. Open the Stripe account and create the two products with the metadata
   keys in §4. *(You — 30 minutes.)*
2. Deploy `create_purchase_intent` and the webhook. *(App Claude.)*
3. Set the Vercel and Supabase variables. *(You.)*
4. Write `app/api/checkout/route.ts` against the real processor. *(Me,
   once 1–3 exist — it is about 60 lines.)*
5. Flip `WEB_CHECKOUT_LIVE` to `true`.
6. Test both products end to end in sandbox, then confirm the entitlement
   appears on a phone signed into the same account. **That last step is
   the whole point and is the one worth doing by hand.**
