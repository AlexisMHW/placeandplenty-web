-- Isolated QA only. These synthetic quota events are always rolled back.
begin;
set local statement_timeout='20s';
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb; i integer; begin
  for i in 1..60 loop
    r:=public.check_canva_gathering_quota();
    if r->>'status'<>'allowed' then raise exception 'quota rejected too early'; end if;
  end loop;
  r:=public.check_canva_gathering_quota();
  if r->>'status'<>'rate_limited' or (r->>'retry_after')::integer not between 1 and 60
    then raise exception 'minute quota or retry time incorrect'; end if;
end $$;
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
  r:=public.check_canva_gathering_quota();
  if r->>'status'<>'allowed' then raise exception 'account isolation failed'; end if;
  if has_table_privilege('authenticated','public.canva_authorization_codes','INSERT')
    or has_schema_privilege('authenticated','canva_private','USAGE')
    or has_function_privilege('authenticated','canva_private.cleanup_temporary_records()','EXECUTE')
    or has_function_privilege('anon','public.begin_canva_publish(uuid,uuid,text)','EXECUTE')
    then raise exception 'private data or privileged operations exposed'; end if;
end $$;
rollback;
select 'PASS: live per-account quota, Retry-After boundary and private grants; synthetic events rolled back' as result;
