-- 20261114217340_current_plus_term_service_guard.sql   (agent S, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- E-G2 (defence in depth): 205004 rewrote current_plus_term with the caller check relaxed to "auth.uid() is not null and p_user_id <> auth.uid()", so a call with no
-- identity at all (auth.uid() null) passed. Restores the original guard from 20260830175247:
--     auth.role() = 'service_role'  OR  (auth.uid() is not null AND p_user_id = auth.uid())
-- Results for permitted callers are identical (service role: any user; signed-in user: own id). The refund/revoke-safe row filter added in 205004 is kept untouched.
-- EXECUTE grants are unchanged (service_role only). Rollback: ROLLBACK_217340.sql (restores the 205004 body exactly).
do $$ begin
  if to_regprocedure('public.current_plus_term(uuid)') is null then raise exception 'dependency_missing: current_plus_term (205004)'; end if;
end $$;

CREATE OR REPLACE FUNCTION public.current_plus_term(p_user_id uuid)
 RETURNS TABLE(entitlement_id uuid, term_start timestamp with time zone, term_end timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.role() is distinct from 'service_role' and (auth.uid() is null or p_user_id is distinct from auth.uid()) then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  return query
  select ge.id, ge.purchased_at, coalesce(ge.expires_at, now() + interval '100 years')
    from gathering_entitlements ge
   where ge.user_id = p_user_id and ge.scope = 'account'
     and ge.entitlement_type = 'plus' and ge.active
     and ge.refunded_at is null and ge.revoked_at is null
     and (ge.expires_at is null or ge.expires_at > now())
   order by ge.purchased_at desc limit 1;
end;
$function$;
