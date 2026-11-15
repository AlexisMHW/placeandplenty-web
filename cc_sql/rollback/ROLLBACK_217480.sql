-- Rollback of 217480 (agent H): restores the default EXECUTE privilege (PUBLIC) on the 202100 trigger function. No body or trigger change.
do $$ begin
  if to_regprocedure('public.enforce_terminal_read_only()') is not null then
    execute 'grant execute on function public.enforce_terminal_read_only() to public';
  end if;
end $$;
