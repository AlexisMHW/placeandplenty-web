-- Rollback of 217000: drops the ledger function and restores the original hc_admin_list_payouts from 215000. No data is touched.
drop function if exists public.hc_admin_payout_ledger();
create or replace function public.hc_admin_list_payouts(p_limit integer default 50)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('hc.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select po.id, po.partner_id, p.display_name, po.total_cents, po.status, po.created_at, po.approved_at, po.paid_at, po.external_ref, po.void_reason
      from public.payouts po join public.partners p on p.id = po.partner_id
     order by po.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) x), '[]'::jsonb);
end;
$function$;
