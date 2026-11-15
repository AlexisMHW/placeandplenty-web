-- Agent F suite for 217200..217240 (scratch Postgres only). Runs after harness.sql on the baseline-replay chain with ALL 46 steps applied.
-- The runner (run_tf.sh) first makes auth.uid()/auth.role() read request.jwt.claims and adds the auth.users columns production has (is_anonymous, deleted_at, last_sign_in_at).
create or replace function t.fx_gathering(p_owner uuid, p_name text default 'fx') returns uuid language plpgsql as $f$
declare g uuid := gen_random_uuid(); begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time) values (g, p_owner, p_name, 'dinner', current_date + 30, '18:00');
  return g; end $f$;
create or replace function t.fx_gathering_md(p_owner uuid) returns uuid language plpgsql as $f$
declare g uuid := gen_random_uuid(); begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time, duration_type, gathering_end_date) values (g, p_owner, 'fxmd', 'dinner', current_date + 30, '18:00', 'multi_day', current_date + 32);
  return g; end $f$;
create or replace function t.fx_member(p_g uuid, p_user uuid, p_level text) returns void language plpgsql as $f$
begin insert into public.gathering_members(gathering_id,user_id,invited_email,status,permission_level,accepted_at) values (p_g,p_user,p_user||'@example.test','accepted',p_level,now()); end $f$;
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;

-- ===================== 217200 paper_orders table =====================
do $$
declare a uuid:=t.mkuser(); b uuid:=t.mkuser(); g uuid; gb uuid; r text;
begin
 g := t.fx_gathering(a); gb := t.fx_gathering(b);
 perform t.eq('T1 paper_orders exists with 36 columns', (select count(*) from information_schema.columns where table_schema='public' and table_name='paper_orders')::text, '36');
 perform t.eq('T2 RLS enabled', (select relrowsecurity from pg_class where oid='public.paper_orders'::regclass), 'true');
 perform t.eq('T3 anon has no privilege on paper_orders', (has_table_privilege('anon','public.paper_orders','select') or has_table_privilege('anon','public.paper_orders','insert'))::text, 'false');
 perform t.eq('T4 authenticated: select+insert only (no update/delete)', (has_table_privilege('authenticated','public.paper_orders','select') and has_table_privilege('authenticated','public.paper_orders','insert') and not has_table_privilege('authenticated','public.paper_orders','update') and not has_table_privilege('authenticated','public.paper_orders','delete'))::text, 'true');
 perform t.eq('T5 exactly 2 policies (select-own, insert-own-quoted), production names', (select string_agg(polname,'|' order by polname) from pg_policy where polrelid='public.paper_orders'::regclass), 'Users create their own paper order intents|Users see their own paper orders');
 perform t.eq('T6 6 indexes as production (pkey, 3 unique, 2 lookup)', (select count(*) from pg_indexes where schemaname='public' and tablename='paper_orders')::text, '6');
 perform t.eq('T7 status check lists all 10 states', (select pg_get_constraintdef(oid) like '%quoted%checkout_pending%paid%fulfilling%submitted%in_production%shipped%delivered%cancelled%failed%' from pg_constraint where conname='paper_orders_status_check'), 'true');
 r := t.x(a,'authenticated', format($q$insert into public.paper_orders(user_id,gathering_id,piece_type,size_id,template_id,product_uid,quantity,print_file_url,shipping_address,gelato_quote,gelato_cost_cents,retail_subtotal_cents,order_reference_id) values (%L,%L,'invite','s','t','p',10,'u','{}','{}',100,200,'ref-a1')$q$, a, g));
 perform t.eq('T8 owner can insert own quoted order', r, 'ok');
 r := t.x(a,'authenticated', format($q$insert into public.paper_orders(user_id,gathering_id,status,piece_type,size_id,template_id,product_uid,quantity,print_file_url,shipping_address,gelato_quote,gelato_cost_cents,retail_subtotal_cents,order_reference_id) values (%L,%L,'paid','invite','s','t','p',10,'u','{}','{}',100,200,'ref-a2')$q$, a, g));
 perform t.lk('T9 client cannot insert a paid order (RLS)', r, 'ERR 42501%');
 r := t.x(a,'authenticated', format($q$insert into public.paper_orders(user_id,gathering_id,piece_type,size_id,template_id,product_uid,quantity,print_file_url,shipping_address,gelato_quote,gelato_cost_cents,retail_subtotal_cents,order_reference_id) values (%L,%L,'invite','s','t','p',10,'u','{}','{}',100,200,'ref-a3')$q$, b, gb));
 perform t.lk('T10 client cannot insert an order for another user (RLS)', r, 'ERR 42501%');
 r := t.x(a,'authenticated', 'update public.paper_orders set status=''paid''');
 perform t.lk('T11 client cannot update orders (no grant)', r, 'ERR 42501%');
 perform t.eq('T12 owner sees only own orders; other user sees none', t.q(a,'authenticated','select count(*) from public.paper_orders')||'/'||t.q(b,'authenticated','select count(*) from public.paper_orders'), '1/0');
 perform t.eq('T13 anon cannot read paper_orders', t.q(null,'anon','select count(*) from public.paper_orders') like 'ERR 42501%', 'true');
end $$;

-- ===================== 217201 four paper-order RPCs =====================
do $$
declare a uuid:=t.mkuser(); b uuid:=t.mkuser(); g uuid; o uuid; r text;
begin
 g := t.fx_gathering(a);
 insert into public.paper_orders(user_id,gathering_id,piece_type,size_id,template_id,product_uid,quantity,print_file_url,shipping_address,gelato_quote,gelato_cost_cents,retail_subtotal_cents,order_reference_id)
   values (a,g,'invite','s','t','p',10,'u','{}','{}',100,200,'ref-sm') returning id into o;
 -- production parity (md5 of pg_get_functiondef read from production iyvdxvotthwrerirdzwd on 2026-11-14, catalog query only)
 perform t.eq('R1 claim body == production md5', (select md5(pg_get_functiondef('public.claim_my_paper_order_fulfillment(uuid)'::regprocedure))), 'efb450967be071c7f3952264dba966c2');
 perform t.eq('R2 release body == production md5', (select md5(pg_get_functiondef('public.release_my_paper_order_fulfillment(uuid,text)'::regprocedure))), 'a59123b599da34a25854d998b15d7e2e');
 perform t.eq('R3 mark_submitted body == production md5', (select md5(pg_get_functiondef('public.mark_my_paper_order_submitted(uuid,text,text)'::regprocedure))), '6363ad083b192f1de1a0ef76bc41943b');
 perform t.eq('R4 mark_checkout_pending body == production md5', (select md5(pg_get_functiondef('public.mark_my_paper_order_checkout_pending(uuid,text)'::regprocedure))), '93afb707c1edb649f7fc0b0e82f5dc1a');
 perform t.eq('R5 grants: authenticated+service_role execute; anon and PUBLIC not (4 functions)',
   (select bool_and(has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute') and not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE')) from pg_proc p where p.proname in ('claim_my_paper_order_fulfillment','release_my_paper_order_fulfillment','mark_my_paper_order_submitted','mark_my_paper_order_checkout_pending')), 'true');
 perform t.eq('R6 all four SECURITY DEFINER with search_path=public', (select bool_and(p.prosecdef and p.proconfig = array['search_path=public']) from pg_proc p where p.proname in ('claim_my_paper_order_fulfillment','release_my_paper_order_fulfillment','mark_my_paper_order_submitted','mark_my_paper_order_checkout_pending')), 'true');
 -- fail closed
 perform t.lk('R7 anon denied on all four', t.q(null,'anon',format('public.claim_my_paper_order_fulfillment(%L)',o))||t.q(null,'anon',format('public.release_my_paper_order_fulfillment(%L)',o))||t.q(null,'anon',format('public.mark_my_paper_order_submitted(%L,''g'',''order'')',o))||t.q(null,'anon',format('public.mark_my_paper_order_checkout_pending(%L,''cs'')',o)), 'ERR 42501%ERR 42501%ERR 42501%ERR 42501%');
 perform t.eq('R8 no auth.uid() (service_role without sub) -> not_authenticated', t.q(null,'service_role',format('public.claim_my_paper_order_fulfillment(%L)',o)), 'ERR P0001:not_authenticated');
 -- checkout pending
 perform t.eq('R9 other user cannot mark my order checkout_pending (false)', t.q(b,'authenticated',format('public.mark_my_paper_order_checkout_pending(%L,''cs_1'')',o)), 'false');
 perform t.eq('R10 blank session id rejected', t.q(a,'authenticated',format('public.mark_my_paper_order_checkout_pending(%L,''  '')',o)), 'ERR P0001:invalid_checkout_session_id');
 perform t.eq('R11 null session id rejected', t.q(a,'authenticated',format('public.mark_my_paper_order_checkout_pending(%L,null)',o)), 'ERR P0001:invalid_checkout_session_id');
 perform t.eq('R12 quoted -> checkout_pending true', t.q(a,'authenticated',format('public.mark_my_paper_order_checkout_pending(%L,''cs_1'')',o)), 'true');
 perform t.eq('R13 idempotent with same session id', t.q(a,'authenticated',format('public.mark_my_paper_order_checkout_pending(%L,''cs_1'')',o)), 'true');
 perform t.eq('R14 different session id refused (false)', t.q(a,'authenticated',format('public.mark_my_paper_order_checkout_pending(%L,''cs_2'')',o)), 'false');
 perform t.eq('R15 status checkout_pending with session recorded', (select status||'/'||stripe_checkout_session_id from public.paper_orders where id=o), 'checkout_pending/cs_1');
 perform t.eq('R16 cannot claim before paid (false)', t.q(a,'authenticated',format('public.claim_my_paper_order_fulfillment(%L)',o)), 'false');
 perform t.eq('R17 cannot submit before paid (false)', t.q(a,'authenticated',format('public.mark_my_paper_order_submitted(%L,''g1'',''order'')',o)), 'false');
 update public.paper_orders set status='paid', paid_at=now() where id=o;  -- webhook (service) step, simulated as superuser
 perform t.eq('R18 other user cannot claim (false)', t.q(b,'authenticated',format('public.claim_my_paper_order_fulfillment(%L)',o)), 'false');
 perform t.eq('R19 paid -> fulfilling true', t.q(a,'authenticated',format('public.claim_my_paper_order_fulfillment(%L)',o)), 'true');
 perform t.eq('R20 second claim refused (false), single claim', t.q(a,'authenticated',format('public.claim_my_paper_order_fulfillment(%L)',o)), 'false');
 perform t.eq('R21 other user cannot release (false)', t.q(b,'authenticated',format('public.release_my_paper_order_fulfillment(%L,''x'')',o)), 'false');
 r := t.q(a,'authenticated',format('public.release_my_paper_order_fulfillment(%L,''  gelato_rejected_422  '')',o));
 perform t.eq('R22 release fulfilling -> paid true, reason trimmed/stored', r||'/'||(select status||'/'||failure_reason from public.paper_orders where id=o), 'true/paid/gelato_rejected_422');
 perform t.eq('R23 release when not fulfilling refused (false)', t.q(a,'authenticated',format('public.release_my_paper_order_fulfillment(%L)',o)), 'false');
 r := t.q(a,'authenticated',format('public.claim_my_paper_order_fulfillment(%L)',o));
 perform t.eq('R24 reclaim clears failure_reason', r||'/'||coalesce((select failure_reason from public.paper_orders where id=o),'NULL'), 'true/NULL');
 perform t.eq('R25 invalid gelato type', t.q(a,'authenticated',format('public.mark_my_paper_order_submitted(%L,''g1'',''bogus'')',o)), 'ERR P0001:invalid_gelato_order_type');
 perform t.eq('R26 blank gelato id', t.q(a,'authenticated',format('public.mark_my_paper_order_submitted(%L,'' '',''order'')',o)), 'ERR P0001:invalid_gelato_order_id');
 perform t.eq('R27 other user cannot mark submitted (false)', t.q(b,'authenticated',format('public.mark_my_paper_order_submitted(%L,''g1'',''order'')',o)), 'false');
 perform t.eq('R28 fulfilling -> submitted true', t.q(a,'authenticated',format('public.mark_my_paper_order_submitted(%L,''g1'',''order'')',o)), 'true');
 perform t.eq('R29 submit is idempotent with same gelato id', t.q(a,'authenticated',format('public.mark_my_paper_order_submitted(%L,''g1'',''order'')',o)), 'true');
 perform t.eq('R30 different gelato id refused (false)', t.q(a,'authenticated',format('public.mark_my_paper_order_submitted(%L,''g2'',''order'')',o)), 'false');
 perform t.eq('R31 submitted order cannot be claimed or released', t.q(a,'authenticated',format('public.claim_my_paper_order_fulfillment(%L)',o))||'/'||t.q(a,'authenticated',format('public.release_my_paper_order_fulfillment(%L)',o)), 'false/false');
 perform t.eq('R32 final row: submitted, gelato id/type, submitted_at set', (select status||'/'||gelato_order_id||'/'||gelato_order_type||'/'||(submitted_at is not null)::text from public.paper_orders where id=o), 'submitted/g1/order/true');
 perform t.eq('R33 service_role with a uid can call (webhook-style identity)', t.q(a,'service_role',format('public.mark_my_paper_order_submitted(%L,''g1'',''order'')',o)), 'true');
end $$;

-- ===================== 217210 get_multi_day_entitlement_state =====================
do $$
declare a uuid:=t.mkuser(); co uuid:=t.mkuser(); st uuid:=t.mkuser(); g uuid; j text;
begin
 g := t.fx_gathering_md(a); perform t.fx_member(g, co, 'planner');
 perform t.eq('M1 SECURITY DEFINER STABLE, search_path empty, returns jsonb', (select p.prosecdef and p.provolatile='s' and p.proconfig=array['search_path=""'] and p.prorettype='jsonb'::regtype from pg_proc p where p.oid='public.get_multi_day_entitlement_state(uuid)'::regprocedure), 'true');
 perform t.eq('M2 anon cannot execute', has_function_privilege('anon','public.get_multi_day_entitlement_state(uuid)','execute')::text, 'false');
 perform t.eq('M3 authenticated + service_role can execute, PUBLIC cannot', (has_function_privilege('authenticated','public.get_multi_day_entitlement_state(uuid)','execute') and has_function_privilege('service_role','public.get_multi_day_entitlement_state(uuid)','execute') and not exists (select 1 from aclexplode((select proacl from pg_proc where oid='public.get_multi_day_entitlement_state(uuid)'::regprocedure)) x where x.grantee=0))::text, 'true');
 perform t.lk('M4 anon call denied', t.q(null,'anon',format('public.get_multi_day_entitlement_state(%L)',g)), 'ERR 42501%');
 perform t.eq('M5 authenticated without uid -> 42501 not_authorized', t.q(null,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g)), 'ERR 42501:not_authorized');
 perform t.eq('M6 unrelated user -> 42501 not_authorized (fail closed)', t.q(st,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g)), 'ERR 42501:not_authorized');
 perform t.eq('M7 owner, no days, no pass -> none', (t.q(a,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g))::jsonb)::text, '{"state": "none", "canEdit": false, "canViewHistory": false}');
 perform t.eq('M8 accepted co-host may read the state', (t.q(co,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g))::jsonb)->>'state', 'none');
 insert into public.gathering_days(gathering_id,day_date) values (g, current_date+30);
 perform t.eq('M9 history exists, no pass -> read_only, canEdit false, canViewHistory true', (t.q(a,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g))::jsonb)::text, '{"state": "read_only", "canEdit": false, "canViewHistory": true}');
 insert into public.gathering_entitlements(user_id,gathering_id,entitlement_type,canonical_product_id,scope,active,provider,environment) values (a,g,'multi_day_pass','multi_day_pass','gathering',true,'web','production');
 perform t.eq('M10 bound active pass -> active', (t.q(a,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g))::jsonb)::text, '{"state": "active", "canEdit": true, "canViewHistory": true}');
 perform t.eq('M11 returns only state/canEdit/canViewHistory (no ids/payment data)', (select string_agg(k,',' order by k) from jsonb_object_keys(t.q(a,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g))::jsonb) k), 'canEdit,canViewHistory,state');
 update public.gathering_entitlements set refunded_at=now() where gathering_id=g;
 perform t.eq('M12 refunded pass -> read_only again (history kept)', (t.q(a,'authenticated',format('public.get_multi_day_entitlement_state(%L)',g))::jsonb)->>'state', 'read_only');
 perform t.eq('M13 function does not write (entitlement count unchanged = 1, no events)', (select count(*) from public.gathering_entitlements where gathering_id=g)::text, '1');
end $$;

-- ===================== 217220 get_multi_day_lock_in_gate (inert) =====================
do $$
declare a uuid:=t.mkuser(); n_trg int;
begin
 perform t.eq('G1 authenticated gets {"mode":"off"}', t.q(a,'authenticated','public.get_multi_day_lock_in_gate()'), '{"mode": "off"}');
 perform t.eq('G2 service_role gets {"mode":"off"}', t.q(null,'service_role','public.get_multi_day_lock_in_gate()'), '{"mode": "off"}');
 perform t.lk('G3 anon denied', t.q(null,'anon','public.get_multi_day_lock_in_gate()'), 'ERR 42501%');
 perform t.eq('G4 PUBLIC has no execute', (not exists (select 1 from aclexplode((select proacl from pg_proc where oid='public.get_multi_day_lock_in_gate()'::regprocedure)) x where x.grantee=0))::text, 'true');
 perform t.eq('G5 constant function: SECURITY DEFINER, search_path empty, body reads no table', (select p.prosecdef and p.proconfig=array['search_path=""'] and p.prosrc !~* 'from|public\.' from pg_proc p where p.oid='public.get_multi_day_lock_in_gate()'::regprocedure), 'true');
 perform t.eq('G6 NO mode table, NO event table, NO setter, NO mode function',
   (select count(*) from pg_class where relnamespace='public'::regnamespace and relname like 'multi_day_lock_in_gate%')::text||'/'||(select count(*) from pg_proc where proname in ('set_multi_day_lock_in_gate','multi_day_lock_in_gate_mode','enforce_multi_day_pass_gate'))::text, '0/0');
 select count(*) into n_trg from pg_trigger where tgrelid='public.gatherings'::regclass and not tgisinternal and (tgname ~* 'multi_day_pass' or tgname ~* 'lock_in_gate' or pg_get_triggerdef(oid) ~* 'multi_day_pass_required');
 perform t.eq('G7 NO enforcement trigger on gatherings (203001/203003 not installed)', n_trg::text, '0');
 perform t.eq('G8 enforcement absent: only the pre-existing baseline function mentions multi_day_pass_required (not the 203001/203003 enforcement functions)', (select string_agg(p.proname,',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%multi_day_pass_required%'), 'enforce_multi_day_extension_dependency');
 perform t.eq('G9 owner can still lock in / create a multi-day gathering with no pass (behaviour unchanged)',
   t.x(a,'authenticated', format($q$insert into public.gatherings(owner_user_id,name,gathering_type,gathering_date,arrival_time,duration_type,gathering_end_date) values (%L,'md','dinner',current_date+40,'18:00','multi_day',current_date+42)$q$, a)), 'ok');
end $$;

-- ===================== 217230 record_invitation_share_initiated =====================
do $$
declare a uuid:=t.mkuser(); mgr uuid:=t.mkuser(); pln uuid:=t.mkuser(); st uuid:=t.mkuser(); g uuid; g2 uuid; ip uuid; ip2 uuid; e1 text; e2 text; e3 text; n0 bigint; r text;
begin
 g := t.fx_gathering(a); g2 := t.fx_gathering(st,'other');
 perform t.fx_member(g, mgr, 'manager'); perform t.fx_member(g, pln, 'planner');
 insert into public.invitation_parties(gathering_id,party_name) values (g,'Smiths') returning id into ip;
 insert into public.invitation_parties(gathering_id,party_name) values (g2,'Others') returning id into ip2;
 perform t.eq('S1 table is RLS-enabled, append-only for clients (select only)', (select relrowsecurity from pg_class where oid='public.invitation_share_events'::regclass)::text||'/'||(has_table_privilege('authenticated','public.invitation_share_events','select') and not has_table_privilege('authenticated','public.invitation_share_events','insert') and not has_table_privilege('authenticated','public.invitation_share_events','update') and not has_table_privilege('authenticated','public.invitation_share_events','delete'))::text||'/'||has_table_privilege('anon','public.invitation_share_events','select')::text, 'true/true/false');
 perform t.eq('S2 function grants: authenticated+service_role, not anon/PUBLIC', (has_function_privilege('authenticated','public.record_invitation_share_initiated(uuid,uuid,text,text)','execute') and has_function_privilege('service_role','public.record_invitation_share_initiated(uuid,uuid,text,text)','execute') and not has_function_privilege('anon','public.record_invitation_share_initiated(uuid,uuid,text,text)','execute') and not exists (select 1 from aclexplode((select proacl from pg_proc where oid='public.record_invitation_share_initiated(uuid,uuid,text,text)'::regprocedure)) x where x.grantee=0))::text, 'true');
 perform t.eq('S3 SECURITY DEFINER, search_path empty', (select p.prosecdef and p.proconfig=array['search_path=""'] from pg_proc p where p.oid='public.record_invitation_share_initiated(uuid,uuid,text,text)'::regprocedure), 'true');
 perform t.lk('S4 anon denied', t.q(null,'anon',format('public.record_invitation_share_initiated(%L,%L,''copy_link'')',g,ip)), 'ERR 42501%');
 perform t.eq('S5 no uid -> not_authorized', t.q(null,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''copy_link'')',g,ip)), 'ERR P0001:not_authorized');
 perform t.eq('S6 stranger -> not_authorized', t.q(st,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''copy_link'')',g,ip)), 'ERR P0001:not_authorized');
 perform t.eq('S7 co-host WITHOUT manage_invitations (planner) -> not_authorized (fail closed)', t.q(pln,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''copy_link'')',g,ip)), 'ERR P0001:not_authorized');
 perform t.eq('S8 denied callers wrote nothing', (select count(*) from public.invitation_share_events)::text, '0');
 perform t.eq('S9 invalid channel', t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''email'')',g,ip)), 'ERR P0001:invalid_channel');
 perform t.eq('S10 null channel', t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,null)',g,ip)), 'ERR P0001:invalid_channel');
 perform t.eq('S11 party of another gathering', t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''copy_link'')',g,ip2)), 'ERR P0001:party_not_in_gathering');
 perform t.eq('S12 unknown party', t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''copy_link'')',g,gen_random_uuid())), 'ERR P0001:party_not_in_gathering');
 e1 := t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''sms_web'',''es'')',g,ip));
 perform t.eq('S13 owner records (uuid returned), locale es stored', (e1 ~ '^[0-9a-f-]{36}$')::text||'/'||(select locale||'/'||channel||'/'||actor_user_id::text from public.invitation_share_events where id=e1::uuid), 'true/es/sms_web/'||a);
 e2 := t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''sms_web'',''es'')',g,ip));
 perform t.eq('S14 idempotent within 60 s: same id, still one row', (e2=e1)::text||'/'||(select count(*) from public.invitation_share_events)::text, 'true/1');
 e3 := t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''copy_link'',''fr'')',g,ip));
 perform t.eq('S15 other channel = new row; unknown locale falls back to en', (e3<>e1)::text||'/'||(select locale from public.invitation_share_events where id=e3::uuid), 'true/en');
 perform t.eq('S16 co-host with manage_invitations (manager) can record', (t.q(mgr,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''share_sheet'')',g,ip)) ~ '^[0-9a-f-]{36}$')::text, 'true');
 perform t.eq('S17 reads: owner and manager see rows; planner, stranger see none', t.q(a,'authenticated','select count(*) from public.invitation_share_events')||'/'||t.q(mgr,'authenticated','select count(*) from public.invitation_share_events')||'/'||t.q(pln,'authenticated','select count(*) from public.invitation_share_events')||'/'||t.q(st,'authenticated','select count(*) from public.invitation_share_events'), '3/3/0/0');
 perform t.lk('S18 anon cannot read', t.q(null,'anon','select count(*) from public.invitation_share_events'), 'ERR 42501%');
 perform t.lk('S19 append-only: owner cannot insert directly', t.x(a,'authenticated', format($q$insert into public.invitation_share_events(gathering_id,invitation_party_id,actor_user_id,channel) values (%L,%L,%L,'copy_link')$q$,g,ip,a)), 'ERR 42501%');
 perform t.lk('S20 append-only: owner cannot update or delete', t.x(a,'authenticated','update public.invitation_share_events set channel=''copy_link''')||t.x(a,'authenticated','delete from public.invitation_share_events'), 'ERR 42501%ERR 42501%');
 perform t.eq('S21 no first_share_initiated_at side effect', (select first_share_initiated_at is null from public.invitation_parties where id=ip)::text, 'true');
 perform t.eq('S22 old 208000 policy name absent, only manager policy', (select string_agg(polname,'|') from pg_policy where polrelid='public.invitation_share_events'::regclass), 'Invitation managers read share events');
 perform set_config('placeandplenty.lifecycle_transition','archive',true); update public.gatherings set status='archived', archived_at=now() where id=g; perform set_config('placeandplenty.lifecycle_transition','',true);
 perform t.eq('S23 archived gathering rejected (read-only), no row added', t.q(a,'authenticated',format('public.record_invitation_share_initiated(%L,%L,''sms_native'')',g,ip))||'/'||(select count(*) from public.invitation_share_events)::text, 'ERR P0001:gathering_archived_read_only/3');
end $$;

-- ===================== 217240 growth_funnel_summary r1 + invitations_published_at =====================
do $$
declare own uuid:=t.mkuser(); sup uuid:=t.mkuser(); mkt uuid:=t.mkuser(); u1 uuid:=t.mkuser(); u2 uuid:=t.mkuser(); u3 uuid:=t.mkuser(); stranger uuid:=t.mkuser(); g1 uuid; g2 uuid; g3 uuid;
  f timestamptz := now() - interval '1 hour'; tt timestamptz := now() + interval '1 hour'; j jsonb; w text;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(sup,'support'),(mkt,'marketing_pr');
 perform t.eq('F1 invitations_published_at: timestamptz, nullable, no default', (select data_type||'/'||is_nullable||'/'||coalesce(column_default,'none') from information_schema.columns where table_schema='public' and table_name='gatherings' and column_name='invitations_published_at'), 'timestamp with time zone/YES/none');
 perform t.eq('F2 no backfill: no gathering has a value', (select count(*) from public.gatherings where invitations_published_at is not null)::text, '0');
 perform t.eq('F3 SECURITY DEFINER STABLE, search_path empty', (select p.prosecdef and p.provolatile='s' and p.proconfig=array['search_path=""'] from pg_proc p where p.oid='public.growth_funnel_summary(timestamptz,timestamptz,boolean)'::regprocedure), 'true');
 perform t.eq('F4 grants: authenticated+service_role, not anon/PUBLIC', (has_function_privilege('authenticated','public.growth_funnel_summary(timestamptz,timestamptz,boolean)','execute') and has_function_privilege('service_role','public.growth_funnel_summary(timestamptz,timestamptz,boolean)','execute') and not has_function_privilege('anon','public.growth_funnel_summary(timestamptz,timestamptz,boolean)','execute') and not exists (select 1 from aclexplode((select proacl from pg_proc where oid='public.growth_funnel_summary(timestamptz,timestamptz,boolean)'::regprocedure)) x where x.grantee=0))::text, 'true');
 w := format('public.growth_funnel_summary(%L,%L)', f, tt);
 perform t.lk('F5 anon denied', t.q(null,'anon',w), 'ERR 42501%');
 perform t.eq('F6 plain authenticated non-staff -> not_authorized', t.q(stranger,'authenticated',w), 'ERR P0001:not_authorized');
 perform t.eq('F7 authenticated without uid -> not_authorized', t.q(null,'authenticated',w), 'ERR P0001:not_authorized');
 perform t.eq('F8 staff WITHOUT growth.read (support) -> not_authorized', t.q(sup,'authenticated',w), 'ERR P0001:not_authorized');
 update public.staff_members set status='revoked', revoked_at=now() where user_id=mkt;
 perform t.eq('F10 revoked growth.read staff -> not_authorized', t.q(mkt,'authenticated',w), 'ERR P0001:not_authorized');
 perform t.eq('F11 staff with growth.read (owner) allowed', (t.q(own,'authenticated',w)::jsonb) ? 'registered', 'true');
 perform t.eq('F12 service_role allowed', (t.q(null,'service_role',w)::jsonb) ? 'registered', 'true');
 perform t.eq('F13 invalid windows (null / to<=from / >400 days) -> invalid_window', t.q(own,'authenticated','public.growth_funnel_summary(null,now())')||'|'||t.q(own,'authenticated',format('public.growth_funnel_summary(%L,%L)',tt,f))||'|'||t.q(own,'authenticated',format('public.growth_funnel_summary(%L,%L)',now()-interval '401 days',now())), 'ERR P0001:invalid_window|ERR P0001:invalid_window|ERR P0001:invalid_window');
 -- cohort fixtures: u1 has a gathering with invitations_published_at; u2 a gathering without; u3 nothing
 g1 := t.fx_gathering(u1); g2 := t.fx_gathering(u2); perform set_config('session_replication_role','replica',true); g3 := t.fx_gathering(u2,'second'); perform set_config('session_replication_role','origin',true);
 update public.gatherings set invitations_published_at = now() where id = g1;
 j := t.q(own,'authenticated',w)::jsonb;
 perform t.eq('F14 registered counts the cohort users only (11 created in window incl. staff/fixtures)', (j->>'registered'), (select count(*)::text from auth.users where created_at >= f and created_at < tt and coalesce(is_anonymous,false)=false and deleted_at is null));
 perform t.eq('F15 invitation_activity counts the published-invitations host (1), metric definition not redefined', (j->>'invitation_activity'), '1');
 perform t.eq('F16 gathering_created = distinct cohort owners (independent recount); repeat_host=1 (only u2 has two)', (j->>'gathering_created')||'/'||(j->>'repeat_host'), (select count(distinct g.owner_user_id)::text from public.gatherings g join auth.users u on u.id=g.owner_user_id where u.created_at >= f and u.created_at < tt)||'/1');
 perform t.eq('F17 counts only: no ids/emails in output', (j::text ~ '@example\.test' or j::text ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::text, 'false');
 perform t.eq('F18 all keys the Command Center page reads are present', (select bool_and(j ? k) from unnest(array['window','registered','email_confirmed','signed_in_approx','gathering_created','planning_action','invitation_activity','rsvp_received','paid_conversion','repeat_host','unconfirmed_older_than_7d','confirmed_never_created_gathering_older_than_14d','notes','include_sandbox']) k)::text, 'true');
 perform t.eq('F19 invitation_activity predicates intact (published_at OR first_share_initiated_at OR sent communication_events)', (select prosrc like '%ga.invitations_published_at is not null%' and prosrc like '%ip.first_share_initiated_at is not null%' and prosrc like '%ce.status::text = ''sent''%' from pg_proc where oid='public.growth_funnel_summary(timestamptz,timestamptz,boolean)'::regprocedure)::text, 'true');
 perform t.eq('F20 read-only: function wrote nothing (still exactly 1 gathering with invitations_published_at)', (select count(*) from public.gatherings where invitations_published_at is not null)::text, '1');
 perform t.eq('F21 paid_conversion 0 with no entitlements', (j->>'paid_conversion'), '0');
end $$;

-- ===================== cross-cutting =====================
do $$
begin
 perform t.eq('X1 no function from this package is executable by anon or PUBLIC',
  (select count(*) from pg_proc p where p.proname in ('claim_my_paper_order_fulfillment','release_my_paper_order_fulfillment','mark_my_paper_order_submitted','mark_my_paper_order_checkout_pending','get_multi_day_entitlement_state','get_multi_day_lock_in_gate','growth_funnel_summary','record_invitation_share_initiated') and (has_function_privilege('anon',p.oid,'execute') or exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where x.grantee=0 and x.privilege_type='EXECUTE')))::text, '0');
 perform t.eq('X2 all 8 previously-missing RPCs now defined', (select count(distinct proname) from pg_proc where pronamespace='public'::regnamespace and proname in ('claim_my_paper_order_fulfillment','release_my_paper_order_fulfillment','mark_my_paper_order_submitted','mark_my_paper_order_checkout_pending','get_multi_day_entitlement_state','get_multi_day_lock_in_gate','growth_funnel_summary','record_invitation_share_initiated'))::text, '8');
 perform t.eq('X3 SMS stays disabled: no sms_* send function/table added by this package', (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname ~ '^sms_.*(send|enable)')::text, '0');
end $$;
select t.report();
