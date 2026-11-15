-- Rollback of 217110 (A1b): restores the A2 (215003) and A7 (216100) function bodies exactly as in their files, then drops the internal writer. No data is touched.

create or replace function public.hc_upsert_tier(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_sort_order integer,
                                                 p_active boolean, p_paid_referrals_eligible boolean, p_reason text)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_old public.hc_tiers; v_elig boolean;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9_]{2,32}$' then raise exception 'invalid_slug' using errcode = 'P0001'; end if;
  if p_label is null or char_length(btrim(p_label)) not between 2 and 60 then raise exception 'invalid_label' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into v_old from public.hc_tiers where slug = p_slug for update;
  v_elig := coalesce(p_paid_referrals_eligible, false);
  if (not found and v_elig) or (found and v_elig is distinct from v_old.paid_referrals_eligible) then
    if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized_referral_eligibility' using errcode = 'P0001'; end if;
  end if;
  perform set_config('hc.audit_reason', left(p_reason, 200), true);
  insert into public.hc_tiers (slug, label, description, eligibility_notes, sort_order, active, paid_referrals_eligible)
  values (p_slug, btrim(p_label), p_description, p_eligibility_notes, coalesce(p_sort_order, 100), coalesce(p_active, true), v_elig)
  on conflict (slug) do update set label = excluded.label, description = excluded.description, eligibility_notes = excluded.eligibility_notes,
        sort_order = excluded.sort_order, active = excluded.active, paid_referrals_eligible = excluded.paid_referrals_eligible;
  return jsonb_build_object('status', case when v_old.slug is null then 'created' else 'updated' end, 'slug', p_slug);
end;
$function$;

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

drop function if exists public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text);
