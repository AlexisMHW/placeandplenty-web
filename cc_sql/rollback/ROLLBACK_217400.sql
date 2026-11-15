-- Rollback of 217400 (agent S2): removes the paid-referral window ledger, its trigger and helper. Refuses while 217410 is applied (reconcile still calls the helper).
-- The ON/OFF history stays recoverable from hc_config_audit (entity 'settings'). No other object is touched.
do $$ begin
  if to_regprocedure('public.reconcile_commission_for_entitlement(uuid)') is not null
     and pg_get_functiondef('public.reconcile_commission_for_entitlement(uuid)'::regprocedure) ~ 'hc_paid_referrals_on_at' then
    raise exception 'rollback_217410_first: reconcile_commission_for_entitlement still calls hc_paid_referrals_on_at';
  end if;
end $$;
drop trigger if exists hc_settings_paid_referral_window on public.hc_settings;
drop function if exists public.hc_record_paid_referral_window();
drop function if exists public.hc_paid_referrals_on_at(timestamptz);
drop table if exists public.hc_paid_referral_windows;
drop function if exists public.hc_paid_referral_windows_guard();
