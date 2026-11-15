-- Rollback of 217310 (agent S): unschedules the pg_cron job (if pg_cron exists and the job exists) and drops hc_commission_maintenance. No data is touched.
do $$
begin
  if to_regclass('cron.job') is not null and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'cron' and p.proname = 'unschedule') then
    begin
      if exists (select 1 from cron.job where jobname = 'hc_commission_maintenance_daily') then
        perform cron.unschedule('hc_commission_maintenance_daily');
      end if;
    exception when others then
      raise notice 'could not unschedule hc_commission_maintenance_daily (%): remove it manually', sqlerrm;
    end;
  end if;
end $$;
drop function if exists public.hc_commission_maintenance(integer, integer);
