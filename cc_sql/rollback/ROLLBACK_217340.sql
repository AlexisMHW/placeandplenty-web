-- Rollback of 217340 (agent S): restores the 205004 current_plus_term body exactly (relaxed caller check). Grants untouched. No data is touched.
CREATE OR REPLACE FUNCTION public.current_plus_term(p_user_id uuid)
 RETURNS TABLE(entitlement_id uuid, term_start timestamp with time zone, term_end timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
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
