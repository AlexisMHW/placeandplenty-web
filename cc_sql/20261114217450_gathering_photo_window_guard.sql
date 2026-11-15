-- 20261114217450_gathering_photo_window_guard.sql   (agent S2, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- FOUNDER DECISION D-4 (final): completed gatherings are read-only for everything EXCEPT authorized photo uploads inside the EXISTING guest photo-sharing window.
-- The window is NOT invented here. It is the one the app already uses everywhere (guest-photo-upload edge function -> gathering_photos_are_editable, the "Members ... while open"
-- RLS policies, add_gathering_photo / set_gathering_photo_hidden / delete_gathering_photo, gathering_photo_expiry for the 30-day retention):
--     open  <=>  gathering status not archived/cancelled  AND  now() < public.gathering_lifecycle_ends_at(gathering)      (lifecycle_ends_at = event end + 30 days, 205/200000 definition)
-- so the boundary instant itself is CLOSED (identical to every existing guard). Nothing about that definition is changed.
-- 202100 (enforce_terminal_read_only, trg_terminal_read_only) is NOT edited: its 'photos' class still defers completed gatherings to the existing rule and blocks cancelled for
-- signed-in users. This migration adds ONE extra BEFORE trigger on gathering_photos only (trg_gathering_photo_window), so the database itself enforces the window:
--   cancelled gathering ........ INSERT / UPDATE refused for EVERY caller incl. service role (edge functions); DELETE refused for signed-in users (service role DELETE = purge/cron, allowed)
--   completed, inside window ... INSERT allowed (authorization stays with the existing RLS / RPC / edge-function checks); DELETE allowed (existing member delete); UPDATE only of the
--                                moderation columns hidden_at / hidden_by (existing set_gathering_photo_hidden), nothing else
--   completed, window closed ... INSERT / UPDATE refused for every caller; DELETE refused for signed-in users; service-role DELETE (retention purge, account deletion) still allowed
--   any other status ........... not touched (archived keeps its existing strict trigger)
-- Everything else on completed gatherings (menu, shopping, budget, invitations, schedule, people, guest experience, ...) stays read-only with NO exception: those tables are untouched.
-- Honours the same switches as 202100: lifecycle_read_only_config 'off' (kill switch) or 'cancelled' (completed not enforced), and the canonical lifecycle-transition marker.
-- Ordering: applied BEFORE 202100. Until 202100 exists lifecycle_read_only_level() is absent and the trigger does nothing (behaviour identical to today); after 202100 it is live.
-- Error: P0001 'gathering_read_only' (same code as 202100), detail = 'cancelled' | 'completed', hint = 'photo_window_closed' for the completed case.
-- Idempotent. Rollback: ROLLBACK_217450.sql (drops trigger + function).
do $$ begin
  if to_regclass('public.gathering_photos') is null or to_regprocedure('public.gathering_lifecycle_ends_at(uuid)') is null or to_regprocedure('public.effective_gathering_status(uuid)') is null then
    raise exception 'dependency_missing: gathering_photos / gathering_lifecycle_ends_at / effective_gathering_status';
  end if;
end $$;

create or replace function public.enforce_gathering_photo_window() returns trigger
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_level text; v_gid uuid; v_eff text; v_ends timestamptz; v_marker text := current_setting('placeandplenty.lifecycle_transition', true);
  v_row_new jsonb; v_row_old jsonb; k text;
  v_moderation constant text[] := array['hidden_at','hidden_by'];
begin
  if coalesce(v_marker, '') <> '' then return case when tg_op = 'DELETE' then old else new end; end if;
  if to_regprocedure('public.lifecycle_read_only_level()') is null then return case when tg_op = 'DELETE' then old else new end; end if;   -- 202100 not applied yet: inert
  v_level := public.lifecycle_read_only_level();
  if v_level = 'off' then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' and auth.uid() is null then return old; end if;     -- retention purge / account deletion / cron (service role) keep working
  v_gid := case when tg_op = 'DELETE' then old.gathering_id else new.gathering_id end;
  if v_gid is null then return case when tg_op = 'DELETE' then old else new end; end if;
  v_eff := public.effective_gathering_status(v_gid)::text;
  if v_eff = 'cancelled' then
    raise exception 'gathering_read_only' using errcode = 'P0001', detail = 'cancelled';
  end if;
  if v_eff = 'completed' and v_level = 'terminal' then
    v_ends := public.gathering_lifecycle_ends_at(v_gid);
    if v_ends is null or not (now() < v_ends) then
      raise exception 'gathering_read_only' using errcode = 'P0001', detail = 'completed', hint = 'photo_window_closed';
    end if;
    if tg_op = 'UPDATE' then
      v_row_new := to_jsonb(new); v_row_old := to_jsonb(old);
      for k in select jsonb_object_keys(v_row_new) loop
        if v_row_new->k is distinct from v_row_old->k and not (k = any (v_moderation)) then
          raise exception 'gathering_read_only' using errcode = 'P0001', detail = 'completed', hint = 'photo_fields_read_only';
        end if;
      end loop;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;
revoke execute on function public.enforce_gathering_photo_window() from public, anon, authenticated;

drop trigger if exists trg_gathering_photo_window on public.gathering_photos;
create trigger trg_gathering_photo_window before insert or update or delete on public.gathering_photos
  for each row execute function public.enforce_gathering_photo_window();
