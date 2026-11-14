-- 20261114217110_hc_tier_writers_and_inbox_reconcile.sql   (A1b, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- Reconciles the overlap between A2 (215003), A7 (216100), A3 (217100/217101/217102) and A1 (217002, retired 218000):
--   (d) TIER WRITERS. Before: A2 hc_admin_upsert_tier / hc_admin_set_member_tier and A7+A3 hc_upsert_tier / hc_admin_assign_tier wrote hc_tiers /
--       partners.tier through separate code. After: ONE definition writer (internal hc_tier_write) and ONE assignment writer (A3 hc_admin_assign_tier).
--       Every public RPC name the web UIs call is kept, with its original signature, validation order, error codes and return shape:
--         hc_upsert_tier(8 args)              -> thin wrapper over hc_tier_write            (A3 UI)
--         hc_admin_upsert_tier(9 args)        -> A2 validation, then hc_tier_write          (A2 UI)
--         hc_admin_set_member_tier(2 args)    -> A2 pre-checks, then hc_admin_assign_tier   (A2 UI)
--       Table-level invariants stay trigger-enforced for every path: hc_config_audit (A7, with reason), hc_tier_audit (A2), eligibility-flag sync (A1 217002),
--       assignments_enabled/suspended guard (A2). hc_admin_list_tiers (union of A2 + A3 keys) is defined once, in 217101.
--   (b) FOUNDER INBOX. A3's cc_notifications (217102) is the canonical D5 inbox. A1's founder_notifications (218000) is retired (SUPERSEDED_, never applied).
--       This file adds nothing for it: dedup key, severity rank, minimal data, delivery tracking (queued != sent != delivered), retry/backoff and audit are already
--       in 217102. Founder email address is a config row (cc_notification_settings), never in source.
--   (e) A2's hc_events outbox is kept for HC domain events + applicant email. Its 'staff_email' destinations duplicate A3's single verified founder destination
--       (none exist by default, so it is inert). To make a double founder email impossible, hc_emit_event skips the 'staff_email' fan-out whenever A3's founder
--       email channel (cc_notification_settings.email_enabled) is ON. With A3's channel off, A2's behavior (and its 148 tests) is unchanged.
-- Depends on: 215003, 216100, 217002, 217100, 217101, 217102. Rollback: ROLLBACK_217110.sql (restores the A2 / A7 bodies captured from their files).
do $$ begin
  if to_regprocedure('public.hc_admin_upsert_tier(text,text,text,text,jsonb,boolean,boolean,integer,boolean)') is null
     or to_regprocedure('public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text)') is null
     or to_regprocedure('public.hc_admin_assign_tier(uuid,text,text)') is null
     or to_regclass('public.cc_notifications') is null
     or to_regprocedure('public.hc_emit_event(text,text,text,text,text,boolean)') is null
     or not exists (select 1 from pg_trigger where tgname = 'hc_tiers_flag_sync') then
    raise exception 'dependency_missing: 215003, 216100, 217002, 217100-217102 must be applied first';
  end if;
end $$;

-- ---------- internal single writer for tier DEFINITIONS (not callable by any API role) ----------
create or replace function public.hc_tier_write(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_sort_order integer,
    p_active boolean, p_paid_referrals_eligible boolean, p_benefits jsonb, p_assignments_enabled boolean, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_old public.hc_tiers; v_elig boolean;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9_]{2,32}$' then raise exception 'invalid_slug' using errcode = 'P0001'; end if;
  if p_label is null or char_length(btrim(p_label)) not between 2 and 60 then raise exception 'invalid_label' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into v_old from public.hc_tiers where slug = p_slug for update;
  v_elig := coalesce(p_paid_referrals_eligible, false);   -- paid referrals eligibility defaults to FALSE (D4)
  if (not found and v_elig) or (found and v_elig is distinct from v_old.paid_referrals_eligible) then
    if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized_referral_eligibility' using errcode = 'P0001'; end if;
  end if;
  perform set_config('hc.audit_reason', left(p_reason, 200), true);
  -- explicit insert/update (NOT insert ... on conflict): the BEFORE INSERT flag-sync trigger would otherwise see an unchanged eligible tier as a new grant
  -- and wrongly demand the owner for a harmless label edit by a manager.
  if v_old.slug is null then
    insert into public.hc_tiers (slug, label, description, eligibility_notes, sort_order, active, paid_referrals_eligible, benefits, assignments_enabled)
    values (p_slug, btrim(p_label), p_description, p_eligibility_notes, coalesce(p_sort_order, 100), coalesce(p_active, true), v_elig,
            coalesce(p_benefits, '[]'::jsonb), coalesce(p_assignments_enabled, true));
  else
    update public.hc_tiers set label = btrim(p_label), description = p_description, eligibility_notes = p_eligibility_notes,
        sort_order = coalesce(p_sort_order, 100), active = coalesce(p_active, true), paid_referrals_eligible = v_elig,
        benefits = coalesce(p_benefits, benefits), assignments_enabled = coalesce(p_assignments_enabled, assignments_enabled), updated_at = now()
     where slug = p_slug;
  end if;
  return jsonb_build_object('status', case when v_old.slug is null then 'created' else 'updated' end, 'slug', p_slug);
end;
$function$;
revoke all on function public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text) from public, anon, authenticated;
grant execute on function public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text) to service_role;

-- A7 / A3 contract preserved exactly (8 args, reason required).
create or replace function public.hc_upsert_tier(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_sort_order integer,
                                                 p_active boolean, p_paid_referrals_eligible boolean, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  return public.hc_tier_write(p_slug, p_label, p_description, p_eligibility_notes, p_sort_order, p_active, p_paid_referrals_eligible, null, null, p_reason);
end;
$function$;

-- A2 contract preserved (9 args, no reason argument): its own validation and its owner_required check run first, the write goes through hc_tier_write.
create or replace function public.hc_admin_upsert_tier(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_benefits jsonb,
    p_referral_eligible boolean, p_assignments_enabled boolean, p_sort_order integer, p_active boolean)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_old public.hc_tiers; b jsonb; v_res jsonb;
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
  if coalesce(p_referral_eligible, false) is distinct from coalesce(v_old.referral_eligible, false)
     and not public.staff_has_permission('hc.payout') then
    raise exception 'owner_required' using errcode = 'P0001';
  end if;
  v_res := public.hc_tier_write(p_slug, trim(p_label), nullif(trim(coalesce(p_description,'')),''), nullif(trim(coalesce(p_eligibility_notes,'')),''),
             p_sort_order, coalesce(p_active,true), coalesce(p_referral_eligible,false), p_benefits, coalesce(p_assignments_enabled,true),
             'tier saved via admin_upsert_tier');
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.tier_upsert', 'hc_tier', p_slug, jsonb_build_object('created', v_old.slug is null));
  return v_res;
end $f$;

-- A2 contract preserved (approved members only, error codes unchanged); the assignment itself goes through A3's hc_admin_assign_tier.
create or replace function public.hc_admin_set_member_tier(p_partner_id uuid, p_tier text)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_p public.partners;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into v_p from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found' using errcode = 'P0001'; end if;
  if v_p.status <> 'approved' then raise exception 'partner_not_approved' using errcode = 'P0001'; end if;
  if p_tier is not null and not exists (select 1 from public.hc_tiers where slug = p_tier and active) then raise exception 'tier_not_configured' using errcode = 'P0001'; end if;
  perform public.hc_admin_assign_tier(p_partner_id, p_tier, 'member tier set via set_member_tier');
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.member_tier', 'partner', p_partner_id::text, jsonb_build_object('from', v_p.tier, 'to', p_tier));
  return jsonb_build_object('status', 'saved', 'tier', p_tier);
end $f$;

-- ---------- A2 outbox: no staff_email fan-out while A3's verified founder email channel is enabled ----------
create or replace function public.hc_emit_event(p_kind text, p_ref_type text, p_ref_id text, p_severity text, p_dedup text, p_applicant boolean default false)
 returns bigint language plpgsql security definer set search_path to '' as $f$
declare v_id bigint; d record; v_cc_on boolean;
begin
  insert into public.hc_events (kind, ref_type, ref_id, severity, dedup_key) values (p_kind, p_ref_type, p_ref_id, p_severity, p_dedup)
  on conflict (dedup_key) do nothing returning id into v_id;
  if v_id is null then return null; end if;                         -- duplicate emission: nothing new
  insert into public.hc_event_deliveries (event_id, channel, status) values (v_id, 'inbox', 'delivered');   -- the inbox IS the event row, readable by permitted staff
  if p_applicant then insert into public.hc_event_deliveries (event_id, channel) values (v_id, 'applicant_email'); end if;
  select coalesce(email_enabled, false) into v_cc_on from public.cc_notification_settings where singleton;
  if not coalesce(v_cc_on, false) then
    for d in select id from public.hc_notification_destinations where active and verified_at is not null and channel = 'staff_email' loop
      insert into public.hc_event_deliveries (event_id, channel, destination_id) values (v_id, 'staff_email', d.id);
    end loop;
  end if;
  return v_id;
end $f$;
