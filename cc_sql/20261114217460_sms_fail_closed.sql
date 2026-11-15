-- 20261114217460_sms_fail_closed.sql   (agent S2, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- FOUNDER REQUIREMENT (final): SMS stays FULLY suppressed, including when the suppression function / config rows are missing or unreadable.
-- Gap found: public.is_contact_suppressed('sms', hash) (213001; the coordinator wrote "channel_is_suppressed", the real name is is_contact_suppressed) returned FALSE
-- ("not suppressed") when public.sms_is_suppressed(text) does not exist, and coalesce(v,false) on NULL: fail-OPEN for SMS.
-- This migration (1) makes the SMS branch fail-CLOSED, (2) adds one DB-level safety net so that, whatever a worker function does, no sms_messages row can become
-- deliverable (inserted/updated as 'queued' or moved to 'sending') unless SMS is explicitly enabled in sms_config AND the recipient is provably not suppressed.
-- It never enables SMS and never changes a config value (sms_enabled=false, kill_switch=true stay as shipped in 209000).
--   * fail-closed config: SMS is "on" only if sms_config has sms_enabled = true AND kill_switch = false (both rows present and parseable). Missing table/rows, bad value,
--     any exception => OFF.
--   * fail-closed suppression: TRUE (suppressed) when sms_is_suppressed is missing, raises, or returns NULL; the email branch is unchanged.
--   * sms_messages guard (trigger trg_sms_messages_fail_closed): refuses INSERT with status queued/sending, and UPDATE that sets status = 'sending' (the claim), with
--     P0001 'sms_unavailable' when SMS is off, or 'sms_recipient_suppressed' when suppression is true/unevaluable. Provider-callback updates of messages that were already
--     sent (submitted/sent/delivered/failed/blocked_*), and re-queue of 'sending' -> 'queued' (never deliverable until a guarded claim) stay allowed.
-- Idempotent. Rollback: ROLLBACK_217460.sql (restores the 213001 body of is_contact_suppressed, drops the trigger and the two helpers).
do $$ begin
  if to_regclass('public.sms_messages') is null or to_regclass('public.sms_config') is null or to_regprocedure('public.is_contact_suppressed(text,text)') is null then
    raise exception 'sms foundation (209000) and is_contact_suppressed (213001) must exist first' using errcode = 'P0001';
  end if;
end $$;

-- 1. Config gate, fail-closed. Internal helper (service_role / definer callers only).
create or replace function public.sms_config_allows_delivery() returns boolean
language plpgsql stable security definer set search_path to ''
as $function$
declare v_en boolean; v_ks boolean;
begin
  begin
    select (value #>> '{}')::boolean into v_en from public.sms_config where key = 'sms_enabled';
    select (value #>> '{}')::boolean into v_ks from public.sms_config where key = 'kill_switch';
  exception when others then
    return false;
  end;
  return coalesce(v_en, false) and not coalesce(v_ks, true);
end;
$function$;

-- 2. Suppression, fail-closed (no auth check: used by the trigger and by is_contact_suppressed).
create or replace function public.sms_suppressed_failclosed(p_hash text) returns boolean
language plpgsql stable security definer set search_path to ''
as $function$
declare v boolean;
begin
  if p_hash is null or to_regprocedure('public.sms_is_suppressed(text)') is null then
    return true;
  end if;
  begin
    execute 'select public.sms_is_suppressed($1)' into v using p_hash;
  exception when others then
    return true;
  end;
  return coalesce(v, true);
end;
$function$;

create or replace function public.is_contact_suppressed(p_channel text, p_hash text) returns boolean
language plpgsql security definer set search_path to ''
as $function$
declare v boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_channel = 'email' then
    return public.email_is_suppressed(p_hash);
  elsif p_channel = 'sms' then
    -- FAIL-CLOSED (217460): missing function, exception or NULL all read as suppressed.
    return public.sms_suppressed_failclosed(p_hash);
  end if;
  raise exception 'invalid_channel' using errcode = 'P0001';
end;
$function$;

-- 3. Table-level safety net.
create or replace function public.sms_messages_fail_closed() returns trigger
language plpgsql security definer set search_path to ''
as $function$
begin
  if (tg_op = 'INSERT' and new.status in ('queued','sending'))
     or (tg_op = 'UPDATE' and new.status = 'sending' and old.status is distinct from 'sending') then
    if not public.sms_config_allows_delivery() then
      raise exception 'sms_unavailable' using errcode = 'P0001';
    end if;
    if public.sms_suppressed_failclosed(new.phone_hash) then
      raise exception 'sms_recipient_suppressed' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sms_messages_fail_closed on public.sms_messages;
create trigger trg_sms_messages_fail_closed before insert or update on public.sms_messages
  for each row execute function public.sms_messages_fail_closed();

revoke execute on function public.sms_config_allows_delivery(), public.sms_suppressed_failclosed(text), public.sms_messages_fail_closed() from public, anon, authenticated;
grant  execute on function public.sms_config_allows_delivery(), public.sms_suppressed_failclosed(text) to service_role;
revoke execute on function public.is_contact_suppressed(text,text) from public, anon, authenticated;
grant  execute on function public.is_contact_suppressed(text,text) to service_role;
