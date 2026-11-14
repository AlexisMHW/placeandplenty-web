-- 217101 (A3's cc_sql/217001, RENUMBERED by A1b): TIER BENEFITS, MEMBER TIER ASSIGNMENT, SUSPENSION, TERMS HISTORY (read) - founder decision D4.
--   Tier create/edit, the paid-referrals switch and tier paid-eligibility are AGENT 7's 216100 (hc_upsert_tier, hc_activate_paid_referrals ...).
--   Their audit trail is the append-only hc_config_audit (triggers on hc_tiers, hc_terms_*, hc_settings, partners tier/status) read via hc_admin_config_audit.
--   This file adds what 216100 does not have: tier benefits text, assigning a member to a tier, suspending/reinstating a member, a tier list, and terms history.
--   No rate, benefit or tier is invented: everything is entered by staff. Nothing here turns on paid referrals or changes any commission.
-- Depends on: 215003 (A2: benefits column, hc_tier_audit) and 216100 (A7). A1b: hc_admin_list_tiers returns the UNION of A2's and A3's keys (both UIs call it).
-- Tier WRITERS are consolidated by 217110 (A1b). Rollback: rollback/ROLLBACK_217101.sql

do $$ begin
  if to_regclass('public.hc_config_audit') is null or to_regclass('public.hc_tier_audit') is null or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hc_tiers' and column_name='paid_referrals_eligible') then
    raise exception 'dependency_missing: apply 216100 first';
  end if;
end $$;

alter table public.hc_tiers add column if not exists benefits jsonb not null default '[]'::jsonb
  check (jsonb_typeof(benefits) = 'array' and jsonb_array_length(benefits) <= 12);

create or replace function public.hc_admin_list_tiers()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', t.slug, 'label', t.label, 'description', t.description,
      'eligibility_notes', t.eligibility_notes, 'sort_order', t.sort_order, 'active', t.active, 'benefits', t.benefits,
      'paid_referrals_eligible', t.paid_referrals_eligible,
      'referral_eligible', t.referral_eligible, 'assignments_enabled', t.assignments_enabled,   -- A2's keys (A2's UI reads them)
      'members', (select count(*) from public.partners p where p.tier = t.slug),                -- A2 semantics: every partner on the tier
      'member_count', (select count(*) from public.partners p where p.tier = t.slug and p.status in ('approved','suspended')))
      order by t.sort_order, t.slug) from public.hc_tiers t), '[]'::jsonb);
end $function$;

create or replace function public.hc_admin_set_tier_benefits(p_slug text, p_benefits jsonb, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_benefits is null or jsonb_typeof(p_benefits) <> 'array' or jsonb_array_length(p_benefits) > 12
     or exists (select 1 from jsonb_array_elements(p_benefits) b where jsonb_typeof(b) <> 'string' or char_length(b #>> '{}') > 120) then
    raise exception 'invalid_benefits' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 200 then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  perform set_config('hc.audit_reason', left(btrim(p_reason), 200), true);
  update public.hc_tiers set benefits = p_benefits where slug = p_slug;
  if not found then raise exception 'tier_not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('status', 'updated');
end $function$;

-- Assign a member to a tier (null = basic member). The tier must exist and be active. The change is recorded by the hc_config_audit trigger with this reason.
create or replace function public.hc_admin_assign_tier(p_partner_id uuid, p_tier text, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare cur public.partners;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 200 then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  select * into cur from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found' using errcode = 'P0001'; end if;
  if cur.status not in ('approved','suspended') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  if p_tier is not null and not exists (select 1 from public.hc_tiers where slug = p_tier and active) then raise exception 'tier_not_found' using errcode = 'P0001'; end if;
  if cur.tier is not distinct from p_tier then return jsonb_build_object('status', 'unchanged'); end if;
  perform set_config('hc.audit_reason', left(btrim(p_reason), 200), true);
  update public.partners set tier = p_tier where id = p_partner_id;
  return jsonb_build_object('status', 'assigned');
end $function$;

-- Suspend / reinstate an approved member. Earned commissions and payouts keep their own states; suspension never edits money rows.
create or replace function public.hc_admin_set_partner_status(p_partner_id uuid, p_status text, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare cur text;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_status not in ('approved','suspended') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 200 then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  select status into cur from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found' using errcode = 'P0001'; end if;
  if cur not in ('approved','suspended') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  if cur = p_status then return jsonb_build_object('status', 'unchanged'); end if;
  perform set_config('hc.audit_reason', left(btrim(p_reason), 200), true);
  update public.partners set status = p_status where id = p_partner_id;
  return jsonb_build_object('status', p_status);
end $function$;

create or replace function public.hc_admin_terms_history()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'effective_from', v.effective_from, 'validation_days', v.validation_days,
      'min_payout_cents', v.min_payout_cents, 'note', v.note, 'created_at', v.created_at, 'in_force', v.version = (
        select v2.version from public.hc_terms_versions v2 where v2.effective_from <= now() order by v2.effective_from desc, v2.version desc limit 1),
      'amounts', coalesce((select jsonb_object_agg(a.canonical_product_id, a.amount_cents) from public.hc_terms_amounts a where a.version = v.version), '{}'::jsonb))
      order by v.version desc) from public.hc_terms_versions v), '[]'::jsonb);
end $function$;

revoke execute on function public.hc_admin_list_tiers(), public.hc_admin_set_tier_benefits(text, jsonb, text), public.hc_admin_assign_tier(uuid, text, text),
  public.hc_admin_set_partner_status(uuid, text, text), public.hc_admin_terms_history() from public, anon;
grant execute on function public.hc_admin_list_tiers(), public.hc_admin_set_tier_benefits(text, jsonb, text), public.hc_admin_assign_tier(uuid, text, text),
  public.hc_admin_set_partner_status(uuid, text, text), public.hc_admin_terms_history() to authenticated, service_role;
