-- ROLLBACK_217201_CORRECTED.sql  (follow-up J; replaces ROLLBACK_217201.sql. PROPOSED, NOT APPLIED)
-- D3 of REPORT_r-rehearsal: on QA the paper-order functions pre-exist (untagged) and 217201 re-formats three of them (whitespace only); the shipped rollback left the new text in place.
-- 1. A function 217201 CREATED (tagged pp:217201:created-by-repo-migration) is dropped, as before.
-- 2. A pre-existing function is put back to QA's captured text verbatim (md5 of pg_get_functiondef, first 12 chars, is asserted). claim_my_paper_order_fulfillment is not changed by 217201.
-- Grants are untouched (CREATE OR REPLACE keeps them). Atomic: any assertion failure aborts everything.
do $rb$
declare s text; r record; v_got text;
begin
  foreach s in array array['claim_my_paper_order_fulfillment(uuid)','release_my_paper_order_fulfillment(uuid,text)','mark_my_paper_order_submitted(uuid,text,text)','mark_my_paper_order_checkout_pending(uuid,text)'] loop
    if to_regprocedure('public.'||s) is not null
       and obj_description(to_regprocedure('public.'||s), 'pg_proc') = 'pp:217201:created-by-repo-migration' then
      execute 'drop function public.'||s;
    end if;
  end loop;
  for r in select * from (values
    ('release_my_paper_order_fulfillment', $qa_body$CREATE OR REPLACE FUNCTION public.release_my_paper_order_fulfillment(p_order_id uuid, p_failure_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_updated integer;
begin
if auth.uid() is null then raise exception 'not_authenticated';end if;
update public.paper_orders set status='paid',failure_reason=left(nullif(trim(p_failure_reason),''),500),updated_at=now()
where id=p_order_id and user_id=auth.uid() and status='fulfilling' and gelato_order_id is null;
get diagnostics v_updated=row_count;return v_updated=1;
end;$function$
;$qa_body$, 'bb017df75a77'),
    ('mark_my_paper_order_submitted', $qa_body$CREATE OR REPLACE FUNCTION public.mark_my_paper_order_submitted(p_order_id uuid, p_gelato_order_id text, p_gelato_order_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_updated integer;
begin
if auth.uid() is null then raise exception 'not_authenticated';end if;
if p_gelato_order_id is null or length(trim(p_gelato_order_id))=0 then raise exception 'invalid_gelato_order_id';end if;
if p_gelato_order_type not in ('draft','order') then raise exception 'invalid_gelato_order_type';end if;
update public.paper_orders set status='submitted',gelato_order_id=p_gelato_order_id,gelato_order_type=p_gelato_order_type,submitted_at=coalesce(submitted_at,now()),updated_at=now(),failure_reason=null
where id=p_order_id and user_id=auth.uid() and status in ('paid','fulfilling','submitted') and (gelato_order_id is null or gelato_order_id=p_gelato_order_id);
get diagnostics v_updated=row_count;return v_updated=1;
end;$function$
;$qa_body$, '82f5ec79559c'),
    ('mark_my_paper_order_checkout_pending', $qa_body$CREATE OR REPLACE FUNCTION public.mark_my_paper_order_checkout_pending(p_order_id uuid, p_stripe_checkout_session_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_updated integer;
begin
if auth.uid() is null then raise exception 'not_authenticated';end if;
if p_stripe_checkout_session_id is null or length(trim(p_stripe_checkout_session_id))=0 then raise exception 'invalid_checkout_session_id';end if;
update public.paper_orders set status='checkout_pending',stripe_checkout_session_id=p_stripe_checkout_session_id,updated_at=now()
where id=p_order_id and user_id=auth.uid() and status in ('quoted','checkout_pending') and (stripe_checkout_session_id is null or stripe_checkout_session_id=p_stripe_checkout_session_id);
get diagnostics v_updated=row_count;return v_updated=1;
end;$function$
;$qa_body$, '25e144a29b8d')
  ) x(fn, def, md5_12)
  loop
    if exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=r.fn) then   -- not dropped above (217201 did not create it)
      execute r.def;
      select left(md5(pg_get_functiondef(p.oid)),12) into v_got from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=r.fn;
      if v_got <> r.md5_12 then raise exception 'rollback: % md5 % <> captured QA %', r.fn, v_got, r.md5_12; end if;
    end if;
  end loop;
end
$rb$;
