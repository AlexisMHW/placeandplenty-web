-- 20261114217210_get_multi_day_entitlement_state.sql   (agent F, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- Faithful copy of the function body and grants of 20261111203002_qa_get_multi_day_entitlement_state.sql (ENTITLEMENT-DB, 2026-11-13). Nothing added, nothing changed.
-- Read-only getter used by web lib/multi-day-actions.ts (getMultiDayPassStep, feature-detected: errors are ignored). Returns {state: active|read_only|none, canEdit, canViewHistory}.
-- Grants nothing, changes nothing, enables nothing; multi-day stays inactive/unsold. Fail closed: 42501 not_authorized for anon / no uid / non-members.
-- Caveat (unchanged from 203002): state 'read_only' is informational unless 203000 is applied (not in this package).
-- Depends on baseline: is_accepted_gathering_member, gathering_has_multi_day_access, gathering_days, gathering_activities.
-- Idempotent (CREATE OR REPLACE). Rollback: ROLLBACK_217210.sql
CREATE OR REPLACE FUNCTION public.get_multi_day_entitlement_state(p_gathering_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_active boolean;
  v_history boolean;
begin
  if auth.uid() is null or not public.is_accepted_gathering_member(p_gathering_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_active := coalesce(public.gathering_has_multi_day_access(p_gathering_id), false);
  v_history := exists (select 1 from public.gathering_days d where d.gathering_id = p_gathering_id)
            or exists (select 1 from public.gathering_activities a where a.gathering_id = p_gathering_id);
  return jsonb_build_object(
    'state', case when v_active then 'active' when v_history then 'read_only' else 'none' end,
    'canEdit', v_active,
    'canViewHistory', v_active or v_history
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_multi_day_entitlement_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_multi_day_entitlement_state(uuid) TO authenticated, service_role;
