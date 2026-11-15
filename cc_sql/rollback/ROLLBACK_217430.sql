-- Rollback of 217430 (agent S2): restores the 217340-state bodies of the five payout write functions exactly, then drops hc_is_owner(). Grants untouched.
CREATE OR REPLACE FUNCTION public.hc_approve_payout(p_payout_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_p public.payouts; v_on boolean;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select paid_referrals_enabled into v_on from public.hc_settings where singleton;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found' using errcode = 'P0001'; end if;
  if v_p.status = 'approved' then return jsonb_build_object('status','already_approved'); end if;
  if v_p.status <> 'draft' then raise exception 'payout_not_draft' using errcode = 'P0001'; end if;
  if not coalesce(v_on, false) then return jsonb_build_object('status','paid_referrals_not_active'); end if;
  -- 217300 (E-C1): a refund / revoke / open or lost dispute that landed after the draft was built must stop the approval. Nothing is changed here
  -- (the error rolls back); the scheduled sweep (or the owner) voids the batch and the remaining commissions return to validated.
  if public.hc_payout_has_blocked_commission(p_payout_id) then raise exception 'payout_contains_reversed_commission' using errcode = 'P0001'; end if;
  update public.payouts set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_payout_id;
  insert into public.payout_events (payout_id, actor, event, detail) values (p_payout_id, auth.uid(), 'approved', jsonb_build_object('total_cents', v_p.total_cents));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_approved', 'payout', p_payout_id::text, jsonb_build_object('note','approval is not payment'));
  return jsonb_build_object('status','approved','paid',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_record_external_payment(p_payout_id uuid, p_external_ref text, p_paid_on date, p_method text, p_confirm_external_payment boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_p public.payouts; v_ref text := btrim(coalesce(p_external_ref, '')); v_m text := btrim(regexp_replace(coalesce(p_method, ''), '\s+', ' ', 'g'));
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found' using errcode = 'P0001'; end if;
  if v_p.status = 'paid' then
    if lower(btrim(coalesce(v_p.external_ref, ''))) = lower(v_ref) then return jsonb_build_object('status','already_recorded'); end if;
    raise exception 'payout_already_paid_with_different_reference' using errcode = 'P0001';
  end if;
  if v_p.status <> 'approved' then raise exception 'payout_not_approved' using errcode = 'P0001'; end if;
  if p_confirm_external_payment is distinct from true then raise exception 'confirmation_required' using errcode = 'P0001'; end if;
  if char_length(v_m) not between 2 and 60 or v_m !~ '[[:alnum:]]' or v_m ~ '[[:cntrl:]]'
     or lower(v_m) in ('unknown', 'n/a', 'na', 'none', 'null', 'undefined', 'tbd', '?') then
    raise exception 'invalid_method' using errcode = 'P0001';
  end if;
  if char_length(v_ref) < 4 or char_length(v_ref) > 120 then raise exception 'external_reference_required' using errcode = 'P0001'; end if;
  if p_paid_on is null or p_paid_on > current_date then raise exception 'invalid_paid_on' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payouts x where x.status = 'paid' and lower(btrim(x.external_ref)) = lower(v_ref)) then
    raise exception 'external_reference_already_used' using errcode = 'P0001';
  end if;
  -- 217300 (E-C1): never record a payment for a batch that now contains a refunded / revoked / disputed commission.
  if public.hc_payout_has_blocked_commission(p_payout_id) then raise exception 'payout_contains_reversed_commission' using errcode = 'P0001'; end if;
  update public.payouts set status = 'paid', paid_at = now(), paid_on = p_paid_on, external_ref = v_ref, external_method = v_m,
         confirmed_by = auth.uid(), confirmed_at = now() where id = p_payout_id;
  update public.commissions set state = 'paid', paid_at = now(), state_changed_at = now() where payout_id = p_payout_id and state = 'payable';
  insert into public.commission_events (commission_id, from_state, to_state, reason, actor)
    select id, 'payable', 'paid', 'external_payment_recorded', 'staff:' || auth.uid()::text from public.commissions where payout_id = p_payout_id and state = 'paid';
  insert into public.payout_events (payout_id, actor, event, detail)
  values (p_payout_id, auth.uid(), 'payment_recorded', jsonb_build_object('external_ref', v_ref, 'paid_on', p_paid_on, 'method', v_m, 'total_cents', v_p.total_cents));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_payment_recorded', 'payout', p_payout_id::text, jsonb_build_object('paid_on', p_paid_on, 'moved_money_here', false));
  return jsonb_build_object('status','paid_recorded','paid_on',p_paid_on);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_void_payout(p_payout_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_p public.payouts;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found' using errcode = 'P0001'; end if;
  if v_p.status = 'void' then return jsonb_build_object('status','already_void'); end if;
  if v_p.status not in ('draft','approved') then raise exception 'payout_not_voidable' using errcode = 'P0001'; end if;
  update public.payouts set status = 'void', void_reason = left(p_reason, 200), voided_at = now(), voided_by = auth.uid() where id = p_payout_id;
  update public.commissions set state = 'validated', payout_id = null, state_changed_at = now() where payout_id = p_payout_id and state = 'payable';
  update public.commissions set clawback_payout_id = null where clawback_payout_id = p_payout_id;
  insert into public.payout_events (payout_id, actor, event, detail) values (p_payout_id, auth.uid(), 'voided', jsonb_build_object('reason', left(p_reason, 200)));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_void', 'payout', p_payout_id::text, jsonb_build_object('reason', left(p_reason, 200)));
  return jsonb_build_object('status','void');
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_reverse_recorded_payment(p_payout_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_p public.payouts;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found' using errcode = 'P0001'; end if;
  if v_p.status = 'reversed' then return jsonb_build_object('status','already_reversed'); end if;
  if v_p.status <> 'paid' then raise exception 'payout_not_paid' using errcode = 'P0001'; end if;
  update public.payouts set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversed_reason = left(p_reason, 200) where id = p_payout_id;
  insert into public.commission_events (commission_id, from_state, to_state, reason, actor)
    select id, 'paid', 'validated', 'recorded_payment_reversed', 'staff:' || auth.uid()::text from public.commissions where payout_id = p_payout_id and state = 'paid';
  update public.commissions set state = 'validated', paid_at = null, payout_id = null, state_changed_at = now() where payout_id = p_payout_id and state = 'paid';
  insert into public.payout_events (payout_id, actor, event, detail) values (p_payout_id, auth.uid(), 'payment_reversed', jsonb_build_object('reason', left(p_reason, 200)));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_payment_reversed', 'payout', p_payout_id::text, jsonb_build_object('reason', left(p_reason, 200)));
  return jsonb_build_object('status','reversed');
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_settle_clawback(p_commission_id uuid, p_resolution text, p_external_ref text, p_note text, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_c public.commissions;
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_resolution not in ('recovered_externally','waived') then raise exception 'invalid_resolution' using errcode = 'P0001'; end if;
  select * into v_c from public.commissions where id = p_commission_id for update;
  if not found or v_c.clawback_cents <= 0 then raise exception 'no_clawback' using errcode = 'P0001'; end if;
  if v_c.clawback_settled_at is not null then
    if v_c.clawback_resolution = p_resolution then return jsonb_build_object('status','already_settled'); end if;
    raise exception 'clawback_already_settled_differently' using errcode = 'P0001';
  end if;
  if v_c.clawback_payout_id is not null then raise exception 'clawback_already_netted' using errcode = 'P0001'; end if;
  if p_confirm is distinct from true then raise exception 'confirmation_required' using errcode = 'P0001'; end if;
  if p_resolution = 'recovered_externally' and char_length(btrim(coalesce(p_external_ref,''))) < 4 then raise exception 'external_reference_required' using errcode = 'P0001'; end if;
  if p_note is null or char_length(btrim(p_note)) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  update public.commissions set clawback_settled_at = now(), clawback_resolution = p_resolution, clawback_ref = nullif(btrim(p_external_ref),''),
         clawback_note = left(p_note, 300), clawback_status = 'settled_' || p_resolution where id = p_commission_id;
  perform public.hc_log_event(p_commission_id, v_c.state, v_c.state, 'clawback_settled_' || p_resolution, 'staff:' || auth.uid()::text);
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.clawback_settled', 'commission', p_commission_id::text, jsonb_build_object('resolution', p_resolution, 'cents', v_c.clawback_cents));
  return jsonb_build_object('status','settled','resolution',p_resolution,'cents',v_c.clawback_cents);
end;
$function$;

drop function if exists public.hc_is_owner();
