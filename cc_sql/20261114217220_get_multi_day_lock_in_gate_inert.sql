-- 20261114217220_get_multi_day_lock_in_gate_inert.sql   (agent F, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- Owner decision 1: ship an INERT getter ONLY. public.get_multi_day_lock_in_gate() always returns {"mode":"off"}.
-- The web (lib/multi-day-pass.ts parseMultiDayGateMode) and native (multiDayAccessService) treat "off" and an absent/erroring function identically (legacy lock-in flow),
-- so this is behaviourally the same as the function being absent; it only silences the failing network call.
-- NOT included (deliberately): no table, no mode setter, NO enforcement trigger, no change to 203001/203003. Multi-day stays inactive/unsold.
-- If the owner later chooses enforcement, the real 20261114203003 (which redefines this function from a mode table) is a separate decision and migration.
-- Constant function: reads no table, takes no argument, reveals nothing. Grants as in 203003: authenticated + service_role, not anon / PUBLIC.
-- Idempotent (CREATE OR REPLACE). Rollback: ROLLBACK_217220.sql
create or replace function public.get_multi_day_lock_in_gate()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select jsonb_build_object('mode', 'off');
$function$;
revoke all on function public.get_multi_day_lock_in_gate() from public, anon;
grant execute on function public.get_multi_day_lock_in_gate() to authenticated, service_role;
