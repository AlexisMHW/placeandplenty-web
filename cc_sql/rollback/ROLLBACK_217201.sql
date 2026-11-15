-- Rollback of 217201 (agent F). Drops each paper-order RPC ONLY if 217201 created it (comment marker). On production they pre-exist untagged: no-op there.
do $rb$
declare s text;
begin
  foreach s in array array['claim_my_paper_order_fulfillment(uuid)','release_my_paper_order_fulfillment(uuid,text)','mark_my_paper_order_submitted(uuid,text,text)','mark_my_paper_order_checkout_pending(uuid,text)'] loop
    if to_regprocedure('public.'||s) is not null
       and obj_description(to_regprocedure('public.'||s), 'pg_proc') = 'pp:217201:created-by-repo-migration' then
      execute 'drop function public.'||s;
    end if;
  end loop;
end
$rb$;
