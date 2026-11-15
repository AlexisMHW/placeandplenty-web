-- Rollback of 217220 (agent F): the getter did not exist before (absent on production and QA).
drop function if exists public.get_multi_day_lock_in_gate();
