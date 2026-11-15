-- Rollback of 217490 (agent J follow-up): restores the 217470-state bodies of hc_sweep_commissions_core, record_purchase_partial_refund and hc_commission_blocked exactly,
-- then drops the new functions and the resolution history table. A held commission that was RELEASED stays pending (a normal state); a REVERSED one stays reversed (terminal).
-- The history table is audit data: the drop is REFUSED when it holds rows unless the session sets app.hc_followup_rollback_discard_history = 'yes'.
-- (Roll back 217491 first if both are applied: they are independent, order does not matter for correctness.)
do $$
declare v_has boolean := false;
begin
  if to_regclass('public.hc_partial_refund_resolutions') is not null then
    execute 'select exists (select 1 from public.hc_partial_refund_resolutions)' into v_has;
  end if;
  if v_has and coalesce(current_setting('app.hc_followup_rollback_discard_history', true), '') <> 'yes' then
    raise exception 'rollback_refused: hc_partial_refund_resolutions holds audit rows; set app.hc_followup_rollback_discard_history = yes to discard them deliberately';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.hc_sweep_commissions_core(p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record; v_set public.hc_settings; v_rev int := 0; v_val int := 0; v_held int := 0; v_rel int := 0;
begin
  select * into v_set from public.hc_settings where singleton;
  if not v_set.enabled then return jsonb_build_object('status','disabled'); end if;

  -- 1. reversals: refunded, revoked for a reason other than ordinary cancellation or an OPEN dispute (217470), or dispute lost
  for r in
    select c.id, c.state, c.commission_cents, c.payout_id, c.partner_id
      from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where c.state in ('pending','held','validated','payable','paid')
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') not in ('subscription_deleted','dispute_open'))   -- 217470: 'dispute_open' is a HOLD (steps 1b/2), not a reversal
            or f.dispute_status = 'lost')
     for update of c
  loop
    update public.commissions
       set state = 'reversed', state_changed_at = p_now, reason = 'refund_or_dispute',
           clawback_cents = case when r.state = 'paid' then coalesce(r.commission_cents,0) else 0 end,
           clawback_status = case when r.state = 'paid' then 'pending_contract_language' else null end
     where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'reversed', 'refund_or_dispute', 'system');
    if r.state = 'payable' and r.payout_id is not null then
      update public.payouts set status = 'void', void_reason = 'contains_reversed_commission' where id = r.payout_id and status in ('draft','approved');
      update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now
       where payout_id = r.payout_id and state = 'payable' and id <> r.id;
      update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
    end if;
    v_rev := v_rev + 1;
  end loop;

  -- 1b. (214003_r1) dispute opened on a commission already inside a draft/approved payout: void that batch so nothing is paid
  --     while the dispute is open; the owner rebuilds the draft later. Commissions already PAID are handled by the clawback model.
  for r in
    select c.id, c.payout_id from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where (f.dispute_status = 'open' or (e.revoked_at is not null and e.revoked_reason = 'dispute_open')) and c.state = 'payable' for update of c
  loop
    update public.payouts set status = 'void', void_reason = 'contains_disputed_commission' where id = r.payout_id and status in ('draft','approved');
    update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now where payout_id = r.payout_id and state = 'payable';
    update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
  end loop;

  -- 1c. (217470, DEF-2) partial refund recorded on a commission already inside a draft/approved payout: void that batch so nothing is paid until the review is
  --     resolved; the commission returns to validated and is held below. Commissions already PAID keep the flag-only semantics of record_purchase_partial_refund.
  for r in
    select c.id, c.payout_id from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where f.partial_refund_flagged_at is not null and c.state = 'payable' for update of c
  loop
    update public.payouts set status = 'void', void_reason = 'contains_partially_refunded_commission' where id = r.payout_id and status in ('draft','approved');
    update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now where payout_id = r.payout_id and state = 'payable';
    update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
  end loop;

  -- 2. dispute opened: freeze (HOLD, never reverse). dispute won: release if the only reason was the dispute. (217470) An open dispute is visible two ways and both hold:
  --    the purchase facts (dispute_status 'open') and the entitlement itself (revoked_at set with revoked_reason 'dispute_open', which is how the payment ledger takes access
  --    away while a dispute is open).
  for r in
    select c.id, c.state from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where (f.dispute_status = 'open' or (e.revoked_at is not null and e.revoked_reason = 'dispute_open')) and c.state in ('pending','validated') for update of c
  loop
    update public.commissions set state = 'held', reason = 'dispute_open', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'held', 'dispute_open', 'system'); v_held := v_held + 1;
  end loop;
  -- release: the dispute is no longer open (won, or closed with no loss), the entitlement is no longer revoked for it, and nothing else holds the commission.
  -- The commission continues through the NORMAL path: pending, then validated once its original 45-day validate_after has elapsed (step 3). Lost / refunded never reach here (step 1).
  for r in
    select c.id from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where c.state = 'held' and c.reason = 'dispute_open'
       and coalesce(f.dispute_status,'none') in ('won','none')
       and not (e.revoked_at is not null and e.revoked_reason = 'dispute_open')
     for update of c
  loop
    update public.commissions set state = 'pending', reason = 'dispute_won', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, 'held', 'pending', 'dispute_won', 'system'); v_rel := v_rel + 1;
  end loop;
  -- 2b. (217470, DEF-2) a partially refunded purchase (record_purchase_partial_refund set partial_refund_flagged_at) must not validate until resolved: hold it for review.
  --     Also catches a commission created or released AFTER the partial refund was recorded. There is no automatic release: an owner/staff decision resolves it.
  for r in
    select c.id, c.state from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where f.partial_refund_flagged_at is not null and c.state in ('pending','validated') for update of c
  loop
    update public.commissions set state = 'held', reason = 'partial_refund_review', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'held', 'partial_refund_review', 'system'); v_held := v_held + 1;
  end loop;

  -- 3. validation: the SNAPSHOT hold has elapsed, no dispute (open or lost), not refunded, no partial refund under review. The processor fee is no longer needed.
  for r in
    select c.id from public.commissions c
      join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
      join public.gathering_entitlements e on e.id = c.entitlement_id
     where c.state = 'pending' and c.validate_after <= p_now and c.commission_cents is not null
       and f.dispute_status in ('none','won') and e.refunded_at is null
       and not (e.revoked_at is not null and e.revoked_reason = 'dispute_open')
       and f.partial_refund_flagged_at is null
     for update of c
  loop
    update public.commissions set state = 'validated', reason = null, state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, 'pending', 'validated', 'validation_period_elapsed', 'system'); v_val := v_val + 1;
  end loop;

  return jsonb_build_object('status','ok','reversed',v_rev,'validated',v_val,'held',v_held,'released',v_rel);
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
  -- 217440 (E-PLUS): exact match first (Gathering Pass = PaymentIntent), then the existing payment linkage (Plus facts are keyed by the subscription id).
  select * into f from public.commission_purchase_facts
   where entitlement_id in (select r.entitlement_id from public.resolve_purchase_fact_entitlements(p_provider_transaction_id) r)
   order by (provider_transaction_id = p_provider_transaction_id) desc, recorded_at limit 1 for update;
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

CREATE OR REPLACE FUNCTION public.hc_commission_blocked(p_entitlement_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- same predicate the sweep uses to reverse (refunded, revoked for a reason other than ordinary cancellation, dispute lost) or hold (dispute open, partial refund under review)
  select exists (
    select 1 from public.gathering_entitlements e
      left join public.commission_purchase_facts f on f.entitlement_id = e.id
     where e.id = p_entitlement_id
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') <> 'subscription_deleted')
            or f.dispute_status in ('open','lost')
            or f.partial_refund_flagged_at is not null));   -- 217470: a partially refunded purchase under review is not payable either
$function$;

drop function if exists public.hc_admin_list_partial_refund_holds(integer);
drop function if exists public.hc_resolve_partial_refund_hold(uuid,text,text,boolean);
drop trigger if exists hc_partial_refund_resolutions_append_only on public.hc_partial_refund_resolutions;
drop trigger if exists hc_partial_refund_resolutions_no_truncate on public.hc_partial_refund_resolutions;
drop function if exists public.hc_partial_refund_release_blocker(uuid);
drop function if exists public.hc_partial_refund_open(uuid);
drop table if exists public.hc_partial_refund_resolutions;
