-- 20261114217310_hc_commission_maintenance.sql   (agent S, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- E-C2 (HIGH, wiring): nothing called sweep_commissions / reconcile_commission_for_entitlement, so commissions never accrued, validated or reversed on their own.
--   Adds ONE service-only function, public.hc_commission_maintenance(p_lookback_days integer default 30, p_batch integer default 500):
--     1. reconciles recent qualifying web/production entitlements (Gathering Pass, Plus annual, purchased within the look-back window, buyer has a referral claim,
--        no commission row yet, not refunded) through the EXISTING reconcile_commission_for_entitlement (all rules, amounts and terms live there, unchanged);
--     2. runs the sweep (hc_sweep_commissions_core, 217300) at now(): reversals, dispute holds, 45-day validation.
--   COMPLETE NO-OP while paid referrals are OFF (the default): returns {status:paid_referrals_disabled, accrued:0, reconciled:0, swept:false} and touches nothing.
--   Returns {status:disabled} while the program master switch is off. Never moves money, never drafts / approves / pays a payout, calls nothing outside the database.
--   Access: EXECUTE for service_role only (revoked from public, anon, authenticated) and the body refuses any non-service JWT role. When invoked by the database
--   scheduler there is no JWT (auth.role() is null); that is accepted, and for the duration of the call the claims are set to the service role so the existing
--   service-only reconcile function accepts it; the previous claims value is restored before returning.
--   Scheduling: pg_cron job 'hc_commission_maintenance_daily' (06:23 UTC daily, pure SQL: select public.hc_commission_maintenance();) is created ONLY inside a guarded DO block
--   that does nothing when pg_cron is not installed (or the migration role cannot use it). No URL, no credential, no http call. Idempotent under the fixed job name.
--   ROLLBACK_217310.sql unschedules the job and drops the function. On hosted QA this creates exactly ONE cron job and it is inert while paid referrals are OFF.
-- Depends on: 217300. Does not change E-C3 (retroactive accrual: a purchase made while paid referrals were OFF and still inside the look-back window can be reconciled
-- once the owner switches paid referrals ON - owner decision, unchanged).
do $$ begin
  if to_regprocedure('public.hc_sweep_commissions_core(timestamptz)') is null
     or to_regprocedure('public.reconcile_commission_for_entitlement(uuid)') is null then
    raise exception 'dependency_missing: 217300 and the reconcile function must be applied first';
  end if;
end $$;

create or replace function public.hc_commission_maintenance(p_lookback_days integer default 30, p_batch integer default 500)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
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
  return jsonb_build_object('status', 'ok', 'reconciled', v_n, 'accrued', v_acc, 'by_status', v_by, 'swept', true, 'sweep', v_sweep);
end;
$function$;
revoke all on function public.hc_commission_maintenance(integer, integer) from public, anon, authenticated;
grant execute on function public.hc_commission_maintenance(integer, integer) to service_role;

-- Scheduler: pure SQL, guarded, idempotent under a fixed name. Skips silently when pg_cron is absent.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null and to_regclass('cron.job') is not null then
    begin
      if exists (select 1 from cron.job where jobname = 'hc_commission_maintenance_daily') then
        perform cron.unschedule('hc_commission_maintenance_daily');
      end if;
      perform cron.schedule('hc_commission_maintenance_daily', '23 6 * * *', 'select public.hc_commission_maintenance();');
    exception when others then
      raise notice 'hc_commission_maintenance_daily not scheduled (%): schedule it manually or ignore', sqlerrm;
    end;
  end if;
end $$;
