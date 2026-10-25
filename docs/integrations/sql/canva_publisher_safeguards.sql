-- Review-only for production. Applied only to the owner-approved isolated QA.
-- Canonical gathering, storage, membership and entitlement policies are unchanged.
-- REQUIRED: apply canva_selected_gathering_guard.sql immediately after this file
-- and before enabling publishing. It fixes privileged-list enumeration.
create schema canva_private;
revoke all on schema canva_private from public, anon, authenticated;
create table canva_private.rate_events (
  user_id uuid not null, action text not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index canva_rate_events_lookup on canva_private.rate_events(user_id,action,occurred_at);
alter table canva_private.rate_events enable row level security;
revoke all on canva_private.rate_events from public,anon,authenticated;

-- Caller identity comes exclusively from the validated Supabase JWT.
create function canva_private.take_quota(p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); t timestamptz; short_window interval;
  short_limit integer; n integer; earliest timestamptz; retry integer := 0;
begin
  if u is null then raise exception 'authentication required'; end if;
  case p_action
    when 'gatherings' then short_window := interval '1 minute'; short_limit := 60;
    when 'publish' then short_window := interval '1 minute'; short_limit := 5;
    when 'authorize' then short_window := interval '10 minutes'; short_limit := 10;
    else raise exception 'invalid Canva action';
  end case;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('canva:quota:'||u::text||':'||p_action,0));
  t := clock_timestamp();
  select count(*),min(occurred_at) into n,earliest from canva_private.rate_events
    where user_id=u and action=p_action and occurred_at>t-short_window;
  if n>=short_limit then retry := greatest(1,ceil(extract(epoch from earliest+short_window-t))::integer); end if;
  if p_action='publish' then
    select count(*),min(occurred_at) into n,earliest from canva_private.rate_events
      where user_id=u and action=p_action and occurred_at>t-interval '1 hour';
    if n>=30 then retry := greatest(retry,ceil(extract(epoch from earliest+interval '1 hour'-t))::integer,1); end if;
  end if;
  if retry>0 then return jsonb_build_object('status','rate_limited','retry_after',retry); end if;
  insert into canva_private.rate_events(user_id,action,occurred_at) values(u,p_action,t);
  return jsonb_build_object('status','allowed');
end $$;
revoke all on function canva_private.take_quota(text) from public,anon,authenticated;
create function public.check_canva_gathering_quota() returns jsonb
language sql security definer set search_path='' as $$ select canva_private.take_quota('gatherings'); $$;
revoke all on function public.check_canva_gathering_quota() from public,anon;
grant execute on function public.check_canva_gathering_quota() to authenticated;

-- Remove the direct INSERT route so clients cannot bypass issuance limits.
revoke insert on public.canva_authorization_codes from authenticated;
create function public.issue_canva_authorization_code(p_code_hash text,p_code_challenge text,p_encrypted_grant text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q jsonb; u uuid := auth.uid();
begin
  if u is null then raise exception 'authentication required'; end if;
  if p_code_hash is null or p_code_hash !~ '^[A-Za-z0-9_-]{43}$'
    or p_code_challenge is null or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$'
    or p_encrypted_grant is null or length(p_encrypted_grant) not between 60 and 16000
  then raise exception 'invalid authorization code'; end if;
  q := canva_private.take_quota('authorize');
  if q->>'status'<>'allowed' then return q; end if;
  insert into public.canva_authorization_codes(code_hash,user_id,code_challenge,encrypted_grant,expires_at)
    values(p_code_hash,u,p_code_challenge,p_encrypted_grant,clock_timestamp()+interval '60 seconds');
  return jsonb_build_object('status','issued');
end $$;
revoke all on function public.issue_canva_authorization_code(text,text,text) from public,anon;
grant execute on function public.issue_canva_authorization_code(text,text,text) to authenticated;

create table canva_private.publish_requests (
  user_id uuid not null, request_id uuid not null, gathering_id uuid not null,
  content_hash text not null, object_path text not null, lease_id uuid not null,
  lease_until timestamptz not null, status text not null check(status in ('pending','completed')),
  created_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
  primary key(user_id,request_id)
);
alter table canva_private.publish_requests enable row level security;
revoke all on canva_private.publish_requests from public,anon,authenticated;
create index canva_publish_requests_retention on canva_private.publish_requests(created_at);

create function canva_private.assert_gathering(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.list_my_gatherings_with_lifecycle() g
    where g.id=p_id and g.effective_status in ('draft','active') and g.duration_type in ('single_day','multi_day'))
  then raise exception 'Gathering unavailable'; end if;
end $$;
revoke all on function canva_private.assert_gathering(uuid) from public,anon,authenticated;

create function public.begin_canva_publish(p_request_id uuid,p_gathering_id uuid,p_content_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); r canva_private.publish_requests; q jsonb; lease uuid; path text; t timestamptz;
begin
  if u is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_gathering_id is null or p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$'
  then raise exception 'invalid publish request'; end if;
  perform canva_private.assert_gathering(p_gathering_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('canva:publish:'||u::text||':'||p_request_id::text,0));
  t := clock_timestamp();
  select * into r from canva_private.publish_requests where user_id=u and request_id=p_request_id for update;
  if found then
    if r.gathering_id<>p_gathering_id or r.content_hash<>p_content_hash then
      return jsonb_build_object('status','conflict');
    end if;
    if r.status='completed' then return jsonb_build_object('status','completed','path',r.object_path); end if;
    if r.lease_until>t then return jsonb_build_object('status','in_progress',
      'retry_after',greatest(1,ceil(extract(epoch from r.lease_until-t))::integer)); end if;
  end if;
  q := canva_private.take_quota('publish');
  if q->>'status'<>'allowed' then return q; end if;
  lease := gen_random_uuid();
  path := p_gathering_id::text||'/'||gen_random_uuid()::text||'.png';
  insert into canva_private.publish_requests(user_id,request_id,gathering_id,content_hash,object_path,lease_id,lease_until,status)
    values(u,p_request_id,p_gathering_id,p_content_hash,path,lease,t+interval '2 minutes','pending')
    on conflict(user_id,request_id) do update set object_path=excluded.object_path,lease_id=excluded.lease_id,lease_until=excluded.lease_until;
  return jsonb_build_object('status','claimed','path',path,'lease_id',lease);
end $$;
revoke all on function public.begin_canva_publish(uuid,uuid,text) from public,anon;
grant execute on function public.begin_canva_publish(uuid,uuid,text) to authenticated;

-- Canonical save and idempotency completion share one transaction.
create function public.complete_canva_publish(p_request_id uuid,p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); r canva_private.publish_requests;
begin
  if u is null then raise exception 'authentication required'; end if;
  select * into r from canva_private.publish_requests where user_id=u and request_id=p_request_id for update;
  if not found then raise exception 'publish request unavailable'; end if;
  perform canva_private.assert_gathering(r.gathering_id);
  if r.status='completed' then return jsonb_build_object('status','completed','path',r.object_path); end if;
  if r.lease_id<>p_lease_id or p_lease_id is null then raise exception 'publish lease unavailable'; end if;
  -- Requires an actual object, not a forged ledger completion.
  if not exists(select 1 from storage.objects where bucket_id='invitation-artwork' and name=r.object_path)
  then raise exception 'artwork unavailable'; end if;
  perform public.save_invitation_artwork(r.gathering_id,r.object_path,'image/png','canva-invitation.png');
  update canva_private.publish_requests set status='completed',completed_at=clock_timestamp()
    where user_id=u and request_id=p_request_id;
  return jsonb_build_object('status','completed','path',r.object_path);
end $$;
revoke all on function public.complete_canva_publish(uuid,uuid) from public,anon;
grant execute on function public.complete_canva_publish(uuid,uuid) to authenticated;

create function public.abandon_canva_publish(p_request_id uuid,p_lease_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update canva_private.publish_requests set lease_until=clock_timestamp()
    where user_id=auth.uid() and request_id=p_request_id and lease_id=p_lease_id and status='pending';
end $$;
revoke all on function public.abandon_canva_publish(uuid,uuid) from public,anon;
grant execute on function public.abandon_canva_publish(uuid,uuid) to authenticated;

-- Admin-only cleanup. This function never references canonical app or storage tables.
create function canva_private.cleanup_temporary_records() returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.canva_authorization_codes where consumed_at is not null or expires_at<clock_timestamp();
  delete from canva_private.rate_events where occurred_at<clock_timestamp()-interval '1 hour';
  delete from canva_private.publish_requests
    where (status='completed' and completed_at<clock_timestamp()-interval '24 hours')
       or (status='pending' and lease_until<clock_timestamp()-interval '24 hours');
end $$;
revoke all on function canva_private.cleanup_temporary_records() from public,anon,authenticated;
