-- 20261114217201_paper_order_fulfillment_rpcs.sql   (agent F, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- The four paper-order RPCs the web app calls (app/api/paper-suite/{checkout,fulfill}): claim_my_paper_order_fulfillment, release_my_paper_order_fulfillment,
-- mark_my_paper_order_submitted, mark_my_paper_order_checkout_pending. Owner decision 4: adopt the recovered QA snapshots as repo definitions after a read-only
-- comparison with production (pg_get_functiondef, 2026-11-14, iyvdxvotthwrerirdzwd). RESULT: the four production bodies, SECURITY DEFINER flag, search_path=public and
-- grants (authenticated + service_role, no anon, no PUBLIC) are identical to the QA snapshots (20261105000753/834/843/847) in behaviour; the text below is the
-- PRODUCTION pg_get_functiondef text verbatim, so applying it on production is a no-op (same body, same grants).
-- Behaviour (unchanged): every function raises not_authenticated without auth.uid() and acts only on rows with user_id = auth.uid(); returns true iff exactly one row changed.
-- State machine: quoted -> checkout_pending -> (webhook/service) paid -> fulfilling -> submitted; release returns fulfilling -> paid. No money moves here.
-- Needs public.paper_orders (217200). Idempotent (CREATE OR REPLACE). A function that did not exist before this file is tagged with a comment so ROLLBACK_217201 only drops
-- what this file created; on production (functions pre-exist, untagged) the rollback is a no-op.
-- Rollback: ROLLBACK_217201.sql

do $mig$
declare v_new boolean;
begin

  v_new := to_regprocedure('public.claim_my_paper_order_fulfillment(uuid)') is null;
  execute $ddl$CREATE OR REPLACE FUNCTION public.claim_my_paper_order_fulfillment(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.paper_orders
     set status = 'fulfilling',
         failure_reason = null,
         updated_at = now()
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'paid'
     and gelato_order_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$
$ddl$;
  execute 'revoke all on function public.claim_my_paper_order_fulfillment(uuid) from public, anon';
  execute 'grant execute on function public.claim_my_paper_order_fulfillment(uuid) to authenticated, service_role';
  if v_new then execute 'comment on function public.claim_my_paper_order_fulfillment(uuid) is ''pp:217201:created-by-repo-migration'''; end if;

  v_new := to_regprocedure('public.release_my_paper_order_fulfillment(uuid,text)') is null;
  execute $ddl$CREATE OR REPLACE FUNCTION public.release_my_paper_order_fulfillment(p_order_id uuid, p_failure_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.paper_orders
     set status = 'paid',
         failure_reason = left(nullif(trim(p_failure_reason), ''), 500),
         updated_at = now()
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'fulfilling'
     and gelato_order_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$
$ddl$;
  execute 'revoke all on function public.release_my_paper_order_fulfillment(uuid,text) from public, anon';
  execute 'grant execute on function public.release_my_paper_order_fulfillment(uuid,text) to authenticated, service_role';
  if v_new then execute 'comment on function public.release_my_paper_order_fulfillment(uuid,text) is ''pp:217201:created-by-repo-migration'''; end if;

  v_new := to_regprocedure('public.mark_my_paper_order_submitted(uuid,text,text)') is null;
  execute $ddl$CREATE OR REPLACE FUNCTION public.mark_my_paper_order_submitted(p_order_id uuid, p_gelato_order_id text, p_gelato_order_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_gelato_order_id is null or length(trim(p_gelato_order_id)) = 0 then
    raise exception 'invalid_gelato_order_id';
  end if;

  if p_gelato_order_type not in ('draft','order') then
    raise exception 'invalid_gelato_order_type';
  end if;

  update public.paper_orders
     set status = 'submitted',
         gelato_order_id = p_gelato_order_id,
         gelato_order_type = p_gelato_order_type,
         submitted_at = coalesce(submitted_at, now()),
         updated_at = now(),
         failure_reason = null
   where id = p_order_id
     and user_id = auth.uid()
     and status in ('paid','fulfilling','submitted')
     and (gelato_order_id is null or gelato_order_id = p_gelato_order_id);

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$
$ddl$;
  execute 'revoke all on function public.mark_my_paper_order_submitted(uuid,text,text) from public, anon';
  execute 'grant execute on function public.mark_my_paper_order_submitted(uuid,text,text) to authenticated, service_role';
  if v_new then execute 'comment on function public.mark_my_paper_order_submitted(uuid,text,text) is ''pp:217201:created-by-repo-migration'''; end if;

  v_new := to_regprocedure('public.mark_my_paper_order_checkout_pending(uuid,text)') is null;
  execute $ddl$CREATE OR REPLACE FUNCTION public.mark_my_paper_order_checkout_pending(p_order_id uuid, p_stripe_checkout_session_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_stripe_checkout_session_id is null or length(trim(p_stripe_checkout_session_id)) = 0 then
    raise exception 'invalid_checkout_session_id';
  end if;

  update public.paper_orders
     set status = 'checkout_pending',
         stripe_checkout_session_id = p_stripe_checkout_session_id,
         updated_at = now()
   where id = p_order_id
     and user_id = auth.uid()
     and status in ('quoted','checkout_pending')
     and (stripe_checkout_session_id is null or stripe_checkout_session_id = p_stripe_checkout_session_id);

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$
$ddl$;
  execute 'revoke all on function public.mark_my_paper_order_checkout_pending(uuid,text) from public, anon';
  execute 'grant execute on function public.mark_my_paper_order_checkout_pending(uuid,text) to authenticated, service_role';
  if v_new then execute 'comment on function public.mark_my_paper_order_checkout_pending(uuid,text) is ''pp:217201:created-by-repo-migration'''; end if;
end
$mig$;
