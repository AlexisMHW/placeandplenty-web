-- Rollback of 217210 (agent F): the function did not exist before (absent on production and QA).
drop function if exists public.get_multi_day_entitlement_state(uuid);
