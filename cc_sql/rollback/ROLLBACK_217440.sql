-- Rollback of 217440 (agent S2): restores the 217340-state bodies of record_purchase_dispute and record_purchase_partial_refund exactly, then drops the helper. Grants untouched.
CREATE OR REPLACE FUNCTION public.record_purchase_dispute(p_provider_transaction_id text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.hc_require_service();
  if p_status not in ('none','open','won','lost') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.commission_purchase_facts set dispute_status = p_status, updated_at = now() where provider_transaction_id = p_provider_transaction_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_purchase_partial_refund(p_provider_transaction_id text, p_refunded_cents integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.commission_purchase_facts; c public.commissions;
begin
  perform public.hc_require_service();
  if p_refunded_cents is null or p_refunded_cents <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  select * into f from public.commission_purchase_facts where provider_transaction_id = p_provider_transaction_id for update;
  if not found then return jsonb_build_object('status','no_facts'); end if;
  update public.commission_purchase_facts
     set refunded_cents = greatest(coalesce(refunded_cents,0), p_refunded_cents), partial_refund_flagged_at = coalesce(partial_refund_flagged_at, now()), updated_at = now()
   where entitlement_id = f.entitlement_id;
  select * into c from public.commissions where entitlement_id = f.entitlement_id for update;
  if not found then return jsonb_build_object('status','recorded_no_commission'); end if;
  if c.state in ('pending','validated') then
    update public.commissions set state = 'held', reason = 'partial_refund_review', state_changed_at = now() where id = c.id;
    perform public.hc_log_event(c.id, c.state, 'held', 'partial_refund_review', 'system');
    return jsonb_build_object('status','held_for_review');
  end if;
  perform public.hc_log_event(c.id, c.state, c.state, 'partial_refund_review_flag', 'system');
  return jsonb_build_object('status','flagged','state',c.state);
end;
$function$;

drop function if exists public.resolve_purchase_fact_entitlements(text);
