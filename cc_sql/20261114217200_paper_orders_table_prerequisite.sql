-- 20261114217200_paper_orders_table_prerequisite.sql   (agent F, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- WHY: public.paper_orders is created by NO repo migration (20260923164854 and 20260929003921 "alter table public.paper_orders" and fail on a clean replay).
--      The table exists on production; this file makes the repo able to build it. Owner decision 4: adopt the recovered QA reconcile snapshots
--      (GUESTCOUNT wt-native 20261105000227, 20261105000235, 20261105224118) after a READ-ONLY comparison with production (pg_catalog only).
-- PRODUCTION SHAPE WINS (compared 2026-11-14, iyvdxvotthwrerirdzwd, catalog queries only):
--   * 36 columns, types, NOT NULLs, defaults, CHECK/UNIQUE/FK constraints and the 6 indexes: identical to the snapshot.
--   * RLS policies: production uses plain auth.uid() ("(user_id = auth.uid())"); the snapshot wrote "(select auth.uid())". Production form is implemented.
--   * Grants: production authenticated = INSERT, SELECT (+MAINTAIN on PG17); service_role = all; nothing for anon/PUBLIC. Implemented without MAINTAIN (not a PG16 privilege).
-- IDEMPOTENT: every statement is IF NOT EXISTS / guarded. On production (table exists) this file creates nothing and drops nothing; it only (re)asserts RLS and grants,
--   which are already in that state. A table CREATED by this file is tagged with a table comment so the rollback can remove only what it created.
-- Rollback: ROLLBACK_217200.sql (drops the table only if this file created it AND it is empty; never touches a pre-existing table).

do $mig$
declare v_new boolean := to_regclass('public.paper_orders') is null;
begin
  if v_new then
    create table public.paper_orders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      gathering_id uuid not null references public.gatherings(id) on delete cascade,
      status text not null default 'quoted'
        check (status in ('quoted','checkout_pending','paid','fulfilling','submitted','in_production','shipped','delivered','cancelled','failed')),
      piece_type text not null,
      size_id text not null,
      template_id text not null,
      product_uid text not null,
      quantity integer not null check (quantity >= 1 and quantity <= 500),
      currency text not null default 'USD',
      print_file_url text not null,
      print_file_expires_at timestamptz,
      shipping_address jsonb not null,
      shipment_method_uid text,
      gelato_quote jsonb not null,
      gelato_cost_cents integer not null check (gelato_cost_cents >= 0),
      retail_subtotal_cents integer not null check (retail_subtotal_cents >= 0),
      stripe_checkout_session_id text unique,
      stripe_payment_intent_id text,
      gelato_order_id text unique,
      order_reference_id text not null unique,
      failure_reason text,
      paid_at timestamptz,
      submitted_at timestamptz,
      shipped_at timestamptz,
      delivered_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      gelato_order_type text check (gelato_order_type is null or gelato_order_type in ('draft','order')),
      gelato_fulfillment_status text,
      tracking_carrier text,
      tracking_number text,
      tracking_url text,
      estimated_delivery_min date,
      estimated_delivery_max date,
      fulfillment_synced_at timestamptz
    );
    comment on table public.paper_orders is 'pp:217200:created-by-repo-migration';
  end if;

  create index if not exists paper_orders_user_created_idx on public.paper_orders using btree (user_id, created_at desc);
  create index if not exists paper_orders_gathering_created_idx on public.paper_orders using btree (gathering_id, created_at desc);

  alter table public.paper_orders enable row level security;

  if not exists (select 1 from pg_policy where polrelid = 'public.paper_orders'::regclass and polname = 'Users see their own paper orders') then
    create policy "Users see their own paper orders" on public.paper_orders
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.paper_orders'::regclass and polname = 'Users create their own paper order intents') then
    create policy "Users create their own paper order intents" on public.paper_orders
      for insert to authenticated with check (
        user_id = auth.uid() and public.is_accepted_gathering_member(gathering_id) and status = 'quoted'
        and stripe_checkout_session_id is null and stripe_payment_intent_id is null and gelato_order_id is null
        and paid_at is null and submitted_at is null);
  end if;

  revoke all on public.paper_orders from public, anon;
  revoke update, delete, truncate, references, trigger on public.paper_orders from authenticated;
  grant select, insert on public.paper_orders to authenticated;
  grant all on public.paper_orders to service_role;
end
$mig$;
