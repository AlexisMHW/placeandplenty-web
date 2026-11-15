-- Rollback of 217200 (agent F). Removes public.paper_orders ONLY if 217200 created it (table comment marker) and it holds no rows.
-- On production the table pre-exists (no marker): this rollback is a deliberate no-op there and never drops order data.
do $rb$
begin
  if to_regclass('public.paper_orders') is null then
    raise notice '217200 rollback: paper_orders absent, nothing to do';
  elsif obj_description('public.paper_orders'::regclass, 'pg_class') is distinct from 'pp:217200:created-by-repo-migration' then
    raise notice '217200 rollback: paper_orders was not created by 217200 (pre-existing); left untouched';
  elsif exists (select 1 from public.paper_orders) then
    raise exception '217200 rollback refused: paper_orders has rows (fail-safe, not dropped)';
  else
    drop table public.paper_orders;
  end if;
end
$rb$;
