-- Isolated QA only until an owner-approved production release.
-- Stores only SHA-256 hashes of short-lived Canva grants, never JWTs/passwords.
create table canva_private.revoked_grants (
  user_id uuid not null,
  token_hash text not null check(token_hash ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at timestamptz not null,
  primary key(user_id,token_hash)
);
alter table canva_private.revoked_grants enable row level security;
revoke all on canva_private.revoked_grants from public,anon,authenticated;
create index canva_revoked_grants_expiry on canva_private.revoked_grants(expires_at);

create function public.is_canva_grant_revoked(p_token_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_token_hash is null or p_token_hash !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'invalid token hash'; end if;
  return exists(select 1 from canva_private.revoked_grants
    where user_id=auth.uid() and token_hash=p_token_hash and expires_at>clock_timestamp());
end $$;
revoke all on function public.is_canva_grant_revoked(text) from public,anon;
grant execute on function public.is_canva_grant_revoked(text) to authenticated;

create function public.revoke_canva_grant(p_token_hash text,p_expires_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); t timestamptz;
begin
  if u is null then raise exception 'authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('canva:revoke:'||u::text,0));
  t:=clock_timestamp();
  if p_token_hash is null or p_token_hash !~ '^[A-Za-z0-9_-]{43}$'
    or p_expires_at is null or p_expires_at>t+interval '10 minutes 5 seconds'
  then raise exception 'invalid revocation'; end if;
  if p_expires_at<=t then return true; end if;
  if exists(select 1 from canva_private.revoked_grants where user_id=u and token_hash=p_token_hash) then
    update canva_private.revoked_grants set expires_at=greatest(expires_at,p_expires_at)
      where user_id=u and token_hash=p_token_hash;
    return true;
  end if;
  -- Bound arbitrary authenticated insertions without exposing private state.
  if (select count(*) from canva_private.revoked_grants where user_id=u)>=60
  then raise exception 'revocation limit reached'; end if;
  insert into canva_private.revoked_grants(user_id,token_hash,expires_at) values(u,p_token_hash,p_expires_at);
  return true;
end $$;
revoke all on function public.revoke_canva_grant(text,timestamptz) from public,anon;
grant execute on function public.revoke_canva_grant(text,timestamptz) to authenticated;

create or replace function canva_private.cleanup_temporary_records() returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.canva_authorization_codes where consumed_at is not null or expires_at<clock_timestamp();
  delete from canva_private.rate_events where occurred_at<clock_timestamp()-interval '1 hour';
  delete from canva_private.publish_requests
    where (status='completed' and completed_at<clock_timestamp()-interval '24 hours')
       or (status='pending' and lease_until<clock_timestamp()-interval '24 hours');
  delete from canva_private.revoked_grants where expires_at<=clock_timestamp();
end $$;
revoke all on function canva_private.cleanup_temporary_records() from public,anon,authenticated;
