-- Isolated QA fix; production remains review-only.
-- A SECURITY DEFINER must not enumerate the canonical invoker/RLS list: that
-- bypasses its row filter and evaluates lifecycle checks for unrelated hosts.
-- Keep the canonical membership and lifecycle functions unchanged and invoke
-- them only for the explicitly selected gathering.
create or replace function canva_private.assert_gathering(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_accepted_gathering_member(p_id)
  then raise exception 'Gathering unavailable'; end if;
  if not exists(select 1 from public.gatherings g where g.id=p_id
      and g.duration_type in ('single_day','multi_day'))
    or public.effective_gathering_status(p_id) not in ('draft','active')
  then raise exception 'Gathering unavailable'; end if;
end $$;
revoke all on function canva_private.assert_gathering(uuid) from public,anon,authenticated;
