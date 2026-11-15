-- Rollback of 217460 (agent S2): restores the 213001 body of is_contact_suppressed (SMS branch back to the original behaviour), drops the sms_messages trigger and the two helpers.
drop trigger if exists trg_sms_messages_fail_closed on public.sms_messages;
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
    if to_regprocedure('public.sms_is_suppressed(text)') is null then
      return false;
    end if;
    execute 'select public.sms_is_suppressed($1)' into v using p_hash;
    return coalesce(v, false);
  end if;
  raise exception 'invalid_channel' using errcode = 'P0001';
end;
$function$;
drop function if exists public.sms_messages_fail_closed();
drop function if exists public.sms_suppressed_failclosed(text);
drop function if exists public.sms_config_allows_delivery();
