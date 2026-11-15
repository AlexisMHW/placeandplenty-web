-- 20261114217400_hc_paid_referral_windows.sql   (agent S2, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- FOUNDER DECISION D-3 (final): NO RETROACTIVE ACCRUAL. A purchase made while paid referrals were DISABLED must never accrue a commission, even after paid
-- referrals are activated later. This migration records WHEN paid referrals were ON, append-only; 217410 makes reconcile/maintenance obey it.
--   * public.hc_paid_referral_windows: one row per ON interval [started_at, ended_at). ended_at is NULL while the switch is ON.
--       - append-only: no DELETE, no TRUNCATE, no UPDATE except the one-time seal of an open window (ended_at NULL -> value >= started_at, nothing else changes)
--       - at most ONE open window (partial unique index)
--       - no API grants (service_role SELECT only); written only by the trigger below (SECURITY DEFINER)
--   * trigger hc_settings_paid_referral_window (AFTER INSERT / UPDATE OF paid_referrals_enabled ON hc_settings): opens a window when the switch turns ON and
--     seals it when it turns OFF. hc_activate_paid_referrals / hc_deactivate_paid_referrals flip that column, so every path (the two functions, direct service-role SQL)
--     is recorded; there is no way to turn the switch on or off without a window row.
--   * public.hc_paid_referrals_on_at(timestamptz): true iff the instant lies inside an ON window. Boundary rule: started_at is INCLUDED, ended_at is EXCLUDED
--     (a purchase exactly at the activation instant qualifies; exactly at the deactivation instant it does not). Purchases before the first activation: false.
--   * backfill: if the switch is already ON and no window exists, one open window is created starting at paid_referrals_activated_at (or now() when unknown).
--     On QA / production paid referrals are OFF, so nothing is created there.
-- Already-created commission rows are NOT touched. Approved economics are NOT touched. Idempotent. Rollback: ROLLBACK_217400.sql (roll 217410 back first).
do $$ begin
  if to_regclass('public.hc_settings') is null or to_regprocedure('public.hc_append_only_guard()') is null then raise exception 'dependency_missing: hc_settings / hc_append_only_guard (214000, 216100)'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'hc_settings' and column_name = 'paid_referrals_enabled') then raise exception 'dependency_missing: hc_settings.paid_referrals_enabled (216100)'; end if;
end $$;

create table if not exists public.hc_paid_referral_windows (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  ended_at timestamptz,
  started_by uuid,
  ended_by uuid,
  start_reason text,
  end_reason text,
  created_at timestamptz not null default now(),
  constraint hc_paid_referral_windows_order_chk check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists hc_paid_referral_windows_one_open_uq on public.hc_paid_referral_windows ((true)) where ended_at is null;
create index if not exists hc_paid_referral_windows_started_idx on public.hc_paid_referral_windows (started_at);
alter table public.hc_paid_referral_windows enable row level security;
revoke all on public.hc_paid_referral_windows from public, anon, authenticated;
grant select on public.hc_paid_referral_windows to service_role;
revoke all on sequence public.hc_paid_referral_windows_id_seq from public, anon, authenticated;

create or replace function public.hc_paid_referral_windows_guard()
 returns trigger language plpgsql set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
     and old.ended_at is null and new.ended_at is not null and new.ended_at >= old.started_at
     and new.id = old.id and new.started_at = old.started_at and new.started_by is not distinct from old.started_by
     and new.start_reason is not distinct from old.start_reason and new.created_at = old.created_at then
    return new;     -- the one allowed change: seal an open window
  end if;
  raise exception 'hc_ledger_is_append_only' using errcode = 'P0001';
end;
$function$;
revoke execute on function public.hc_paid_referral_windows_guard() from public, anon, authenticated;

drop trigger if exists hc_paid_referral_windows_append_only on public.hc_paid_referral_windows;
create trigger hc_paid_referral_windows_append_only before update or delete on public.hc_paid_referral_windows
  for each row execute function public.hc_paid_referral_windows_guard();
drop trigger if exists hc_paid_referral_windows_no_truncate on public.hc_paid_referral_windows;
create trigger hc_paid_referral_windows_no_truncate before truncate on public.hc_paid_referral_windows
  for each statement execute function public.hc_append_only_guard();

create or replace function public.hc_record_paid_referral_window()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_actor uuid; v_reason text := nullif(current_setting('hc.audit_reason', true), '');
begin
  if tg_op = 'UPDATE' and new.paid_referrals_enabled is not distinct from old.paid_referrals_enabled then return null; end if;
  begin v_actor := auth.uid(); exception when others then v_actor := null; end;
  if coalesce(new.paid_referrals_enabled, false) then
    if not exists (select 1 from public.hc_paid_referral_windows where ended_at is null) then
      insert into public.hc_paid_referral_windows (started_at, started_by, start_reason) values (now(), v_actor, left(v_reason, 200));
    end if;
  else
    update public.hc_paid_referral_windows set ended_at = now(), ended_by = v_actor, end_reason = left(v_reason, 200) where ended_at is null;
  end if;
  return null;
end;
$function$;
revoke execute on function public.hc_record_paid_referral_window() from public, anon, authenticated;

drop trigger if exists hc_settings_paid_referral_window on public.hc_settings;
create trigger hc_settings_paid_referral_window after insert or update of paid_referrals_enabled on public.hc_settings
  for each row execute function public.hc_record_paid_referral_window();

create or replace function public.hc_paid_referrals_on_at(p_at timestamptz)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select p_at is not null and exists (
    select 1 from public.hc_paid_referral_windows w where w.started_at <= p_at and (w.ended_at is null or p_at < w.ended_at));
$function$;
revoke execute on function public.hc_paid_referrals_on_at(timestamptz) from public, anon, authenticated;
grant execute on function public.hc_paid_referrals_on_at(timestamptz) to service_role;

-- backfill (idempotent): switch already ON but no window recorded
insert into public.hc_paid_referral_windows (started_at, started_by, start_reason)
select coalesce(s.paid_referrals_activated_at, now()), s.paid_referrals_activated_by, 'backfill_at_217400'
  from public.hc_settings s
 where s.singleton and s.paid_referrals_enabled and not exists (select 1 from public.hc_paid_referral_windows);

comment on table public.hc_paid_referral_windows is 'Append-only record of when paid referrals were ON (founder decision D-3: no retroactive accrual). Written only by the hc_settings trigger.';
