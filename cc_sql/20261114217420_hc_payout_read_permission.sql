-- 20261114217420_hc_payout_read_permission.sql   (agent S2, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- FOUNDER DECISION D-2 (final): payout history is visible READ-ONLY to the owner and to staff holding an explicit financial permission (the EXISTING hc.payout permission).
-- A staff member who only has hc.read (e.g. business_admin, creator_program_manager) must NOT see the payout ledger. Five read functions change, nothing else:
--   hc_admin_list_payouts(integer), hc_admin_payout_history(uuid,integer), hc_admin_payout_ledger(), hc_admin_payout_eligibility(): permission hc.read -> hc.payout (not_authorized otherwise).
--   hc_admin_commission_report(): stays hc.read (partner / conversion counts) but WITHOUT payout-side money for staff lacking hc.payout: the per-partner by_state omits the
--       'payable' and 'paid' buckets and the keys outstanding_clawback_cents / clawback_pending_contract_language are omitted (present only with hc.payout).
-- No write path is touched here (217430 owns that). No role/permission rows are added or changed. Grants are preserved (CREATE OR REPLACE).
-- Idempotent. Rollback: ROLLBACK_217420.sql restores the five pre-state bodies exactly.
do $$ begin
  if to_regprocedure('public.hc_admin_payout_ledger()') is null or to_regprocedure('public.hc_admin_commission_report()') is null or to_regprocedure('public.hc_admin_list_payouts(integer)') is null
     or to_regprocedure('public.hc_admin_payout_history(uuid,integer)') is null or to_regprocedure('public.hc_admin_payout_eligibility()') is null then
    raise exception 'dependency_missing: 216100 / 214003_r1 read functions';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.hc_admin_list_payouts(p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;   -- 217420 (D-2): payout lists / history / ledger need the explicit financial permission (hc.payout), read-only
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select po.id, po.partner_id, p.display_name, po.total_cents, po.status, po.created_at, po.approved_at, po.paid_at, po.paid_on,
           po.external_ref, po.external_method, po.void_reason, po.reversed_reason, po.reversed_at
      from public.payouts po join public.partners p on p.id = po.partner_id
     order by po.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) x), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_admin_payout_history(p_partner_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;   -- 217420 (D-2): payout lists / history / ledger need the explicit financial permission (hc.payout), read-only
  return coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
    select jsonb_build_object('payout_id', p.id, 'partner_id', p.partner_id, 'status', p.status, 'total_cents', p.total_cents,
        'created_at', p.created_at, 'approved_at', p.approved_at, 'paid_on', p.paid_on, 'external_ref', p.external_ref,
        'external_method', p.external_method, 'void_reason', p.void_reason, 'reversed_reason', p.reversed_reason,
        'commissions', (select count(*) from public.commissions c where c.payout_id = p.id),
        'events', coalesce((select jsonb_agg(jsonb_build_object('at', e.at, 'event', e.event, 'actor', e.actor, 'detail', e.detail) order by e.id)
                              from public.payout_events e where e.payout_id = p.id), '[]'::jsonb)) x
      from public.payouts p where p_partner_id is null or p.partner_id = p_partner_id
      order by p.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) s), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_admin_payout_ledger()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tot jsonb;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;   -- 217420 (D-2): payout lists / history / ledger need the explicit financial permission (hc.payout), read-only
  select jsonb_build_object(
      'pending_cents',   coalesce(sum(c.commission_cents) filter (where c.state = 'pending'), 0),
      'validated_cents', coalesce(sum(c.commission_cents) filter (where c.state = 'validated'), 0),
      'draft_cents',     coalesce(sum(c.commission_cents) filter (where c.state = 'payable' and po.status = 'draft'), 0),
      'approved_cents',  coalesce(sum(c.commission_cents) filter (where c.state = 'payable' and po.status = 'approved'), 0),
      'paid_cents',      coalesce(sum(c.commission_cents) filter (where c.state = 'paid'), 0),
      'unrated_count',   count(*) filter (where c.commission_cents is null),
      'held_count',      count(*) filter (where c.state = 'held'),
      'outstanding_clawback_cents', coalesce(sum(c.clawback_cents) filter (where c.clawback_cents > 0 and c.clawback_payout_id is null), 0))
    into v_tot
    from public.commissions c left join public.payouts po on po.id = c.payout_id;
  return jsonb_build_object('totals', v_tot,
    'partners', coalesce((select jsonb_agg(x order by x->>'display_name') from (
      select jsonb_build_object('partner_id', p.id, 'display_name', p.display_name, 'status', p.status,
        'pending_cents',   coalesce(sum(c.commission_cents) filter (where c.state = 'pending'), 0),
        'validated_cents', coalesce(sum(c.commission_cents) filter (where c.state = 'validated'), 0),
        'draft_cents',     coalesce(sum(c.commission_cents) filter (where c.state = 'payable' and po.status = 'draft'), 0),
        'approved_cents',  coalesce(sum(c.commission_cents) filter (where c.state = 'payable' and po.status = 'approved'), 0),
        'paid_cents',      coalesce(sum(c.commission_cents) filter (where c.state = 'paid'), 0),
        'outstanding_clawback_cents', coalesce(sum(c.clawback_cents) filter (where c.clawback_cents > 0 and c.clawback_payout_id is null), 0)) x
      from public.partners p left join public.commissions c on c.partner_id = p.id left join public.payouts po on po.id = c.payout_id
      group by p.id, p.display_name, p.status) s), '[]'::jsonb),
    'note', 'Approved is not paid. Paid means an external payment was recorded with its reference. Nothing here moves money.');
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_admin_payout_eligibility()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_set public.hc_settings; v_terms public.hc_terms_versions; v_amounts boolean; v_min integer;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;   -- 217420 (D-2): payout lists / history / ledger need the explicit financial permission (hc.payout), read-only
  select * into v_set from public.hc_settings where singleton;
  select * into v_terms from public.hc_terms_versions v where v.effective_from <= now() order by v.effective_from desc, v.version desc limit 1;
  v_amounts := v_terms.version is not null and exists (select 1 from public.hc_terms_amounts a where a.version = v_terms.version);
  v_min := coalesce(v_terms.min_payout_cents, v_set.min_payout_cents, 5000);
  return jsonb_build_object(
    'program_enabled', coalesce(v_set.enabled, false),
    'rate_configured', v_amounts,
    'terms_version', v_terms.version,
    'min_payout_cents', v_min,
    'paid_referrals_enabled', coalesce(v_set.paid_referrals_enabled, false),
    'live', coalesce(v_set.enabled, false) and coalesce(v_set.paid_referrals_enabled, false) and v_amounts,
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
        'partner_id', p.id, 'display_name', p.display_name, 'status', p.status,
        'pending_cents', coalesce((select sum(commission_cents) from public.commissions c where c.partner_id = p.id and c.state = 'pending'), 0),
        'validated_cents', coalesce((select sum(commission_cents) from public.commissions c where c.partner_id = p.id and c.state = 'validated'), 0),
        'held_count', (select count(*) from public.commissions c where c.partner_id = p.id and c.state = 'held'),
        'outstanding_clawback_cents', coalesce((select sum(clawback_cents) from public.commissions c where c.partner_id = p.id and c.clawback_payout_id is null and clawback_settled_at is null), 0),
        'eligible', (coalesce((select sum(commission_cents) from public.commissions c where c.partner_id = p.id and c.state = 'validated'), 0)
                    - case when v_set.clawback_netting_enabled then coalesce((select sum(clawback_cents) from public.commissions c where c.partner_id = p.id and c.clawback_payout_id is null and clawback_settled_at is null), 0) else 0 end)
                    >= v_min
                    and coalesce(v_set.enabled, false) and coalesce(v_set.paid_referrals_enabled, false) and v_amounts) order by p.created_at)
      from public.partners p where p.status = 'approved'), '[]'::jsonb));
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_admin_commission_report()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_fin boolean;
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  v_fin := public.staff_has_permission('hc.payout');   -- 217420 (D-2): payout / clawback figures only for the owner or explicit financial permission
  return jsonb_build_object(
    'terms_configured', exists (select 1 from public.hc_terms_versions),
    'enabled', (select enabled from public.hc_settings where singleton),
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
        'partner_id', p.id, 'display_name', p.display_name, 'status', p.status, 'tier', p.tier,
        'signups', (select count(*) from public.referral_claims rc where rc.partner_id = p.id),
        'by_state', coalesce((select jsonb_object_agg(s.state, jsonb_build_object('n', s.n, 'cents', s.amt)) from
            (select state, count(*) n, coalesce(sum(commission_cents),0) amt from public.commissions where partner_id = p.id
              and (v_fin or state not in ('payable','paid')) group by state) s), '{}'::jsonb)
      ) || case when v_fin then jsonb_build_object(
        'outstanding_clawback_cents', (select coalesce(sum(clawback_cents),0) from public.commissions where partner_id = p.id and clawback_payout_id is null),
        'clawback_pending_contract_language', (select count(*) from public.commissions where partner_id = p.id and clawback_status = 'pending_contract_language'))
        else '{}'::jsonb end
      order by p.created_at) from public.partners p), '[]'::jsonb),
    'held_count', (select count(*) from public.commissions where state = 'held'));
end;
$function$;
