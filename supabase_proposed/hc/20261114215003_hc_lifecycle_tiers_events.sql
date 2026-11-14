-- 20261114215003_hc_lifecycle_tiers_events.sql
-- PROPOSED ONLY. NOT APPLIED to any database. EXEC agent A2 (Hosting Collective), 2026-11-14. Additive only.
-- Depends on 214000/214001/214002, 212000/212001/212003, 214003_r1, 215001 (hc_basic_membership). Apply AFTER them.
-- Implements founder decisions D4 (configurable tiers, paid referrals DISABLED, members without paid terms safe) and D5 (events emitted
-- to an outbox with delivery-status tracking; destination NOT hardcoded; nothing is sent by the database).
--   1. hc_tiers: benefits, referral_eligible (default FALSE), assignments_enabled. hc_tier_audit (append-only) records every tier
--      definition change AND every partner status/tier change (trigger-based, so no code path can skip it).
--   2. Staff RPCs: hc_admin_list_tiers, hc_admin_upsert_tier, hc_admin_set_member_tier. (Status changes already exist: hc_set_partner_status.)
--   3. Applicant/member RPCs: creator_program_status, creator_withdraw_application. Own rows only; no internal notes are returned.
--   4. Events: hc_events (deduplicated), hc_event_deliveries (queued/sent/delivered/failed/skipped, retries), hc_notification_destinations
--      (address is DATA set by the owner, inactive until a delivery to it is verified). Triggers emit events from existing flows.
--      Service-role RPCs for the dispatcher: hc_claim_deliveries, hc_delivery_recipient, hc_record_delivery_result.
--   5. Guard: a campaign cannot be assigned to a suspended member, a member whose tier has assignments disabled, or in a closed campaign.
-- No commission amount, rate, tier benefit text or email wording is defined here. Nothing changes existing function bodies.
-- Rollback: ROLLBACK_215003_hc_lifecycle_tiers_events.sql (drops only objects created here; event + audit history is LOST on rollback).

do $$ begin
  if to_regclass('public.hc_tiers') is null or to_regclass('public.partners') is null or to_regclass('public.creator_applications') is null
     or to_regclass('public.hc_owner_notifications') is null or to_regclass('public.payouts') is null
     or to_regclass('public.hc_content_assignments') is null or to_regclass('public.hc_settings') is null
     or to_regprocedure('public.staff_has_permission(text)') is null or to_regprocedure('public.hc_norm_email(text)') is null
     or to_regprocedure('public.hc_require_service()') is null then
    raise exception 'dependency_missing: 212000/212001/214000/214001';
  end if;
end $$;

-- ---------- 1. tiers ----------
alter table public.hc_tiers add column if not exists benefits jsonb not null default '[]'::jsonb;
alter table public.hc_tiers add column if not exists referral_eligible boolean not null default false;
alter table public.hc_tiers add column if not exists assignments_enabled boolean not null default true;
alter table public.hc_tiers add column if not exists updated_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hc_tiers_benefits_shape' and conrelid = 'public.hc_tiers'::regclass) then
    alter table public.hc_tiers add constraint hc_tiers_benefits_shape
      check (jsonb_typeof(benefits) = 'array' and jsonb_array_length(benefits) <= 12);
  end if;
end $$;

create table if not exists public.hc_tier_audit (
  id bigint generated always as identity primary key,
  action text not null check (action in ('tier_created','tier_updated','member_status_changed','member_tier_changed')),
  tier_slug text,
  partner_id uuid,
  actor_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hc_tier_audit_created_idx on public.hc_tier_audit (created_at desc);

-- NOTE: public.hc_append_only_guard() already exists (214000, used by commission_events). It is reused, NOT redefined.
create or replace trigger hc_tier_audit_append_only before update or delete on public.hc_tier_audit
  for each row execute function public.hc_append_only_guard();

-- ---------- 4a. event tables (created before the triggers that use them) ----------
create table if not exists public.hc_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('application_received','application_possible_duplicate','application_awaiting_review','application_approved',
        'application_declined','application_withdrawn','member_onboarded','content_submitted','content_permission_revoked',
        'member_suspended','member_reinstated','payout_needs_approval')),
  ref_type text not null check (char_length(ref_type) between 1 and 40),
  ref_id text not null check (char_length(ref_id) between 1 and 80),      -- a reference only: no name, email or free text is ever stored here
  severity text not null default 'info' check (severity in ('info','action','critical')),
  dedup_key text not null unique check (char_length(dedup_key) between 1 and 120),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid
);
create index if not exists hc_events_open_idx on public.hc_events (created_at desc) where acknowledged_at is null;

create or replace function public.hc_events_guard()
 returns trigger language plpgsql set search_path to '' as $f$
begin
  if tg_op = 'DELETE' then raise exception 'append_only' using errcode = 'P0001'; end if;
  if (new.id, new.kind, new.ref_type, new.ref_id, new.severity, new.dedup_key, new.created_at)
     is distinct from (old.id, old.kind, old.ref_type, old.ref_id, old.severity, old.dedup_key, old.created_at) then
    raise exception 'append_only' using errcode = 'P0001';
  end if;
  return new;
end $f$;
create or replace trigger hc_events_guard before update or delete on public.hc_events
  for each row execute function public.hc_events_guard();

create table if not exists public.hc_notification_destinations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'staff_email' check (channel = 'staff_email'),
  address text not null check (char_length(address) between 5 and 254 and address ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  label text check (label is null or char_length(label) <= 60),
  verified_at timestamptz,                  -- set only by the dispatcher after a test message was DELIVERED (service role)
  active boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (not active or verified_at is not null)   -- cannot be active before delivery is verified
);

create table if not exists public.hc_event_deliveries (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.hc_events(id) on delete cascade,
  channel text not null check (channel in ('inbox','staff_email','applicant_email')),
  destination_id uuid references public.hc_notification_destinations(id),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','skipped')),
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hc_event_deliveries_uniq
  on public.hc_event_deliveries (event_id, channel, coalesce(destination_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists hc_event_deliveries_due_idx on public.hc_event_deliveries (next_attempt_at) where status = 'queued';

-- Internal emitter. Not executable by any API role; called only from the trigger functions below (definer) and the service sweep.
create or replace function public.hc_emit_event(p_kind text, p_ref_type text, p_ref_id text, p_severity text, p_dedup text, p_applicant boolean default false)
 returns bigint language plpgsql security definer set search_path to '' as $f$
declare v_id bigint; d record;
begin
  insert into public.hc_events (kind, ref_type, ref_id, severity, dedup_key) values (p_kind, p_ref_type, p_ref_id, p_severity, p_dedup)
  on conflict (dedup_key) do nothing returning id into v_id;
  if v_id is null then return null; end if;                         -- duplicate emission: nothing new
  insert into public.hc_event_deliveries (event_id, channel, status) values (v_id, 'inbox', 'delivered');   -- the inbox IS the event row, readable by permitted staff
  if p_applicant then insert into public.hc_event_deliveries (event_id, channel) values (v_id, 'applicant_email'); end if;
  for d in select id from public.hc_notification_destinations where active and verified_at is not null and channel = 'staff_email' loop
    insert into public.hc_event_deliveries (event_id, channel, destination_id) values (v_id, 'staff_email', d.id);
  end loop;
  return v_id;
end $f$;

-- ---------- triggers that emit events + audit from the EXISTING flows ----------
create or replace function public.hc_tg_owner_notification_event()
 returns trigger language plpgsql security definer set search_path to '' as $f$
declare v_kind text := case new.kind when 'member_claimed' then 'member_onboarded' else new.kind end;
begin
  perform public.hc_emit_event(v_kind, new.ref_type, new.ref_id, new.severity, 'notif:' || new.id);
  return new;
end $f$;
create or replace trigger hc_owner_notification_event after insert on public.hc_owner_notifications
  for each row execute function public.hc_tg_owner_notification_event();

create or replace function public.hc_tg_application_status_event()
 returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then perform public.hc_emit_event('application_approved', 'creator_application', new.id::text, 'info', 'app:' || new.id || ':approved', true);
    elsif new.status = 'declined' then perform public.hc_emit_event('application_declined', 'creator_application', new.id::text, 'info', 'app:' || new.id || ':declined', true);
    elsif new.status = 'withdrawn' then perform public.hc_emit_event('application_withdrawn', 'creator_application', new.id::text, 'info', 'app:' || new.id || ':withdrawn');
    end if;
  end if;
  return new;
end $f$;
create or replace trigger hc_application_status_event after update of status on public.creator_applications
  for each row execute function public.hc_tg_application_status_event();

create or replace function public.hc_tg_partner_change()
 returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.status is distinct from old.status then
    insert into public.hc_tier_audit (action, tier_slug, partner_id, actor_user_id, detail)
    values ('member_status_changed', new.tier, new.id, auth.uid(), jsonb_build_object('from', old.status, 'to', new.status));
    if new.status = 'suspended' then
      perform public.hc_emit_event('member_suspended', 'partner', new.id::text, 'action', 'partner:' || new.id || ':suspended:' || extract(epoch from clock_timestamp())::bigint);
    elsif old.status = 'suspended' and new.status = 'approved' then
      perform public.hc_emit_event('member_reinstated', 'partner', new.id::text, 'info', 'partner:' || new.id || ':reinstated:' || extract(epoch from clock_timestamp())::bigint);
    end if;
  end if;
  if new.tier is distinct from old.tier then
    insert into public.hc_tier_audit (action, tier_slug, partner_id, actor_user_id, detail)
    values ('member_tier_changed', new.tier, new.id, auth.uid(), jsonb_build_object('from', old.tier, 'to', new.tier));
  end if;
  return new;
end $f$;
create or replace trigger hc_partner_change after update of status, tier on public.partners
  for each row execute function public.hc_tg_partner_change();

create or replace function public.hc_tg_tier_audit()
 returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if tg_op = 'INSERT' then
    insert into public.hc_tier_audit (action, tier_slug, actor_user_id, detail) values ('tier_created', new.slug, auth.uid(), to_jsonb(new));
  elsif to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    insert into public.hc_tier_audit (action, tier_slug, actor_user_id, detail)
    values ('tier_updated', new.slug, auth.uid(), jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  end if;
  return new;
end $f$;
create or replace trigger hc_tier_audit_trg after insert or update on public.hc_tiers
  for each row execute function public.hc_tg_tier_audit();

create or replace function public.hc_tg_payout_event()
 returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.status = 'draft' then perform public.hc_emit_event('payout_needs_approval', 'payout', new.id::text, 'action', 'payout:' || new.id || ':draft'); end if;
  return new;
end $f$;
create or replace trigger hc_payout_event after insert on public.payouts
  for each row execute function public.hc_tg_payout_event();

-- ---------- 5. assignment guard ----------
create or replace function public.hc_tg_assignment_guard()
 returns trigger language plpgsql security definer set search_path to '' as $f$
declare v_p public.partners; v_t public.hc_tiers; v_c public.hc_campaigns;
begin
  select * into v_p from public.partners where id = new.partner_id;
  if not found or v_p.status <> 'approved' then raise exception 'partner_not_approved' using errcode = 'P0001'; end if;
  select * into v_t from public.hc_tiers where slug = v_p.tier;
  if found and not v_t.assignments_enabled then raise exception 'tier_assignments_disabled' using errcode = 'P0001'; end if;
  select * into v_c from public.hc_campaigns where id = new.campaign_id;
  if found and v_c.status = 'closed' then raise exception 'campaign_closed' using errcode = 'P0001'; end if;
  return new;
end $f$;
create or replace trigger hc_assignment_guard before insert on public.hc_content_assignments
  for each row execute function public.hc_tg_assignment_guard();

-- ---------- 2. staff RPCs: tiers ----------
create or replace function public.hc_admin_list_tiers()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', t.slug, 'label', t.label, 'description', t.description,
      'eligibility_notes', t.eligibility_notes, 'benefits', t.benefits, 'referral_eligible', t.referral_eligible,
      'assignments_enabled', t.assignments_enabled, 'sort_order', t.sort_order, 'active', t.active,
      'members', (select count(*) from public.partners p where p.tier = t.slug)) order by t.sort_order, t.slug)
    from public.hc_tiers t), '[]'::jsonb);
end $f$;

create or replace function public.hc_admin_upsert_tier(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_benefits jsonb,
    p_referral_eligible boolean, p_assignments_enabled boolean, p_sort_order integer, p_active boolean)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_old public.hc_tiers; b jsonb;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9_]{2,32}$' then raise exception 'invalid_slug' using errcode = 'P0001'; end if;
  if p_label is null or char_length(trim(p_label)) not between 2 and 60 then raise exception 'invalid_label' using errcode = 'P0001'; end if;
  if p_description is not null and char_length(p_description) > 600 then raise exception 'description_too_long' using errcode = 'P0001'; end if;
  if p_eligibility_notes is not null and char_length(p_eligibility_notes) > 600 then raise exception 'notes_too_long' using errcode = 'P0001'; end if;
  if p_benefits is null or jsonb_typeof(p_benefits) <> 'array' or jsonb_array_length(p_benefits) > 12 then raise exception 'invalid_benefits' using errcode = 'P0001'; end if;
  for b in select * from jsonb_array_elements(p_benefits) loop
    if jsonb_typeof(b) <> 'string' or char_length(b #>> '{}') not between 1 and 200 then raise exception 'invalid_benefits' using errcode = 'P0001'; end if;
  end loop;
  if p_sort_order is null or p_sort_order not between 0 and 10000 then raise exception 'invalid_sort_order' using errcode = 'P0001'; end if;
  select * into v_old from public.hc_tiers where slug = p_slug for update;
  -- Referral eligibility is a money-adjacent switch: only the owner (hc.payout) may turn it on or off.
  if coalesce(p_referral_eligible, false) is distinct from coalesce(v_old.referral_eligible, false)
     and not public.staff_has_permission('hc.payout') then
    raise exception 'owner_required' using errcode = 'P0001';
  end if;
  if not found then
    insert into public.hc_tiers (slug, label, description, eligibility_notes, benefits, referral_eligible, assignments_enabled, sort_order, active)
    values (p_slug, trim(p_label), nullif(trim(coalesce(p_description,'')),''), nullif(trim(coalesce(p_eligibility_notes,'')),''), p_benefits,
            coalesce(p_referral_eligible,false), coalesce(p_assignments_enabled,true), p_sort_order, coalesce(p_active,true));
  else
    update public.hc_tiers set label = trim(p_label), description = nullif(trim(coalesce(p_description,'')),''),
        eligibility_notes = nullif(trim(coalesce(p_eligibility_notes,'')),''), benefits = p_benefits,
        referral_eligible = coalesce(p_referral_eligible,false), assignments_enabled = coalesce(p_assignments_enabled,true),
        sort_order = p_sort_order, active = coalesce(p_active,true), updated_at = now()
     where slug = p_slug;
  end if;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.tier_upsert', 'hc_tier', p_slug, jsonb_build_object('created', v_old.slug is null));
  return jsonb_build_object('status', case when v_old.slug is null then 'created' else 'updated' end, 'slug', p_slug);
end $f$;

create or replace function public.hc_admin_set_member_tier(p_partner_id uuid, p_tier text)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_p public.partners;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into v_p from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found' using errcode = 'P0001'; end if;
  if v_p.status <> 'approved' then raise exception 'partner_not_approved' using errcode = 'P0001'; end if;
  if p_tier is not null and not exists (select 1 from public.hc_tiers where slug = p_tier and active) then raise exception 'tier_not_configured' using errcode = 'P0001'; end if;
  update public.partners set tier = p_tier where id = p_partner_id;        -- NULL = basic member (no paid terms); audited by trigger
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.member_tier', 'partner', p_partner_id::text, jsonb_build_object('from', v_p.tier, 'to', p_tier));
  return jsonb_build_object('status', 'saved', 'tier', p_tier);
end $f$;

create or replace function public.hc_admin_tier_audit(p_limit integer default 100)
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'tier_slug', a.tier_slug, 'partner_id', a.partner_id,
      'actor_user_id', a.actor_user_id, 'detail', a.detail, 'created_at', a.created_at) order by a.id desc)
    from (select * from public.hc_tier_audit order by id desc limit least(greatest(coalesce(p_limit,100),1),500)) a), '[]'::jsonb);
end $f$;

-- Referral eligibility, for the commission reconciler (A7) and the portal. Paid referrals stay OFF unless ALL of these hold.
-- Internal (no caller check; not granted to any API role): used by the checked wrapper below and by creator_program_status.
create or replace function public.hc_partner_referral_state(p_partner_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_p public.partners; v_t public.hc_tiers; v_set public.hc_settings;
begin
  select * into v_set from public.hc_settings where singleton;
  select * into v_p from public.partners where id = p_partner_id;
  if not found then return jsonb_build_object('eligible', false, 'reason', 'partner_not_found'); end if;
  if not coalesce(v_set.enabled, false) then return jsonb_build_object('eligible', false, 'reason', 'program_disabled'); end if;
  if v_p.status <> 'approved' then return jsonb_build_object('eligible', false, 'reason', 'partner_not_approved'); end if;
  if v_p.tier is null then return jsonb_build_object('eligible', false, 'reason', 'basic_member_no_paid_terms'); end if;
  select * into v_t from public.hc_tiers where slug = v_p.tier;
  if not found or not v_t.active then return jsonb_build_object('eligible', false, 'reason', 'tier_inactive'); end if;
  if not v_t.referral_eligible then return jsonb_build_object('eligible', false, 'reason', 'tier_not_referral_eligible'); end if;
  return jsonb_build_object('eligible', true, 'reason', 'ok');
end $f$;

create or replace function public.hc_partner_referral_eligible(p_partner_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if auth.role() is distinct from 'service_role' and not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return public.hc_partner_referral_state(p_partner_id);
end $f$;

-- ---------- 3. applicant / member RPCs (own rows only) ----------
create or replace function public.hc_my_application_id()
 returns uuid language plpgsql stable security definer set search_path to '' as $f$
declare v_uid uuid := auth.uid(); v_email text; v_conf timestamptz; v_id uuid;
begin
  if v_uid is null then return null; end if;
  select email, email_confirmed_at into v_email, v_conf from auth.users where id = v_uid;
  select a.id into v_id from public.creator_applications a
   where a.applicant_user_id = v_uid or (v_conf is not null and a.email_normalized = public.hc_norm_email(v_email))
   order by a.created_at desc limit 1;
  return v_id;
end $f$;

create or replace function public.creator_program_status()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_app public.creator_applications; v_p public.partners; v_t public.hc_tiers; v_id uuid; v_el jsonb;
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  v_id := public.hc_my_application_id();
  if v_id is not null then select * into v_app from public.creator_applications where id = v_id; end if;
  select * into v_p from public.partners where user_id = auth.uid();
  if found and v_p.status = 'approved' then
    select * into v_t from public.hc_tiers where slug = v_p.tier;
    v_el := public.hc_partner_referral_state(v_p.id);
  end if;
  return jsonb_build_object(
    'application', case when v_app.id is null then null else jsonb_build_object('status', v_app.status, 'submitted_at', v_app.created_at, 'decided_at', v_app.reviewed_at) end,
    'member', case when v_p.id is null then null else jsonb_build_object('status', v_p.status,
        'tier', case when v_t.slug is null then null else jsonb_build_object('slug', v_t.slug, 'label', v_t.label, 'description', v_t.description, 'benefits', v_t.benefits) end,
        'assignments_enabled', coalesce(v_t.assignments_enabled, true),
        'referral', v_el) end);
end $f$;

create or replace function public.creator_withdraw_application()
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  v_id := public.hc_my_application_id();
  if v_id is null then raise exception 'no_application' using errcode = 'P0001'; end if;
  select status into v_status from public.creator_applications where id = v_id for update;
  if v_status not in ('received','in_review') then raise exception 'not_withdrawable' using errcode = 'P0001'; end if;
  update public.creator_applications set status = 'withdrawn' where id = v_id;
  return jsonb_build_object('status', 'withdrawn');
end $f$;

-- ---------- 4b. staff read/ack of events; destinations ----------
create or replace function public.hc_admin_list_events(p_only_open boolean default true, p_limit integer default 100)
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'ref_type', e.ref_type, 'ref_id', e.ref_id, 'severity', e.severity,
      'created_at', e.created_at, 'acknowledged_at', e.acknowledged_at,
      'deliveries', coalesce((select jsonb_object_agg(x.status, x.n) from (select d.status, count(*) n from public.hc_event_deliveries d
            where d.event_id = e.id and d.channel <> 'inbox' group by d.status) x), '{}'::jsonb)) order by e.id desc)
    from (select * from public.hc_events where (not coalesce(p_only_open, true)) or acknowledged_at is null
          order by id desc limit least(greatest(coalesce(p_limit,100),1),500)) e), '[]'::jsonb);
end $f$;

create or replace function public.hc_admin_ack_event(p_id bigint)
 returns void language plpgsql security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  update public.hc_events set acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()) where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $f$;

create or replace function public.hc_admin_delivery_health()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'by_status', coalesce((select jsonb_object_agg(k, n) from (select channel || ':' || status as k, count(*) n from public.hc_event_deliveries where channel <> 'inbox' group by 1) x), '{}'::jsonb),
    'oldest_queued_minutes', (select floor(extract(epoch from (now() - min(created_at))) / 60)::int from public.hc_event_deliveries where channel <> 'inbox' and status = 'queued'),
    'failed', (select count(*) from public.hc_event_deliveries where status = 'failed'),
    'active_destinations', (select count(*) from public.hc_notification_destinations where active),
    'unverified_destinations', (select count(*) from public.hc_notification_destinations where verified_at is null));
end $f$;

create or replace function public.hc_admin_list_destinations()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label,
      'address_masked', left(d.address, 2) || '***@' || split_part(d.address, '@', 2), 'verified', d.verified_at is not null, 'active', d.active) order by d.created_at)
    from public.hc_notification_destinations d), '[]'::jsonb);
end $f$;

create or replace function public.hc_admin_add_destination(p_address text, p_label text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_id uuid; v_addr text := lower(trim(coalesce(p_address, '')));
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if char_length(v_addr) not between 5 and 254 or v_addr !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_address' using errcode = 'P0001'; end if;
  if p_label is not null and char_length(p_label) > 60 then raise exception 'label_too_long' using errcode = 'P0001'; end if;
  insert into public.hc_notification_destinations (address, label, created_by) values (v_addr, nullif(trim(coalesce(p_label,'')),''), auth.uid()) returning id into v_id;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.destination_added', 'hc_destination', v_id::text, '{}'::jsonb);        -- the address itself is never written to the audit log
  return jsonb_build_object('status', 'added_unverified', 'id', v_id);
end $f$;

create or replace function public.hc_admin_set_destination_active(p_id uuid, p_active boolean)
 returns void language plpgsql security definer set search_path to '' as $f$
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_active and not exists (select 1 from public.hc_notification_destinations where id = p_id and verified_at is not null) then raise exception 'not_verified' using errcode = 'P0001'; end if;
  update public.hc_notification_destinations set active = coalesce(p_active, false) where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.destination_active', 'hc_destination', p_id::text, jsonb_build_object('active', coalesce(p_active, false)));
end $f$;

-- ---------- dispatcher RPCs (service role only) ----------
create or replace function public.hc_mark_destination_verified(p_id uuid)
 returns void language plpgsql security definer set search_path to '' as $f$
begin
  perform public.hc_require_service();
  update public.hc_notification_destinations set verified_at = coalesce(verified_at, now()) where id = p_id;
end $f$;

create or replace function public.hc_claim_deliveries(p_limit integer default 20, p_channel text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v jsonb;
begin
  perform public.hc_require_service();
  with c as (
    select id from public.hc_event_deliveries
     where status = 'queued' and next_attempt_at <= now() and channel <> 'inbox' and (p_channel is null or channel = p_channel)
     order by id limit least(greatest(coalesce(p_limit,20),1),100) for update skip locked),
  u as (
    update public.hc_event_deliveries d set attempts = d.attempts + 1, updated_at = now(),
           next_attempt_at = now() + interval '10 minutes'            -- lease: a crashed worker's claim becomes due again
      from c where d.id = c.id
    returning d.id, d.event_id, d.channel, d.destination_id, d.attempts)
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'event_id', u.event_id, 'channel', u.channel, 'destination_id', u.destination_id,
         'attempts', u.attempts, 'kind', e.kind, 'ref_type', e.ref_type, 'ref_id', e.ref_id, 'severity', e.severity) order by u.id), '[]'::jsonb)
    into v from u join public.hc_events e on e.id = u.event_id;
  return v;
end $f$;

create or replace function public.hc_delivery_recipient(p_delivery_id bigint)
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare d public.hc_event_deliveries; e public.hc_events; v_app public.creator_applications; v_dest public.hc_notification_destinations;
begin
  perform public.hc_require_service();
  select * into d from public.hc_event_deliveries where id = p_delivery_id;
  if not found then return null; end if;
  select * into e from public.hc_events where id = d.event_id;
  if d.channel = 'applicant_email' then
    select * into v_app from public.creator_applications where id = (e.ref_id)::uuid;
    if not found or not v_app.consent_to_contact then return null; end if;
    return jsonb_build_object('email', v_app.email, 'display_name', v_app.full_name, 'kind', e.kind);
  elsif d.channel = 'staff_email' then
    select * into v_dest from public.hc_notification_destinations where id = d.destination_id and active and verified_at is not null;
    if not found then return null; end if;
    return jsonb_build_object('email', v_dest.address, 'kind', e.kind);
  end if;
  return null;
end $f$;

create or replace function public.hc_record_delivery_result(p_id bigint, p_outcome text, p_error text default null, p_provider_id text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare d public.hc_event_deliveries; v_err text;
begin
  perform public.hc_require_service();
  if p_outcome not in ('sent','delivered','failed','skipped') then raise exception 'invalid_outcome' using errcode = 'P0001'; end if;
  select * into d from public.hc_event_deliveries where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  v_err := case when p_error ~ '^[a-z0-9_]{1,60}$' then p_error else case when p_error is null then null else 'error' end end;   -- a code only, never provider text
  if d.status in ('delivered','failed','skipped') then return jsonb_build_object('status', d.status); end if;      -- terminal states are final
  if p_outcome = 'delivered' and d.status not in ('queued','sent') then return jsonb_build_object('status', d.status); end if;
  if p_outcome = 'sent' and d.status <> 'queued' then return jsonb_build_object('status', d.status); end if;
  if p_outcome = 'failed' then
    if d.attempts >= d.max_attempts or d.status = 'sent' then      -- a bounce after the provider accepted it is final, not retried
      update public.hc_event_deliveries set status = 'failed', last_error = v_err, updated_at = now() where id = p_id;
      return jsonb_build_object('status', 'failed');
    end if;
    update public.hc_event_deliveries set status = 'queued', last_error = v_err, updated_at = now(),
           next_attempt_at = now() + least(power(2, d.attempts)::int * interval '5 minutes', interval '12 hours') where id = p_id;
    return jsonb_build_object('status', 'queued', 'retry', true);
  end if;
  update public.hc_event_deliveries set status = p_outcome, provider_message_id = coalesce(p_provider_id, provider_message_id), last_error = null, updated_at = now() where id = p_id;
  return jsonb_build_object('status', p_outcome);
end $f$;

create or replace function public.hc_emit_awaiting_review(p_hours integer default 48)
 returns integer language plpgsql security definer set search_path to '' as $f$
declare r record; n integer := 0;
begin
  perform public.hc_require_service();
  for r in select id from public.creator_applications where status = 'received' and created_at < now() - make_interval(hours => least(greatest(coalesce(p_hours,48),1),720)) loop
    if public.hc_emit_event('application_awaiting_review', 'creator_application', r.id::text, 'action',
         'app:' || r.id || ':await:' || to_char(current_date, 'YYYYMMDD')) is not null then n := n + 1; end if;
  end loop;
  return n;
end $f$;

-- ---------- RLS + grants ----------
do $$ declare t text; begin
  foreach t in array array['hc_tier_audit','hc_events','hc_notification_destinations','hc_event_deliveries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
revoke all on sequence public.hc_tier_audit_id_seq, public.hc_events_id_seq, public.hc_event_deliveries_id_seq from public, anon, authenticated;

revoke execute on function
  public.hc_events_guard(), public.hc_emit_event(text, text, text, text, text, boolean),
  public.hc_tg_owner_notification_event(), public.hc_tg_application_status_event(), public.hc_tg_partner_change(), public.hc_tg_tier_audit(),
  public.hc_tg_payout_event(), public.hc_tg_assignment_guard(), public.hc_my_application_id(), public.hc_partner_referral_state(uuid),
  public.hc_admin_list_tiers(), public.hc_admin_upsert_tier(text, text, text, text, jsonb, boolean, boolean, integer, boolean),
  public.hc_admin_set_member_tier(uuid, text), public.hc_admin_tier_audit(integer), public.hc_partner_referral_eligible(uuid),
  public.creator_program_status(), public.creator_withdraw_application(),
  public.hc_admin_list_events(boolean, integer), public.hc_admin_ack_event(bigint), public.hc_admin_delivery_health(),
  public.hc_admin_list_destinations(), public.hc_admin_add_destination(text, text), public.hc_admin_set_destination_active(uuid, boolean),
  public.hc_mark_destination_verified(uuid), public.hc_claim_deliveries(integer, text), public.hc_delivery_recipient(bigint),
  public.hc_record_delivery_result(bigint, text, text, text), public.hc_emit_awaiting_review(integer)
  from public, anon, authenticated;

grant execute on function
  public.creator_program_status(), public.creator_withdraw_application(),
  public.hc_admin_list_tiers(), public.hc_admin_upsert_tier(text, text, text, text, jsonb, boolean, boolean, integer, boolean),
  public.hc_admin_set_member_tier(uuid, text), public.hc_admin_tier_audit(integer), public.hc_partner_referral_eligible(uuid),
  public.hc_admin_list_events(boolean, integer), public.hc_admin_ack_event(bigint), public.hc_admin_delivery_health(),
  public.hc_admin_list_destinations(), public.hc_admin_add_destination(text, text), public.hc_admin_set_destination_active(uuid, boolean)
  to authenticated, service_role;
grant execute on function
  public.hc_mark_destination_verified(uuid), public.hc_claim_deliveries(integer, text), public.hc_delivery_recipient(bigint),
  public.hc_record_delivery_result(bigint, text, text, text), public.hc_emit_awaiting_review(integer), public.hc_partner_referral_eligible(uuid)
  to service_role;
