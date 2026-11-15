-- 20261114217470_hc_dispute_and_partial_refund_hold.sql   (agent H, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- Fixes two defects found by the end-to-end verification (REPORT_e3-final DEF-1 / DEF-2). Three function bodies change, nothing else; no data is touched.
-- DEF-1  An OPEN dispute must HOLD a commission, never reverse it.
--   Cause: while a dispute is open the payment ledger takes access away by setting gathering_entitlements.revoked_at with revoked_reason = 'dispute_open'. Step 1 of the sweep
--   reversed every commission whose entitlement had revoked_at set (except 'subscription_deleted'), so the very next sweep (the webhook runs one after every dispute event, and the
--   daily maintenance job runs one) reversed it permanently; "dispute won" restored access but a reversed commission is terminal, so the affiliate was underpaid.
--   Now: revoked_reason 'dispute_open' is a HOLD.
--     open dispute (purchase facts dispute_status = 'open' OR entitlement revoked for 'dispute_open')  -> pending/validated commission becomes held / dispute_open;
--       a commission inside a draft/approved payout voids that batch (it returns to validated and is then held); a commission already PAID is not touched (clawback model, only on loss).
--     dispute won (or closed with no loss; facts 'won'/'none', entitlement no longer revoked for it) -> held/dispute_open is released to pending / dispute_won and then follows the NORMAL
--       path: validated once its ORIGINAL validate_after (purchase + 45 days) has elapsed, payable through the normal owner-only draft/approve/record. Nothing is paid early.
--     dispute lost (facts 'lost', entitlement revoked_reason 'dispute_lost'), refunded entitlement, or any other revocation reason -> reversed exactly as before (never overpaid).
--   reconcile_commission_for_entitlement: an entitlement revoked for 'dispute_open' still qualifies (it creates the commission HELD / dispute_open instead of returning not_qualifying),
--   so the ordering "dispute before reconcile" no longer loses the commission.
-- DEF-2  record_purchase_partial_refund (214003 / 217440) existed but nothing called it (the webhook now does, behind HC_LEDGER_WIRING_ENABLED; see the proposed handler).
--   Semantics of that function, unchanged and documented here: it records facts.refunded_cents (greatest of the amounts seen) and facts.partial_refund_flagged_at, then
--     pending/validated commission -> held / partial_refund_review ("held_for_review"); a commission already payable/paid/held/reversed is only FLAGGED in the event log ("flagged");
--     no commission yet -> "recorded_no_commission"; unknown reference -> "no_facts". Access is kept (a partial refund never revokes the entitlement).
--   Added here so the rule "refunded purchases are excluded" holds for every ordering of events:
--     * the sweep holds any pending/validated commission whose facts carry partial_refund_flagged_at (a commission created or released AFTER the partial refund was recorded), and
--       voids a draft/approved payout that contains one; it never validates one (step 3 also requires partial_refund_flagged_at is null);
--     * reconcile creates such a commission held / partial_refund_review;
--     * hc_commission_blocked (used by draft / approve / record) includes it, so a payout containing it cannot be approved or recorded.
--     There is deliberately NO automatic release: held / partial_refund_review waits for an owner/staff decision (no resolver function exists in this package; see the report).
--     A later FULL refund of the same purchase reverses it (refunded_at). A commission already PAID is never clawed back by a partial refund (flag only).
-- NOT changed: amounts ($12 Plus annual / $0.50 Gathering Pass fixed), 30-day attribution, 45-day hold, $50 minimum, no renewal/upgrade commission, no automatic discount, exclusions,
--   owner-only payout approve/record, no retroactive accrual (217400/217410 windows), paid referrals default OFF, SMS.
-- Idempotent (CREATE OR REPLACE; no data change). Grants preserved. Rollback: ROLLBACK_217470.sql restores the three pre-state bodies exactly.
-- Depends on: 214003 (partial_refund_flagged_at), 217300, 217400, 217410.

do $$ begin
  if to_regprocedure('public.hc_sweep_commissions_core(timestamptz)') is null or to_regprocedure('public.reconcile_commission_for_entitlement(uuid)') is null
     or to_regprocedure('public.hc_commission_blocked(uuid)') is null or to_regprocedure('public.hc_paid_referrals_on_at(timestamptz)') is null then
    raise exception 'dependency_missing: 217300 (sweep core, blocked predicate), 217410 (reconcile) must be applied first';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='commission_purchase_facts' and column_name='partial_refund_flagged_at') then
    raise exception 'dependency_missing: 214003 commission_purchase_facts.partial_refund_flagged_at';
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

CREATE OR REPLACE FUNCTION public.reconcile_commission_for_entitlement(p_entitlement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.gathering_entitlements;
  v_set public.hc_settings;
  c public.referral_claims;
  p public.partners;
  f public.commission_purchase_facts;
  t public.hc_terms_versions;
  v_amount integer; v_win integer; v_state text := 'pending'; v_reason text;
  v_id uuid; v_pu_email text; v_ru_email text;
begin
  perform public.hc_require_service();
  select * into v_set from public.hc_settings where singleton;
  if not v_set.enabled then return jsonb_build_object('status','disabled'); end if;
  -- 216100 (D4): paid referrals are a separate, explicit switch. While off, NO commission row is created and nothing is promised.
  if not v_set.paid_referrals_enabled then return jsonb_build_object('status','paid_referrals_disabled'); end if;
  select * into e from public.gathering_entitlements where id = p_entitlement_id;
  if not found then return jsonb_build_object('status','entitlement_not_found'); end if;

  -- qualifying products: Gathering Pass and Plus annual only. Multi-Day Pass, its extension, free tiers: never.
  if not (e.provider = 'web' and e.environment = 'production'
          and e.canonical_product_id in ('gathering_pass','plus_annual')
          and e.refunded_at is null
          and (e.revoked_at is null or e.revoked_reason in ('subscription_deleted','dispute_open'))) then   -- 217470: an OPEN dispute is a hold, not a disqualification
    return jsonb_build_object('status','not_qualifying');
  end if;

  -- 217410 (founder decision D-3, no retroactive accrual): the purchase must have been made while paid referrals were ON (append-only windows, 217400).
  -- A purchase made while OFF never accrues, even after activation: no row is created, the reason is reported.
  if not public.hc_paid_referrals_on_at(e.purchased_at) then
    return jsonb_build_object('status','not_qualifying_paid_referrals_off_at_purchase','reason','paid_referrals_off_at_purchase');
  end if;

  select * into c from public.referral_claims where referred_user_id = e.user_id;
  if not found then return jsonb_build_object('status','no_claim'); end if;
  if e.purchased_at < c.touched_at or e.purchased_at > c.window_ends_at then return jsonb_build_object('status','outside_window'); end if;

  -- first qualifying paid purchase only: ANY earlier paid purchase on ANY provider (including Multi-Day) means this is a repeat,
  -- upgrade or renewal. A later Plus bought after a Gathering Pass therefore earns nothing; a renewal row earns nothing.
  if exists (select 1 from public.gathering_entitlements x
              where x.user_id = e.user_id and x.id <> e.id and x.provider in ('web','apple','google')
                and x.canonical_product_id in ('gathering_pass','multi_day_pass','plus_annual','multi_day_extension')
                and (x.purchased_at < e.purchased_at or (x.purchased_at = e.purchased_at and x.id < e.id))) then
    return jsonb_build_object('status','not_new_customer');
  end if;

  select * into f from public.commission_purchase_facts where entitlement_id = e.id;
  if not found then return jsonb_build_object('status','awaiting_purchase_facts'); end if;
  if f.amount_subtotal_cents <= 0 then return jsonb_build_object('status','not_qualifying_no_payment'); end if;   -- 100% coupon / free

  select * into t from public.hc_terms_in_force(e.purchased_at);
  select amount_cents into v_amount from public.hc_terms_amounts where version = t.version and canonical_product_id = e.canonical_product_id;
  if t.version is null or v_amount is null then return jsonb_build_object('status','terms_not_configured'); end if;

  select * into p from public.partners where id = c.partner_id;
  select lower(email) into v_pu_email from auth.users where id = p.user_id;
  select lower(email) into v_ru_email from auth.users where id = e.user_id;

  if p.status <> 'approved' then v_state := 'blocked'; v_reason := 'partner_not_approved';
  elsif p.user_id = e.user_id then v_state := 'blocked'; v_reason := 'self_referral_user';
  elsif public.hc_norm_email(v_pu_email) is not null and public.hc_norm_email(v_pu_email) = public.hc_norm_email(v_ru_email) then
    v_state := 'blocked'; v_reason := 'self_referral_email';
  elsif f.stripe_customer_id is not null and exists (
          select 1 from public.commission_purchase_facts pf join public.gathering_entitlements pe on pe.id = pf.entitlement_id
           where pe.user_id = p.user_id and pf.stripe_customer_id = f.stripe_customer_id) then
    v_state := 'held'; v_reason := 'shared_stripe_customer';
  elsif f.payment_fingerprint_hash is not null and exists (
          select 1 from public.commission_purchase_facts pf join public.gathering_entitlements pe on pe.id = pf.entitlement_id
           where pe.user_id = p.user_id and pf.payment_fingerprint_hash = f.payment_fingerprint_hash) then
    v_state := 'held'; v_reason := 'shared_payment_card';
  elsif f.dispute_status = 'open' or (e.revoked_at is not null and e.revoked_reason = 'dispute_open') then v_state := 'held'; v_reason := 'dispute_open';   -- 217470: the ledger marks an open dispute on the entitlement itself
  elsif f.partial_refund_flagged_at is not null then v_state := 'held'; v_reason := 'partial_refund_review';   -- 217470: a partially refunded purchase is held for review, never auto-validated
  elsif p.tier is null then v_state := 'held'; v_reason := 'basic_membership_no_tier';   -- owner decides if/when a basic member earns
  elsif not coalesce((select t2.paid_referrals_eligible and t2.active from public.hc_tiers t2 where t2.slug = p.tier), false) then
    v_state := 'held'; v_reason := 'tier_not_eligible_for_paid_referrals';   -- 216100 (D4): members without paid terms never accrue silently
  end if;

  v_win := round(extract(epoch from (c.window_ends_at - c.touched_at)) / 86400.0)::integer;

  -- idempotent: unique(entitlement_id), unique(source_provider_transaction_id), unique(referred_user_id) all collapse to one row
  insert into public.commissions (partner_id, claim_id, referred_user_id, entitlement_id, source_provider_transaction_id,
        canonical_product_id, currency, base_amount_cents, rate_bps, commission_cents, state, purchased_at, validate_after, reason,
        terms_version, terms_amount_cents, terms_validation_days, terms_min_payout_cents, terms_window_days, terms_snapshot)
  values (p.id, c.id, e.user_id, e.id, f.provider_transaction_id, e.canonical_product_id, f.currency, f.amount_subtotal_cents, null, v_amount,
          v_state, e.purchased_at, e.purchased_at + make_interval(days => t.validation_days), v_reason,
          t.version, v_amount, t.validation_days, t.min_payout_cents, v_win,
          jsonb_build_object('terms_version', t.version, 'product', e.canonical_product_id, 'amount_cents', v_amount,
                             'validation_days', t.validation_days, 'min_payout_cents', t.min_payout_cents,
                             'attribution_window_days', v_win, 'first_touch', true, 'recorded_at', now()))
  on conflict do nothing
  returning id into v_id;

  if v_id is null then return jsonb_build_object('status','already_recorded'); end if;
  perform public.hc_log_event(v_id, null, v_state, coalesce(v_reason,'created'), 'system');
  return jsonb_build_object('status', v_state, 'reason', v_reason, 'amount_cents', v_amount, 'terms_version', t.version);
end;
$function$;

create or replace function public.hc_commission_blocked(p_entitlement_id uuid)
 returns boolean language sql stable security definer set search_path to '' as $f$
  -- same predicate the sweep uses to reverse (refunded, revoked for a reason other than ordinary cancellation, dispute lost) or hold (dispute open, partial refund under review)
  select exists (
    select 1 from public.gathering_entitlements e
      left join public.commission_purchase_facts f on f.entitlement_id = e.id
     where e.id = p_entitlement_id
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') <> 'subscription_deleted')
            or f.dispute_status in ('open','lost')
            or f.partial_refund_flagged_at is not null));   -- 217470: a partially refunded purchase under review is not payable either
$f$;
-- grants: CREATE OR REPLACE keeps the existing ACLs; restate the internal-only ones explicitly (idempotent).
revoke all on function public.hc_commission_blocked(uuid) from public, anon, authenticated;
revoke all on function public.hc_sweep_commissions_core(timestamptz) from public, anon, authenticated;
