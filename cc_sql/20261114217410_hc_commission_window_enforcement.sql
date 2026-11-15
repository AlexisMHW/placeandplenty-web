-- 20261114217410_hc_commission_window_enforcement.sql   (agent S2, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- FOUNDER DECISION D-3 (final): no retroactive accrual. Depends on 217400 (hc_paid_referrals_on_at). Two function bodies change, nothing else:
--   * reconcile_commission_for_entitlement(uuid): after the "qualifying product" gate, a purchase whose purchased_at is NOT inside an ON window returns
--       {status:'not_qualifying_paid_referrals_off_at_purchase', reason:'paid_referrals_off_at_purchase'} and creates NO row (same style as not_qualifying / outside_window).
--       Every other rule is byte-for-byte the previous body (30-day attribution, first qualifying purchase only, 1200c Plus annual / 50c Pass, 45-day hold, 5000c minimum,
--       no renewal/upgrade commission, self-referral/refunded/disputed handling, paid referrals default OFF). Already-created commission rows are untouched.
--   * hc_commission_maintenance(integer,integer): candidate selection additionally requires hc_paid_referrals_on_at(purchased_at); the result gains
--       'skipped_off_at_purchase' (count). The sweep (which never creates commissions) is unchanged.
-- Idempotent (CREATE OR REPLACE). Grants are preserved. Rollback: ROLLBACK_217410.sql restores both pre-state bodies exactly.
do $$ begin
  if to_regprocedure('public.hc_paid_referrals_on_at(timestamptz)') is null then raise exception 'dependency_missing: 217400 hc_paid_referrals_on_at'; end if;
  if to_regprocedure('public.reconcile_commission_for_entitlement(uuid)') is null or to_regprocedure('public.hc_commission_maintenance(integer,integer)') is null then raise exception 'dependency_missing: reconcile / maintenance (216100, 217310)'; end if;
end $$;

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
          and (e.revoked_at is null or e.revoked_reason = 'subscription_deleted')) then
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
  elsif f.dispute_status = 'open' then v_state := 'held'; v_reason := 'dispute_open';
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

CREATE OR REPLACE FUNCTION public.hc_commission_maintenance(p_lookback_days integer DEFAULT 30, p_batch integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_set public.hc_settings; r record; v_prev text; v_res jsonb; v_by jsonb := '{}'::jsonb; v_n integer := 0; v_acc integer := 0; v_sweep jsonb;
  v_days integer := least(greatest(coalesce(p_lookback_days, 30), 1), 120); v_lim integer := least(greatest(coalesce(p_batch, 500), 1), 2000);
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into v_set from public.hc_settings where singleton;
  if not coalesce(v_set.enabled, false) then
    return jsonb_build_object('status', 'disabled', 'accrued', 0, 'reconciled', 0, 'swept', false);
  end if;
  if not coalesce(v_set.paid_referrals_enabled, false) then
    return jsonb_build_object('status', 'paid_referrals_disabled', 'accrued', 0, 'reconciled', 0, 'swept', false);
  end if;
  v_prev := coalesce(current_setting('request.jwt.claims', true), '');
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  for r in
    select e.id from public.gathering_entitlements e
     where e.provider = 'web' and e.environment = 'production'
       and e.canonical_product_id in ('gathering_pass', 'plus_annual')
       and e.refunded_at is null
       and e.purchased_at >= now() - make_interval(days => v_days)
       and public.hc_paid_referrals_on_at(e.purchased_at)     -- 217410 (D-3): purchases made while paid referrals were OFF are never reconciled
       and exists (select 1 from public.referral_claims c where c.referred_user_id = e.user_id)
       and not exists (select 1 from public.commissions x where x.entitlement_id = e.id)
     order by e.purchased_at, e.id
     limit v_lim
  loop
    v_res := public.reconcile_commission_for_entitlement(r.id);
    v_n := v_n + 1;
    v_by := jsonb_set(v_by, array[coalesce(v_res->>'status', 'unknown')], to_jsonb(coalesce((v_by->>coalesce(v_res->>'status', 'unknown'))::integer, 0) + 1));
    if v_res->>'status' in ('pending', 'held', 'blocked') then v_acc := v_acc + 1; end if;
  end loop;
  v_sweep := public.hc_sweep_commissions_core(now());
  perform set_config('request.jwt.claims', v_prev, true);
  return jsonb_build_object('status', 'ok', 'reconciled', v_n, 'accrued', v_acc, 'by_status', v_by, 'swept', true, 'sweep', v_sweep,
    'skipped_off_at_purchase', (select count(*) from public.gathering_entitlements e
        where e.provider = 'web' and e.environment = 'production' and e.canonical_product_id in ('gathering_pass', 'plus_annual') and e.refunded_at is null
          and e.purchased_at >= now() - make_interval(days => v_days) and exists (select 1 from public.referral_claims c where c.referred_user_id = e.user_id)
          and not exists (select 1 from public.commissions x where x.entitlement_id = e.id) and not public.hc_paid_referrals_on_at(e.purchased_at)));
end;
$function$;
