-- Rollback of 217491: restores the 217300-state body of hc_create_payout_draft (hc.payout only). Grants untouched.
CREATE OR REPLACE FUNCTION public.hc_create_payout_draft(p_partner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_set public.hc_settings; v_gross bigint; v_claw bigint; v_net bigint; v_min integer; v_payout uuid; v_by jsonb;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into v_set from public.hc_settings where singleton;
  if not coalesce(v_set.paid_referrals_enabled, false) then return jsonb_build_object('status','paid_referrals_not_active'); end if;
  perform 1 from public.partners where id = p_partner_id for update;
  if not found then raise exception 'partner_not_found' using errcode = 'P0001'; end if;
  if (select status from public.partners where id = p_partner_id) <> 'approved' then
    return jsonb_build_object('status','partner_not_approved');
  end if;
  -- 217300 (E-C1): apply refund / revoke / dispute reversals INSIDE this transaction before anything is selected, so a refunded or
  -- disputed commission can never be drafted even if the scheduled sweep has not run yet. The filters below repeat the rule (defence in depth).
  perform public.hc_sweep_commissions_core(now());
  select coalesce(sum(commission_cents),0), min(terms_min_payout_cents) into v_gross, v_min from public.commissions
   where partner_id = p_partner_id and state = 'validated' and commission_cents is not null
   and not public.hc_commission_blocked(entitlement_id);
  select coalesce(jsonb_object_agg(canonical_product_id, amt), '{}'::jsonb) into v_by
    from (select canonical_product_id, sum(commission_cents) amt from public.commissions
           where partner_id = p_partner_id and state = 'validated' and commission_cents is not null
   and not public.hc_commission_blocked(entitlement_id) group by canonical_product_id) x;
  v_min := coalesce(v_min, 5000);
  select coalesce(sum(clawback_cents),0) into v_claw from public.commissions
   where partner_id = p_partner_id and clawback_cents > 0 and clawback_payout_id is null and clawback_settled_at is null;
  v_net := case when v_set.clawback_netting_enabled then v_gross - v_claw else v_gross end;
  if v_net < v_min or v_net <= 0 then
    return jsonb_build_object('status','below_minimum','eligible_cents',v_net,'min_cents',v_min,'by_product',v_by,
                              'outstanding_clawback_cents',v_claw,'clawback_netted',v_set.clawback_netting_enabled);
  end if;
  insert into public.payouts (partner_id, total_cents, created_by) values (p_partner_id, v_net, auth.uid()) returning id into v_payout;
  update public.commissions set state = 'payable', payout_id = v_payout, state_changed_at = now()
   where partner_id = p_partner_id and state = 'validated' and commission_cents is not null
   and not public.hc_commission_blocked(entitlement_id);
  if v_set.clawback_netting_enabled then
    update public.commissions set clawback_payout_id = v_payout where partner_id = p_partner_id and clawback_cents > 0 and clawback_payout_id is null and clawback_settled_at is null;
  end if;
  insert into public.commission_events (commission_id, from_state, to_state, reason, actor)
    select id, 'validated', 'payable', 'payout_draft', 'staff:' || auth.uid()::text from public.commissions where payout_id = v_payout;
  insert into public.payout_events (payout_id, actor, event, detail) values (v_payout, auth.uid(), 'drafted', jsonb_build_object('net_cents', v_net, 'by_product', v_by));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_draft', 'payout', v_payout::text, jsonb_build_object('net_cents', v_net, 'by_product', v_by));
  return jsonb_build_object('status','draft','payout_id',v_payout,'net_cents',v_net,'by_product',v_by,
                            'outstanding_clawback_cents',v_claw,'clawback_netted',v_set.clawback_netting_enabled);
end;
$function$;
