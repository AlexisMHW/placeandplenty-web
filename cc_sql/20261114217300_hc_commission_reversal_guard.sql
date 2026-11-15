-- 20261114217300_hc_commission_reversal_guard.sql   (agent S, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- E-C1 (HIGH, money): a refunded / revoked / dispute-open-or-lost commission must NEVER be included in a payout draft, approved, or recorded as paid.
--   Before: hc_create_payout_draft summed every state='validated' commission; refund reversal only happened in sweep_commissions (service role), which nothing
--   ran, so a purchase refunded after it validated was still drafted (verifier C9b: draft 6200c included the refunded 1200c).
--   After:
--     * hc_sweep_commissions_core(p_now): the sweep body verbatim, minus the service-role check, internal only (no API grants).
--       sweep_commissions(p_now) keeps its signature, grants and behaviour: hc_require_service() then the core.
--     * hc_create_payout_draft runs the core FIRST (inside the same transaction, after the active / partner checks), then selects only commissions that are not
--       blocked: gross, per-product totals, the payable update and therefore net_cents / the payout total all exclude them.
--     * hc_approve_payout and hc_record_external_payment refuse (payout_contains_reversed_commission, nothing changed) when any payable commission of the batch is
--       now refunded / revoked / disputed. All earlier validation order and error codes are unchanged; the check is the last gate before the write.
--   Blocked predicate (hc_commission_blocked): entitlement refunded_at set, OR revoked_at set with a reason other than ordinary cancellation ('subscription_deleted',
--   the same exception reconcile and the sweep make, so a normal subscription cancellation after the hold still pays), OR dispute open / lost.
--   NOT changed: amounts, $12 Plus / $0.50 Pass first purchase, 30-day attribution, 45-day hold, $50 minimum, no renewal/upgrade commissions, paid referrals default OFF,
--   versioned terms, retroactive accrual (E-C3 owner decision), payout ledger visibility (E-D2 owner decision). No data is touched.
-- Depends on: 212001/212003, 214003, 216100, 217120. Rollback: ROLLBACK_217300.sql (restores the four pre-state bodies exactly).
do $$ begin
  if to_regprocedure('public.sweep_commissions(timestamptz)') is null or to_regprocedure('public.hc_create_payout_draft(uuid)') is null
     or to_regprocedure('public.hc_approve_payout(uuid)') is null or to_regprocedure('public.hc_record_external_payment(uuid,text,date,text,boolean)') is null then
    raise exception 'dependency_missing: HC payout / commission functions (214003, 216100, 217120) must be applied first';
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

  -- 1. reversals: refunded, revoked for a reason other than ordinary cancellation, or dispute lost
  for r in
    select c.id, c.state, c.commission_cents, c.payout_id, c.partner_id
      from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where c.state in ('pending','held','validated','payable','paid')
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') <> 'subscription_deleted')
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
    select c.id, c.payout_id from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where f.dispute_status = 'open' and c.state = 'payable' for update of c
  loop
    update public.payouts set status = 'void', void_reason = 'contains_disputed_commission' where id = r.payout_id and status in ('draft','approved');
    update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now where payout_id = r.payout_id and state = 'payable';
    update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
  end loop;

  -- 2. dispute opened: freeze. dispute won: release if the only reason was the dispute.
  for r in
    select c.id, c.state from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where f.dispute_status = 'open' and c.state in ('pending','validated') for update of c
  loop
    update public.commissions set state = 'held', reason = 'dispute_open', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'held', 'dispute_open', 'system'); v_held := v_held + 1;
  end loop;
  for r in
    select c.id from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where f.dispute_status = 'won' and c.state = 'held' and c.reason = 'dispute_open' for update of c
  loop
    update public.commissions set state = 'pending', reason = 'dispute_won', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, 'held', 'pending', 'dispute_won', 'system'); v_rel := v_rel + 1;
  end loop;

  -- 3. validation: the SNAPSHOT hold has elapsed, no dispute, not refunded. The processor fee is no longer needed.
  for r in
    select c.id from public.commissions c
      join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
      join public.gathering_entitlements e on e.id = c.entitlement_id
     where c.state = 'pending' and c.validate_after <= p_now and c.commission_cents is not null
       and f.dispute_status in ('none','won') and e.refunded_at is null
     for update of c
  loop
    update public.commissions set state = 'validated', reason = null, state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, 'pending', 'validated', 'validation_period_elapsed', 'system'); v_val := v_val + 1;
  end loop;

  return jsonb_build_object('status','ok','reversed',v_rev,'validated',v_val,'held',v_held,'released',v_rel);
end;
$function$;

create or replace function public.hc_commission_blocked(p_entitlement_id uuid)
 returns boolean language sql stable security definer set search_path to '' as $f$
  -- same predicate the sweep uses to reverse (refunded, revoked for a reason other than ordinary cancellation, dispute lost) or hold (dispute open)
  select exists (
    select 1 from public.gathering_entitlements e
      left join public.commission_purchase_facts f on f.entitlement_id = e.id
     where e.id = p_entitlement_id
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') <> 'subscription_deleted')
            or f.dispute_status in ('open','lost')));
$f$;
create or replace function public.hc_payout_has_blocked_commission(p_payout_id uuid)
 returns boolean language sql stable security definer set search_path to '' as $f$
  select exists (select 1 from public.commissions c
                  where c.payout_id = p_payout_id and c.state = 'payable' and public.hc_commission_blocked(c.entitlement_id));
$f$;
revoke all on function public.hc_commission_blocked(uuid) from public, anon, authenticated;
revoke all on function public.hc_payout_has_blocked_commission(uuid) from public, anon, authenticated;
revoke all on function public.hc_sweep_commissions_core(timestamptz) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sweep_commissions(p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.hc_require_service();
  return public.hc_sweep_commissions_core(p_now);
end;
$function$;

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
