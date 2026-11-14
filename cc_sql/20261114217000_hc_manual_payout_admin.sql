-- 217000: PAYOUT LEDGER + PAYOUT LIST (read-only views for the manual-payout screen; founder decision D3).
--   The write side of manual payouts (approve, record external payment with reference+date+confirmation, void, reverse, clawback settlement,
--   paid-referrals switch) is AGENT 7's migration 216100 (supabase/proposed_a7/20261114216100_hc_manual_payouts_and_terms_governance.sql).
--   This file only ADDS read functions on top of it, so there is ONE source of truth for payout state transitions. Nothing here moves money or writes data.
--   pending / validated / in draft / approved / paid are reported as separate numbers and never summed.
-- Depends on: 216100 (payouts.paid_on, external_method, reversed_*). Rollback: rollback/ROLLBACK_217000.sql

do $$ begin
  if to_regclass('public.payout_events') is null or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payouts' and column_name='paid_on') then
    raise exception 'dependency_missing: apply 216100 first';
  end if;
end $$;

create or replace function public.hc_admin_payout_ledger()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_tot jsonb;
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
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

-- Same signature as 215000; adds the fields 216100 introduced so the page can show when/how an external payment was recorded.
create or replace function public.hc_admin_list_payouts(p_limit integer default 50)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select po.id, po.partner_id, p.display_name, po.total_cents, po.status, po.created_at, po.approved_at, po.paid_at, po.paid_on,
           po.external_ref, po.external_method, po.void_reason, po.reversed_reason, po.reversed_at
      from public.payouts po join public.partners p on p.id = po.partner_id
     order by po.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) x), '[]'::jsonb);
end;
$function$;

revoke execute on function public.hc_admin_payout_ledger(), public.hc_admin_list_payouts(integer) from public, anon;
grant execute on function public.hc_admin_payout_ledger(), public.hc_admin_list_payouts(integer) to authenticated, service_role;
