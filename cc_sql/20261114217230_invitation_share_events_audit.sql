-- 20261114217230_invitation_share_events_audit.sql   (agent F, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- Based on 20261111208000_qa_invitation_share_events.sql (Track SMS-A). Owner decision 2: append-only audit table + RPC restricted to people who can MANAGE invitations
-- (owner, or co-host with can_manage_invitations), implementing the TODO in 208000. Deviation from 208000: is_accepted_gathering_member -> can_manage_invitations in BOTH the RPC and the SELECT policy.
-- Fail closed: no auth.uid(), or can_manage_invitations false/null (view-only co-host, guest, stranger) -> P0001 not_authorized; nothing is written.
-- Purpose unchanged: records that a host OPENED a hand-off (own messaging app / share sheet / copy link) for one household; never sent/delivered/read. No SMS is sent or enabled.
-- Append-only: no UPDATE/DELETE grant for any client role and no update/delete policy; writes only through the RPC. Does not touch invitation_parties.first_share_initiated_at.
-- Behaviour kept from 208000: invalid_channel, locale falls back to 'en', party_not_in_gathering, assert_gathering_not_archived, 60-second idempotency (same actor+party+channel returns the existing id).
-- Depends on: gatherings, invitation_parties, can_manage_invitations (202001_r1), assert_gathering_not_archived. Additive; production lacks the table.
-- Idempotent. Rollback: ROLLBACK_217230.sql (drops the audit table and function: audit rows are lost on rollback).

create table if not exists public.invitation_share_events (
  id                  uuid primary key default gen_random_uuid(),
  gathering_id        uuid not null references public.gatherings(id) on delete cascade,
  invitation_party_id uuid not null references public.invitation_parties(id) on delete cascade,
  actor_user_id       uuid references auth.users(id) on delete set null,
  channel             text not null check (channel in ('sms_native','sms_web','share_sheet','copy_link')),
  locale              text check (locale in ('en','es')),
  created_at          timestamptz not null default now()
);

create index if not exists invitation_share_events_party_idx
  on public.invitation_share_events (gathering_id, invitation_party_id, created_at desc);

alter table public.invitation_share_events enable row level security;

drop policy if exists "Members read share events" on public.invitation_share_events;
drop policy if exists "Invitation managers read share events" on public.invitation_share_events;
create policy "Invitation managers read share events" on public.invitation_share_events
  for select to authenticated
  using (public.can_manage_invitations(gathering_id));

revoke all on public.invitation_share_events from public, anon, authenticated;
grant select on public.invitation_share_events to authenticated;
grant all on public.invitation_share_events to service_role;

create or replace function public.record_invitation_share_initiated(
  p_gathering_id uuid,
  p_invitation_party_id uuid,
  p_channel text,
  p_locale text default 'en'
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_party_gathering uuid;
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if not coalesce(public.can_manage_invitations(p_gathering_id), false) then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_channel is null or p_channel not in ('sms_native','sms_web','share_sheet','copy_link') then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  if p_locale is not null and p_locale not in ('en','es') then
    p_locale := 'en';
  end if;

  select gathering_id into v_party_gathering
    from public.invitation_parties where id = p_invitation_party_id;
  if v_party_gathering is null or v_party_gathering <> p_gathering_id then
    raise exception 'party_not_in_gathering' using errcode = 'P0001';
  end if;

  -- Archived gatherings stay read-only (same helper the lifecycle guards use).
  perform public.assert_gathering_not_archived(p_gathering_id);

  -- Idempotent against double taps and client retries: same actor, party and channel within 60 s returns the existing row.
  select id into v_existing
    from public.invitation_share_events
   where invitation_party_id = p_invitation_party_id
     and actor_user_id = auth.uid()
     and channel = p_channel
     and created_at > now() - interval '60 seconds'
   order by created_at desc
   limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.invitation_share_events (gathering_id, invitation_party_id, actor_user_id, channel, locale)
  values (p_gathering_id, p_invitation_party_id, auth.uid(), p_channel, p_locale)
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.record_invitation_share_initiated(uuid, uuid, text, text) from public, anon;
grant execute on function public.record_invitation_share_initiated(uuid, uuid, text, text) to authenticated, service_role;

comment on function public.record_invitation_share_initiated(uuid, uuid, text, text) is
  'Audit that a host (owner or co-host who can manage invitations) opened a text/share/copy hand-off for one invitation party. Not a delivery record.';
