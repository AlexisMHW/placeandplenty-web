-- Rollback of 217240 (agent F): the function did not exist before (absent on production and QA). The column is dropped only if 217240 added it (comment marker) and no row has a value.
drop function if exists public.growth_funnel_summary(timestamptz, timestamptz, boolean);
do $rb$
begin
  if col_description('public.gatherings'::regclass, (select attnum from pg_attribute where attrelid = 'public.gatherings'::regclass and attname = 'invitations_published_at')) = 'pp:217240:created-by-repo-migration' then
    if exists (select 1 from public.gatherings where invitations_published_at is not null) then
      raise notice '217240 rollback: invitations_published_at holds values; column kept (fail-safe)';
    else
      alter table public.gatherings drop column invitations_published_at;
    end if;
  end if;
end
$rb$;
