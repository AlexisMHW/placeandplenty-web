-- Rollback of 217330 (agent S): restores the 217110 bodies of hc_tier_write and hc_admin_upsert_tier exactly. hc_upsert_tier is dropped and re-created WITHOUT the parameter
-- defaults (CREATE OR REPLACE cannot remove defaults) and its grants (authenticated, service_role) are restored. No data is touched.
CREATE OR REPLACE FUNCTION public.hc_tier_write(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_sort_order integer, p_active boolean, p_paid_referrals_eligible boolean, p_benefits jsonb, p_assignments_enabled boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.hc_admin_upsert_tier(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_benefits jsonb, p_referral_eligible boolean, p_assignments_enabled boolean, p_sort_order integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

drop function if exists public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text);
CREATE OR REPLACE FUNCTION public.hc_upsert_tier(p_slug text, p_label text, p_description text, p_eligibility_notes text, p_sort_order integer, p_active boolean, p_paid_referrals_eligible boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return public.hc_tier_write(p_slug, p_label, p_description, p_eligibility_notes, p_sort_order, p_active, p_paid_referrals_eligible, null, null, p_reason);
end;
$function$;

revoke all on function public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text) from public, anon;
grant execute on function public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text) to authenticated, service_role;
