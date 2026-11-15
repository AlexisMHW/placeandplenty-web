-- 20261114202101_lifecycle_terminal_read_only_receipts_fix.sql   (agent G, 2026-11-14)   PROPOSED - NOT APPLIED ANYWHERE.
-- Completes 20261114202100 (read-only enforcement stays the final MEANING of the package; this file is the very last step and only repairs one trigger).
-- DEFECT (found by S2 test V6.8, reproduced by agent G): 202100 attaches trg_terminal_read_only_strict (function enforce_terminal_read_only) to
--   public.guest_update_receipts, but that table has NO gathering_id column (columns: guest_update_id, invitation_party_id, guest_id, seen_at,
--   acknowledged_at, ...). The shared function reads NEW.gathering_id, so EVERY insert/update raised 42703 ('record "old" has no field "gathering_id"'),
--   which broke the guest "seen" / "acknowledge" receipts for ACTIVE gatherings too.
-- FIX: a dedicated trigger function for this one table that derives the gathering through the table's real relationships:
--     guest_update_receipts.guest_update_id     -> guest_updates.gathering_id
--     guest_update_receipts.invitation_party_id -> invitation_parties.gathering_id
--   (both links are checked, old and new row on UPDATE, so a receipt can never be written for - or moved onto - a completed/cancelled gathering).
--   Semantics are IDENTICAL to enforce_terminal_read_only for class 'none' + 'strict' (founder decision D2, no exceptions):
--     kill switch off => allowed; canonical lifecycle-transition marker => allowed; the service role / edge functions (auth.uid() null) are NOT bypassed
--     for INSERT/UPDATE (strict); completed is enforced only at level 'terminal'; completed AND cancelled raise gathering_read_only (P0001, detail = status).
--   The 30-day photo window exception is NOT applicable here (it exists only for gathering_photos, trigger trg_gathering_photo_window, untouched).
-- Why a NEW step instead of editing 202100: 202100's bytes/checksum stay exactly as reviewed and tested; the shared enforce_terminal_read_only() function
--   (md5 asserted by earlier suites) and the 28 other triggers are untouched, so the blast radius is one trigger; an environment that already ran 202100
--   still receives the fix (an edited migration would never re-run); the rollback is exact (restores the 202100 state).
-- Idempotent. Requires 202100.
do $pre$
begin
  if to_regprocedure('public.lifecycle_read_only_level()') is null or to_regprocedure('public.enforce_terminal_read_only()') is null then
    raise exception '202101 requires 20261114202100 (lifecycle_read_only_level / enforce_terminal_read_only missing)';
  end if;
end $pre$;

create or replace function public.enforce_terminal_read_only_receipts() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_level text := public.lifecycle_read_only_level();
  v_marker text := current_setting('placeandplenty.lifecycle_transition', true);
  v_gids uuid[] := array[]::uuid[]; v_gid uuid; v_eff text; v_upd uuid; v_party uuid; v_upd_old uuid; v_party_old uuid;
begin
  if v_level = 'off' or coalesce(v_marker,'') <> '' then return new; end if;
  -- the table's real links to a gathering (NEW and, on UPDATE, OLD): the guest update's gathering and the invitation party's gathering.
  -- (OLD is only referenced inside the UPDATE branch: in an INSERT trigger it is unassigned.)
  v_upd := new.guest_update_id; v_party := new.invitation_party_id;
  if tg_op = 'UPDATE' then v_upd_old := old.guest_update_id; v_party_old := old.invitation_party_id; end if;
  select coalesce(array_agg(distinct g), array[]::uuid[]) into v_gids from (
    select gu.gathering_id g from public.guest_updates gu where gu.id in (v_upd, v_upd_old)
    union all select ip.gathering_id from public.invitation_parties ip where ip.id in (v_party, v_party_old)
  ) s where g is not null;
  foreach v_gid in array v_gids loop
    v_eff := public.effective_gathering_status(v_gid)::text;
    if v_eff is null or v_eff not in ('cancelled','completed') then continue; end if;   -- active/draft/archived: archived stays with the existing triggers
    if v_eff = 'completed' and v_level <> 'terminal' then continue; end if;
    raise exception 'gathering_read_only' using errcode = 'P0001', detail = v_eff;
  end loop;
  return new;
end $function$;
revoke all on function public.enforce_terminal_read_only_receipts() from public, anon, authenticated;

do $att$
begin
  if to_regclass('public.guest_update_receipts') is null then raise notice 'skip missing table guest_update_receipts'; return; end if;   -- same tolerance as 202100
  drop trigger if exists trg_terminal_read_only_strict on public.guest_update_receipts;
  create trigger trg_terminal_read_only_strict before insert or update on public.guest_update_receipts
    for each row execute function public.enforce_terminal_read_only_receipts();
end $att$;
comment on function public.enforce_terminal_read_only_receipts() is 'D2 read-only guard for guest_update_receipts (no gathering_id column): derives the gathering via guest_updates / invitation_parties. Same semantics as enforce_terminal_read_only(none, strict). Added by 202101.';
