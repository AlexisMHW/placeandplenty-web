-- 20261114217440_hc_purchase_facts_plus_resolution.sql   (agent S2, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- E-PLUS (from REPORT_p-wiring): purchase facts are keyed by provider_transaction_id = the SUBSCRIPTION id for web Plus, but a dispute / refund event carries the charge's
-- PaymentIntent, so record_purchase_dispute / record_purchase_partial_refund never matched a Plus facts row (dispute 'open' never held the commission, refunded_cents never recorded).
--   * public.resolve_purchase_fact_entitlements(text): internal (service_role/definer only). Given any identifier a processor event carries it returns the entitlement ids whose
--       purchase-facts row it belongs to: (1) EXACT facts.provider_transaction_id match (unchanged behaviour; when it matches, nothing else is consulted), otherwise through the SAME
--       linkage apply_payment_event / hc_ledger use: purchase_payments (payment_intent / charge / invoice / subscription id -> entitlement), subscription_invoice_payments
--       (renewal invoice -> original transaction -> entitlement) and the payment_recorded / payment_linked entitlement_events (invoice -> payload payment_intent / charge).
--       Only web Stripe entitlements that HAVE a facts row are returned; fail-safe: any error inside the resolution falls back to the exact match, never raises.
--   * record_purchase_dispute(text,text): updates the facts of the resolved entitlement(s) (signature, void return, grants unchanged). No match = no-op, as before.
--   * record_purchase_partial_refund(text,integer): finds the facts row through the same resolution (exact match preferred). Everything else unchanged.
-- Full refunds need no change: the ledger already resolves the charge to the entitlement (refunded_at), and the sweep reverses the commission from that. No economics are touched.
-- Idempotent. Rollback: ROLLBACK_217440.sql restores both pre-state bodies exactly and drops the helper.
do $$ begin
  if to_regprocedure('public.record_purchase_dispute(text,text)') is null or to_regprocedure('public.record_purchase_partial_refund(text,integer)') is null
     or to_regclass('public.purchase_payments') is null or to_regclass('public.subscription_invoice_payments') is null or to_regclass('public.entitlement_events') is null then
    raise exception 'dependency_missing: 212001 / 212003 / 205000 / 205002';
  end if;
end $$;

create or replace function public.resolve_purchase_fact_entitlements(p_ref text)
 returns table (entitlement_id uuid)
 language plpgsql stable security definer set search_path to ''
as $function$
begin
  if p_ref is null or btrim(p_ref) = '' then return; end if;
  begin
    return query
    with direct as (select f.entitlement_id from public.commission_purchase_facts f where f.provider_transaction_id = p_ref),
    linked as (
      select ge.id as eid from public.purchase_payments pp
        join public.gathering_entitlements ge on ge.id = pp.entitlement_id or (ge.provider = 'web' and ge.provider_transaction_id = pp.transaction_id)
       where pp.provider = 'stripe' and p_ref in (pp.stripe_payment_intent_id, pp.stripe_charge_id, pp.stripe_invoice_id, pp.stripe_subscription_id, pp.transaction_id)
      union
      select ge.id from public.subscription_invoice_payments sip
        join public.gathering_entitlements ge on ge.provider = 'web' and ge.provider_transaction_id = sip.transaction_id
       where p_ref in (sip.payment_intent_id, sip.charge_id, sip.invoice_id, sip.subscription_id)
      union
      select ev.entitlement_id from public.entitlement_events ev join public.gathering_entitlements ge on ge.id = ev.entitlement_id
       where ge.provider = 'web' and ev.event_type in ('payment_recorded', 'payment_linked')
         and (ev.provider_transaction_id = p_ref or ev.payload->>'payment_intent' = p_ref or ev.payload->>'charge' = p_ref)
    )
    select d.entitlement_id from direct d
    union
    select f.entitlement_id from public.commission_purchase_facts f
     where not exists (select 1 from direct) and f.entitlement_id in (select l.eid from linked l);
  exception when others then
    -- fail safe: never let the resolution break dispute / refund recording; fall back to the exact match only
    return query select f.entitlement_id from public.commission_purchase_facts f where f.provider_transaction_id = p_ref;
  end;
end;
$function$;
revoke execute on function public.resolve_purchase_fact_entitlements(text) from public, anon, authenticated;
grant execute on function public.resolve_purchase_fact_entitlements(text) to service_role;

CREATE OR REPLACE FUNCTION public.record_purchase_dispute(p_provider_transaction_id text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.hc_require_service();
  if p_status not in ('none','open','won','lost') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  -- 217440 (E-PLUS): p_provider_transaction_id is whatever the processor event carries (PaymentIntent / charge / invoice / subscription id). Gathering Pass facts are keyed by the
  -- PaymentIntent (exact match, unchanged); Plus facts are keyed by the SUBSCRIPTION id, so a dispute on a Plus charge is resolved through the existing payment linkage.
  update public.commission_purchase_facts set dispute_status = p_status, updated_at = now()
   where entitlement_id in (select r.entitlement_id from public.resolve_purchase_fact_entitlements(p_provider_transaction_id) r);
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
