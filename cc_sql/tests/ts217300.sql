-- Agent S suite for 217300..217340 (scratch Postgres only; runs after harness.sql on the full chain with ALL steps incl. 217300-217340 applied).
-- Negative control: on the chain WITHOUT these five migrations this file fails (see report).
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
create or replace function t.fixture_payable(p_code text, p_n int, p_prefix text) returns void language plpgsql as $f$
declare uu uuid; ee uuid; i int; begin
 for i in 1..p_n loop
   uu := t.mkuser(); update auth.users set created_at=now()-interval '10 minutes' where id=uu;
   perform t.q(uu,'authenticated','public.record_referral_claim('''||p_code||''', now()-interval ''5 minutes'')');
   insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values (uu,'plus','plus_annual','web',p_prefix||i,'production',now(),'account') returning id into ee;
   perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,'''||p_prefix||i||''',''usd'',5999,0,200,null,null,''webhook'')');
   perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||ee||'''::uuid)');
 end loop; end $f$;
-- run a statement as the SUPERUSER but with a simulated identity (to reach functions whose EXECUTE is revoked from API roles and test their in-body guard)
create or replace function t.as_claims(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', case when p_role is null and p_uid is null then '' else json_build_object('sub',p_uid,'role',p_role)::text end, true);
  begin execute 'select ('||p_sql||')::text' into v; exception when others then v := 'ERR '||sqlstate||':'||sqlerrm; end;
  perform set_config('request.jwt.claims','',true);
  return coalesce(v,'NULL');
end $f$;
create or replace function t.ent_of(p_partner uuid, p_n int) returns uuid language sql as $f$
  select entitlement_id from (select entitlement_id, row_number() over (order by purchased_at, id) rn from public.commissions where partner_id=p_partner) x where rn=p_n $f$;

-- ===================== E-C2 part 1: inert while paid referrals are OFF (default) =====================
do $$
declare own uuid:=t.mkuser(); pid uuid; uu uuid; ee uuid; j text; n0 bigint; jobs bigint; cmd text;
begin
 insert into public.staff_members(user_id,role) values (own,'owner');
 perform t.eq('S0.1 defaults: program off, paid referrals OFF', (select (not enabled)::text||'/'||(not paid_referrals_enabled)::text from public.hc_settings where singleton), 'true/true');
 perform t.eq('S0.2 approved terms untouched: Pass 50c, Plus 1200c, hold 45d, min 5000c', (select string_agg(canonical_product_id||'='||amount_cents, ',' order by canonical_product_id) from public.hc_terms_amounts where version=1)||'/'||(select validation_days||'/'||min_payout_cents from public.hc_terms_versions where version=1), 'gathering_pass=50,plus_annual=1200/45/5000');
 perform t.eq('S2.0 maintenance function exists, signature (integer,integer)', (to_regprocedure('public.hc_commission_maintenance(integer,integer)') is not null)::text, 'true');
 -- master switch off
 j := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.1 master switch off: status disabled, nothing swept', (j::jsonb)->>'status'||'/'||((j::jsonb)->>'swept'), 'disabled/false');
 update public.hc_settings set enabled=true where singleton;
 -- referred purchase while paid referrals are OFF
 perform t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''fixture'')');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Off Partner','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'offpartner');
 uu := t.mkuser(); update auth.users set created_at=now()-interval '10 minutes' where id=uu;
 perform t.q(uu,'authenticated','public.record_referral_claim(''offpartner'', now()-interval ''5 minutes'')');
 insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values (uu,'plus','plus_annual','web','off-1','production',now(),'account') returning id into ee;
 perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,''off-1'',''usd'',5999,0,200,null,null,''webhook'')');
 select count(*) into n0 from public.commissions;
 j := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.2 paid referrals OFF: complete no-op, reports paid_referrals_disabled', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'accrued')||'/'||((j::jsonb)->>'reconciled')||'/'||((j::jsonb)->>'swept'), 'paid_referrals_disabled/0/0/false');
 perform t.eq('S2.3 ... and accrued nothing (no commission rows, no events)', ((select count(*) from public.commissions)-n0)||'/'||(select count(*) from public.commission_events), '0/0');
 j := t.q(null,'service_role','public.hc_commission_maintenance(90, 2000)');
 perform t.eq('S2.4 same with custom window / batch', (j::jsonb)->>'status', 'paid_referrals_disabled');
 -- who may call it
 perform t.eq('S2.5 authenticated owner cannot call (EXECUTE revoked)', left(t.q(own,'authenticated','public.hc_commission_maintenance()'),16), 'ERR 42501:permis');
 perform t.eq('S2.6 anon cannot call', left(t.q(null,'anon','public.hc_commission_maintenance()'),16), 'ERR 42501:permis');
 perform t.eq('S2.7 no API role has EXECUTE (anon, authenticated, PUBLIC); service_role has', (has_function_privilege('anon','public.hc_commission_maintenance(integer,integer)','execute')
   or has_function_privilege('authenticated','public.hc_commission_maintenance(integer,integer)','execute'))::text||'/'||has_function_privilege('service_role','public.hc_commission_maintenance(integer,integer)','execute')::text, 'false/true');
 perform t.eq('S2.8 in-body guard: a JWT with a non-service role is refused even with EXECUTE', t.as_claims(own,'authenticated','public.hc_commission_maintenance()'), 'ERR P0001:not_authorized');
 perform t.eq('S2.9 internal helpers (sweep core, blocked predicates) are not callable by API roles', (has_function_privilege('authenticated','public.hc_sweep_commissions_core(timestamptz)','execute') or has_function_privilege('anon','public.hc_sweep_commissions_core(timestamptz)','execute')
   or has_function_privilege('authenticated','public.hc_commission_blocked(uuid)','execute') or has_function_privilege('authenticated','public.hc_payout_has_blocked_commission(uuid)','execute'))::text, 'false');
 perform t.eq('S2.10 sweep_commissions keeps service-only behaviour (signature, grants)', t.q(own,'authenticated','public.sweep_commissions(now())') like 'ERR 42501%' and (t.q(null,'service_role','public.sweep_commissions(now())')::jsonb->>'status')='ok', 'true');
 perform t.eq('S2.11 body has no URL / credential / http call', (select (prosrc !~* '(https?://|net\.http|apikey|secret|bearer|password)')::text from pg_proc where oid='public.hc_commission_maintenance(integer,integer)'::regprocedure), 'true');
 -- pg_cron job
 select count(*), max(command) into jobs, cmd from cron.job where jobname='hc_commission_maintenance_daily';
 perform t.eq('S2.12 exactly one cron job under the fixed name (idempotent apply)', jobs::text, '1');
 perform t.eq('S2.13 job is pure SQL (calls only the maintenance function; no URL, no credential)', (cmd = 'select public.hc_commission_maintenance();')::text, 'true');
 perform t.eq('S2.14 no other new cron job was created (only the pre-existing reminder job + ours)', (select string_agg(jobname, ',' order by jobname) from cron.job), 'hc_commission_maintenance_daily,process-scheduled-host-reminders');
 perform t.eq('S2.15 scratch: paid referrals still OFF at the end of this block', (select (not paid_referrals_enabled)::text from public.hc_settings where singleton), 'true');
end $$;

-- ===================== E-C1: refunded / revoked / disputed commissions never drafted, approved, or paid =====================
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); pA uuid; pB uuid; pC uuid; pD uuid; pE uuid; pF uuid; j text; pay uuid; pay2 uuid; e1 uuid; e2 uuid; st text; n int; today text := current_date::text;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner A','approved','founding') returning id into pA;
 insert into public.partner_codes(partner_id,code) values (pA,'code-a');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner B','approved','founding') returning id into pB;
 insert into public.partner_codes(partner_id,code) values (pB,'code-b');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner C','approved','founding') returning id into pC;
 insert into public.partner_codes(partner_id,code) values (pC,'code-c');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner D','approved','founding') returning id into pD;
 insert into public.partner_codes(partner_id,code) values (pD,'code-d');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner E','approved','founding') returning id into pE;
 insert into public.partner_codes(partner_id,code) values (pE,'code-e');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner F','approved','founding') returning id into pF;
 insert into public.partner_codes(partner_id,code) values (pF,'code-f');
 perform t.q(own,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''scratch test'')');   -- scratch DB only
 perform t.eq('S1.0 owner activated paid referrals on the scratch DB (the only way it turns on)', (select paid_referrals_enabled::text from public.hc_settings where singleton), 'true');
 perform t.fixture_payable('code-a', 6, 'sa-'); perform t.fixture_payable('code-b', 6, 'sb-'); perform t.fixture_payable('code-c', 6, 'sc-');
 perform t.fixture_payable('code-d', 6, 'sd-'); perform t.fixture_payable('code-e', 6, 'se-'); perform t.fixture_payable('code-f', 6, 'sf-');
 perform t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')');
 perform t.eq('S1.1 fixtures: 36 validated commissions of 1200c, Plus first purchase', (select count(*)||'/'||sum(commission_cents)||'/'||min(commission_cents) from public.commissions where state='validated'), '36/43200/1200');

 -- ---- A: refund AFTER validation, NO sweep run (verifier C9b) ----
 e1 := t.ent_of(pA,1);
 update public.gathering_entitlements set refunded_at=now(), active=false where id=e1;
 perform t.eq('S1.2 precondition: refunded purchase still shows validated (no sweep has run)', (select state from public.commissions where entitlement_id=e1), 'validated');
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pA||'''::uuid)');
 perform t.eq('S1.3 C9b: draft EXCLUDES the refunded commission (6 x 1200 - 1 = 6000, not 7200)', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'net_cents'), 'draft/6000');
 pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('S1.4 payout total = 6000, 5 payable commissions, by_product plus_annual 6000', (select total_cents from public.payouts where id=pay)||'/'||(select count(*) from public.commissions where payout_id=pay and state='payable')||'/'||((j::jsonb)->'by_product'->>'plus_annual'), '6000/5/6000');
 perform t.eq('S1.5 refunded commission is reversed (sweep ran inside the draft) and NOT in any payout', (select state||'/'||coalesce(payout_id::text,'none')||'/'||coalesce(reason,'-') from public.commissions where entitlement_id=e1), 'reversed/none/refund_or_dispute');
 perform t.eq('S1.6 payable commissions of the payout are all non-refunded', (select count(*) from public.commissions c join public.gathering_entitlements e on e.id=c.entitlement_id where c.payout_id=pay and e.refunded_at is not null)::text, '0');
 perform t.eq('S1.7 economics unchanged: every payable commission is the approved 1200c', (select min(commission_cents)||'/'||max(commission_cents) from public.commissions where payout_id=pay), '1200/1200');

 -- ---- B: dispute OPEN and dispute LOST at draft time ----
 e1 := t.ent_of(pB,1); e2 := t.ent_of(pB,2);
 update public.commission_purchase_facts set dispute_status='open' where entitlement_id=e1;
 update public.commission_purchase_facts set dispute_status='lost' where entitlement_id=e2;
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pB||'''::uuid)');
 perform t.eq('S1.8 dispute open + dispute lost excluded: 4 x 1200 = 4800 is below the $50 minimum (min unchanged, 5000)', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'eligible_cents')||'/'||((j::jsonb)->>'min_cents'), 'below_minimum/4800/5000');
 perform t.eq('S1.9 open dispute is held (dispute_open), lost dispute is reversed; neither payable', (select string_agg(state||':'||coalesce(reason,'-'), ',' order by state) from public.commissions where entitlement_id in (e1,e2)), 'held:dispute_open,reversed:refund_or_dispute');
 perform t.eq('S1.10 no payout row was created for B', (select count(*) from public.payouts where partner_id=pB)::text, '0');
 update public.commission_purchase_facts set dispute_status='won' where entitlement_id=e1;
 perform t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')');
 perform t.eq('S1.11 dispute won releases the hold, then validates again (rules unchanged)', (select state from public.commissions where entitlement_id=e1), 'validated');

 -- ---- C: defence in depth - even if the sweep cannot reverse (program master switch off), the draft filter excludes ----
 e1 := t.ent_of(pC,1);
 update public.gathering_entitlements set refunded_at=now(), active=false where id=e1;
 update public.hc_settings set enabled=false where singleton;
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pC||'''::uuid)');
 perform t.eq('S1.12 sweep is a no-op here (master switch off) but the filter still excludes the refunded commission: 6000', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'net_cents'), 'draft/6000');
 perform t.eq('S1.13 the refunded commission was left validated (not payable, not in the payout)', (select state||'/'||coalesce(payout_id::text,'none') from public.commissions where entitlement_id=e1), 'validated/none');
 update public.hc_settings set enabled=true where singleton;

 -- ---- D: refund lands AFTER the draft exists: approve refuses, nothing changes; maintenance then voids the batch ----
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pD||'''::uuid)');
 pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('S1.14 clean draft for D: 7200', (j::jsonb)->>'net_cents', '7200');
 e1 := t.ent_of(pD,3);
 update public.gathering_entitlements set refunded_at=now(), active=false where id=e1;
 perform t.eq('S1.15 approve REFUSES a batch that now contains a refunded commission', t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'), 'ERR P0001:payout_contains_reversed_commission');
 perform t.eq('S1.16 refusal changed nothing: payout still draft, all 6 commissions still payable', (select status from public.payouts where id=pay)||'/'||(select count(*) from public.commissions where payout_id=pay and state='payable'), 'draft/6');
 j := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S1.17 maintenance (sweep) voids the batch: payout void, refunded reversed, other 5 back to validated', (select status||'/'||void_reason from public.payouts where id=pay)||'/'||(select state from public.commissions where entitlement_id=e1)||'/'||(select count(*) from public.commissions where partner_id=pD and state='validated'), 'void/contains_reversed_commission/reversed/5');
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pD||'''::uuid)');
 perform t.eq('S1.18 re-draft after the void: 5 x 1200 = 6000', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'net_cents'), 'draft/6000');
 pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('S1.19 approve works for a clean batch (approval is not payment)', ((t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'))::jsonb)->>'status', 'approved');

 -- ---- E: refund lands AFTER approval: recording the payment is refused ----
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pE||'''::uuid)');
 pay2 := ((j::jsonb)->>'payout_id')::uuid;
 perform t.q(own,'authenticated','public.hc_approve_payout('''||pay2||'''::uuid)');
 e2 := t.ent_of(pE,2);
 update public.commission_purchase_facts set dispute_status='open' where entitlement_id=e2;
 perform t.eq('S1.20 record_external_payment REFUSES an approved batch containing a disputed commission', t.q(own,'authenticated','public.hc_record_external_payment('''||pay2||'''::uuid,''ACH-S-0001'','''||today||'''::date,''bank transfer'',true)'), 'ERR P0001:payout_contains_reversed_commission');
 perform t.eq('S1.21 nothing recorded: still approved, no paid commissions, no payment event', (select status from public.payouts where id=pay2)||'/'||(select count(*) from public.commissions where payout_id=pay2 and state='paid')||'/'||(select count(*) from public.payout_events where payout_id=pay2 and event='payment_recorded'), 'approved/0/0');
 update public.commission_purchase_facts set dispute_status='none' where entitlement_id=e2;
 perform t.eq('S1.22 once the blocker is gone the same payment records normally (earlier checks and order unchanged)', ((t.q(own,'authenticated','public.hc_record_external_payment('''||pay2||'''::uuid,''ACH-S-0001'','''||today||'''::date,''bank transfer'',true)'))::jsonb)->>'status', 'paid_recorded');
 perform t.eq('S1.23 replay still idempotent', ((t.q(own,'authenticated','public.hc_record_external_payment('''||pay2||'''::uuid,''ACH-S-0001'','''||today||'''::date,''bank transfer'',true)'))::jsonb)->>'status', 'already_recorded');

 -- ---- F: revocation. Ordinary cancellation (subscription_deleted) still pays; any other revoke does not ----
 e1 := t.ent_of(pF,1); e2 := t.ent_of(pF,2);
 update public.gathering_entitlements set revoked_at=now(), revoked_reason='subscription_deleted', active=false where id=e1;
 update public.gathering_entitlements set revoked_at=now(), revoked_reason='fraud_review', active=false where id=e2;
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pF||'''::uuid)');
 perform t.eq('S1.24 revoked for another reason excluded, ordinary cancellation still included: 5 x 1200 = 6000', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'net_cents'), 'draft/6000');
 perform t.eq('S1.25 states: cancellation payable, fraud_review reversed', (select string_agg(state, ',' order by state) from public.commissions where entitlement_id in (e1,e2)), 'payable,reversed');

 -- ---- permissions / state machine unchanged ----
 perform t.eq('S1.26 manager still cannot draft / approve / record (owner only)', t.q(cpm,'authenticated','public.hc_create_payout_draft('''||pA||'''::uuid)')||'/'||t.q(cpm,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'), 'ERR P0001:not_authorized/ERR P0001:not_authorized');
 perform t.eq('S1.27 anon denied', left(t.q(null,'anon','public.hc_create_payout_draft('''||pA||'''::uuid)'),10), 'ERR 42501:');
 perform t.eq('S1.28 payout ledger visibility for managers untouched (E-D2 owner decision): hc_admin_payout_ledger still allows hc.read', (t.q(cpm,'authenticated','public.hc_admin_payout_ledger(10)') not like 'ERR P0001:not_authorized')::text, 'true');
 perform t.eq('S1.29 retroactive accrual untouched (E-C3 owner decision): reconcile still takes a purchase regardless of when paid referrals were switched on', (select (pg_get_functiondef('public.reconcile_commission_for_entitlement(uuid)'::regprocedure) !~* 'activated_at')::text), 'true');
 perform t.eq('S1.30 no payout is ever paid automatically: no payout is paid except the one recorded by the owner above', (select count(*) from public.payouts where status='paid')::text, '1');
end $$;

-- ===================== E-C2 part 2: maintenance with paid referrals ON =====================
do $$
declare own uuid:=t.mkuser(); pid uuid; uu uuid; ee uuid; ee2 uuid; j text; j2 text; n int; c public.commissions; h0 text; h1 text;
begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'Partner M','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'code-m');
 -- a referred buyer WITHOUT any facts yet, one with facts
 uu := t.mkuser(); update auth.users set created_at=now()-interval '10 minutes' where id=uu;
 perform t.q(uu,'authenticated','public.record_referral_claim(''code-m'', now()-interval ''5 minutes'')');
 insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values (uu,'plus','plus_annual','web','m-1','production',now(),'account') returning id into ee;
 perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,''m-1'',''usd'',5999,0,200,null,null,''webhook'')');
 -- a non-referred buyer, a Multi-Day purchase, a sandbox purchase: must never accrue
 uu := t.mkuser();
 insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values (uu,'plus','plus_annual','web','m-2','production',now(),'account') returning id into ee2;
 perform t.q(null,'service_role','public.record_purchase_facts('''||ee2||'''::uuid,''m-2'',''usd'',5999,0,200,null,null,''webhook'')');
 j := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.20 paid referrals ON: maintenance reconciles the referred purchase (1 pending commission, 1200c) and sweeps', ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'reconciled')||'/'||((j::jsonb)->>'accrued')||'/'||((j::jsonb)->>'swept'), 'ok/1/1/true');
 select * into c from public.commissions where entitlement_id=ee;
 perform t.eq('S2.21 commission: Plus first purchase = 1200c, pending, terms v1 snapshot (45d hold, 30d window)', c.state||'/'||c.commission_cents||'/'||c.terms_version||'/'||c.terms_validation_days||'/'||c.terms_window_days, 'pending/1200/1/45/30');
 perform t.eq('S2.22 non-referred buyer accrued nothing', (select count(*) from public.commissions where entitlement_id=ee2)::text, '0');
 j2 := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.23 second run is idempotent: reconciles nothing new, no duplicate commission', ((j2::jsonb)->>'reconciled')||'/'||(select count(*) from public.commissions where entitlement_id=ee), '0/1');
 set local session_replication_role = replica; update public.commissions set validate_after = now() - interval '1 hour' where entitlement_id=ee; set local session_replication_role = origin;   -- test-only: simulate the 45 days having elapsed (terms are frozen)
 j2 := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.25 ... maintenance validated it', ((j2::jsonb)->'sweep'->>'validated')||'/'||(select state from public.commissions where entitlement_id=ee), '1/validated');
 update public.gathering_entitlements set refunded_at=now(), active=false where id=ee;
 j2 := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.26 ... and reverses it after a refund', ((j2::jsonb)->'sweep'->>'reversed')||'/'||(select state from public.commissions where entitlement_id=ee), '1/reversed');
 perform t.eq('S2.27 claims setting restored after a run (no lingering service role in the session)', coalesce(nullif(current_setting('request.jwt.claims', true),''),'EMPTY'), 'EMPTY');
 -- purchase older than the look-back window is not picked up
 uu := t.mkuser(); update auth.users set created_at=now()-interval '10 minutes' where id=uu;
 perform t.q(uu,'authenticated','public.record_referral_claim(''code-m'', now()-interval ''5 minutes'')');
 insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values (uu,'plus','plus_annual','web','m-3','production',now(),'account') returning id into ee2;
 update public.gathering_entitlements set purchased_at = now() - interval '40 days' where id = ee2;
 perform t.q(null,'service_role','public.record_purchase_facts('''||ee2||'''::uuid,''m-3'',''usd'',5999,0,200,null,null,''webhook'')');
 j2 := t.q(null,'service_role','public.hc_commission_maintenance()');
 perform t.eq('S2.28 a purchase older than the 30-day look-back is not reconciled by the job', ((j2::jsonb)->>'reconciled')||'/'||(select count(*) from public.commissions where entitlement_id=ee2), '0/0');
 select md5(coalesce(string_agg(id::text||status||coalesce(external_ref,''), ',' order by id),'')) into h0 from public.payouts;
 j2 := t.q(null,'service_role','public.hc_commission_maintenance()');
 select md5(coalesce(string_agg(id::text||status||coalesce(external_ref,''), ',' order by id),'')) into h1 from public.payouts;
 perform t.eq('S2.29 maintenance never creates, approves, pays or changes a payout (payout table identical before/after a run)', (h0 = h1)::text, 'true');
end $$;

-- ===================== E-D1: no PAID payout without its external record =====================
do $$
declare own uuid:=t.mkuser(); pid uuid; v text; n0 int; ok boolean;
begin
 select id into pid from public.partners where display_name='Partner M';
 perform t.eq('S3.1 CHECK exists and is validated', (select convalidated::text from pg_constraint where conname='payouts_paid_requires_record_chk'), 'true');
 perform t.eq('S3.2 insert trigger exists (BEFORE INSERT)', (exists (select 1 from pg_trigger where tgname='payouts_insert_guard' and tgrelid='public.payouts'::regclass and (tgtype & 2)=2 and (tgtype & 4)=4))::text, 'true');
 -- direct INSERTs (table owner); service_role bypasses RLS and would hit the same triggers/constraint
 begin insert into public.payouts(partner_id,total_cents,status) values (pid,5000,'paid'); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.3 paid row with NO reference / date / method / confirmer is refused (D8)', v, 'P0001:external_payment_confirmation_required');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by,confirmed_at,approved_at) values (pid,5000,'paid',null,current_date,'bank transfer',gen_random_uuid(),now(),now()); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.4 paid row with NULL reference refused', v, 'P0001:external_payment_confirmation_required');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by,confirmed_at,approved_at) values (pid,5000,'paid','ab',current_date,'bank transfer',gen_random_uuid(),now(),now()); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.5 paid row with a 2-char reference refused', v, 'P0001:external_payment_confirmation_required');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by,confirmed_at,approved_at) values (pid,5000,'paid','REF-12345',current_date,null,gen_random_uuid(),now(),now()); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.6 paid row with NULL / placeholder method refused', v, 'P0001:invalid_method');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_at,approved_at) values (pid,5000,'paid','REF-12345',current_date,'wire',now(),now()); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.7 paid row without a confirmer refused', v, 'P0001:external_payment_confirmation_required');
 -- the CHECK on its own (guard disabled for the probe only; the whole block is one transaction scope of the test run, re-enabled right after)
 alter table public.payouts disable trigger payouts_insert_guard;
 begin insert into public.payouts(partner_id,total_cents,status) values (pid,5000,'paid'); v:='inserted'; exception when others then v := sqlstate; end;
 perform t.eq('S3.8 CHECK alone (guard off): paid row with nothing refused (23514)', v, '23514');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by) values (pid,5000,'paid','ab',current_date,'wire',gen_random_uuid()); v:='inserted'; exception when others then v := sqlstate; end;
 perform t.eq('S3.9 CHECK alone: 2-char reference refused (23514)', v, '23514');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by) values (pid,5000,'paid','REF-1',null,'wire',gen_random_uuid()); v:='inserted'; exception when others then v := sqlstate; end;
 perform t.eq('S3.10 CHECK alone: missing paid_on refused (23514)', v, '23514');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by) values (pid,5000,'paid','REF-1',current_date,'  ',gen_random_uuid()); v:='inserted'; exception when others then v := sqlstate; end;
 perform t.eq('S3.11 CHECK alone: blank method refused (23514)', v, '23514');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method) values (pid,5000,'paid','REF-1',current_date,'wire'); v:='inserted'; exception when others then v := sqlstate; end;
 perform t.eq('S3.12 CHECK alone: missing confirmer refused (23514)', v, '23514');
 alter table public.payouts enable trigger payouts_insert_guard;
 perform t.eq('S3.13 nothing was inserted by any refused attempt', (select count(*) from public.payouts where partner_id=pid)::text, '0');
 begin insert into public.payouts(partner_id,total_cents,status,external_ref,paid_on,external_method,confirmed_by,confirmed_at,approved_at) values (pid,5000,'paid','REF-12345',current_date,'wire',gen_random_uuid(),now(),now()); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.14 a COMPLETE paid record is still insertable (restore / import path), constraint satisfied', v, 'inserted');
 delete from public.payouts where partner_id=pid and external_ref='REF-12345';
 begin insert into public.payouts(partner_id,total_cents) values (pid,5000); v:='inserted'; exception when others then v := sqlstate||':'||sqlerrm; end;
 perform t.eq('S3.15 normal draft insert unaffected', v, 'inserted');
 delete from public.payouts where partner_id=pid and status='draft';
end $$;

-- ===================== E-B1 / E-B2: NULL eligibility = unchanged =====================
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); j text; a0 bigint; a1 bigint;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager');
 -- 'founding' is already a paid-eligible tier (created by the owner in the E-C1 block)
 perform t.eq('S4.0 fixture: founding is paid-eligible, label Founding creator', (select paid_referrals_eligible::text||'/'||label from public.hc_tiers where slug='founding'), 'true/Founding creator');
 select count(*) into a0 from public.hc_config_audit where entity='tier' and entity_key='founding';
 j := t.q(cpm,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creators'',''new desc'',null,1,true,null,''rename by manager'')');
 perform t.eq('S4.1 B8: manager renames a paid-eligible tier with NULL eligibility: allowed, eligibility untouched', ((j::jsonb)->>'status')||'/'||(select paid_referrals_eligible::text||'/'||label from public.hc_tiers where slug='founding'), 'updated/true/Founding Creators');
 select count(*) into a1 from public.hc_config_audit where entity='tier' and entity_key='founding';
 perform t.eq('S4.2 audit row written with the reason and the manager as actor', (select (count(*)=1)::text from public.hc_config_audit where entity='tier' and entity_key='founding' and reason='rename by manager' and actor=cpm and id > (select max(id) - (a1-a0) from public.hc_config_audit)), 'true');
 j := t.q(cpm,'authenticated','public.hc_upsert_tier(p_slug=>''founding'',p_label=>''Founding Creator'',p_description=>null,p_eligibility_notes=>null,p_sort_order=>1,p_active=>true,p_reason=>''omitted field'')');
 perform t.eq('S4.3 the eligibility argument may be OMITTED entirely (default NULL)', ((j::jsonb)->>'status')||'/'||(select paid_referrals_eligible::text||'/'||label from public.hc_tiers where slug='founding'), 'updated/true/Founding Creator');
 perform t.eq('S4.4 manager EXPLICIT true->false is still refused', t.q(cpm,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creator'',null,null,1,true,false,''try off'')'), 'ERR P0001:not_authorized_referral_eligibility');
 perform t.q(own,'authenticated','public.hc_upsert_tier(''plain'',''Plain tier'',null,null,5,true,false,''fixture plain'')');
 perform t.eq('S4.5 manager EXPLICIT false->true is still refused', t.q(cpm,'authenticated','public.hc_upsert_tier(''plain'',''Plain tier'',null,null,5,true,true,''try on'')'), 'ERR P0001:not_authorized_referral_eligibility');
 j := t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creator'',null,null,1,true,null,''owner resave'')');
 perform t.eq('S4.6 B9: owner re-saving with NULL leaves a paid-eligible tier eligible', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='founding'), 'updated/true');
 j := t.q(own,'authenticated','public.hc_upsert_tier(''plain'',''Plain tier 2'',null,null,5,true,null,''owner resave'')');
 perform t.eq('S4.7 NULL leaves an ineligible tier ineligible', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='plain'), 'updated/false');
 j := t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creator'',null,null,1,true,false,''owner turns off'')');
 perform t.eq('S4.8 only an EXPLICIT owner value changes eligibility (true->false)', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='founding'), 'updated/false');
 perform t.eq('S4.9 ... audited with before/after and reason', (select (count(*)>=1)::text from public.hc_config_audit where entity='tier' and entity_key='founding' and reason='owner turns off' and actor=own), 'true');
 j := t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creator'',null,null,1,true,true,''owner turns on'')');
 perform t.eq('S4.10 ... and back (false->true)', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='founding'), 'updated/true');
 j := t.q(cpm,'authenticated','public.hc_upsert_tier(''fresh'',''Fresh tier'',null,null,9,true,null,''new tier'')');
 perform t.eq('S4.11 a NEW tier with NULL starts NOT eligible (manager may create it)', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='fresh'), 'created/false');
 perform t.eq('S4.12 reason still required (null / short)', t.q(cpm,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creator'',null,null,1,true,null,null)')||'/'||t.q(cpm,'authenticated','public.hc_upsert_tier(''founding'',''Founding Creator'',null,null,1,true,null,''ab'')'), 'ERR P0001:reason_required/ERR P0001:reason_required');
 perform t.eq('S4.13 support-less callers still denied (anon, non-staff)', left(t.q(null,'anon','public.hc_upsert_tier(''founding'',''x1'',null,null,1,true,null,''nope'')'),10)||'/'||t.q(t.mkuser(),'authenticated','public.hc_upsert_tier(''founding'',''x1'',null,null,1,true,null,''nope'')'), 'ERR 42501:/ERR P0001:not_authorized');
 -- legacy writer
 j := t.q(cpm,'authenticated','public.hc_admin_upsert_tier(''founding'',''Founding legacy'',null,null,''["a"]''::jsonb,null,true,1,true)');
 perform t.eq('S4.14 legacy hc_admin_upsert_tier: manager with NULL referral flag keeps eligibility', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text||'/'||label from public.hc_tiers where slug='founding'), 'updated/true/Founding legacy');
 perform t.eq('S4.15 legacy: manager explicit change still owner_required', t.q(cpm,'authenticated','public.hc_admin_upsert_tier(''founding'',''Founding legacy'',null,null,''["a"]''::jsonb,false,true,1,true)'), 'ERR P0001:owner_required');
 j := t.q(own,'authenticated','public.hc_admin_upsert_tier(''founding'',''Founding legacy'',null,null,''["a"]''::jsonb,false,true,1,true)');
 perform t.eq('S4.16 legacy: owner explicit false still works', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='founding'), 'updated/false');
 j := t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''founding'',''["Perk"]''::jsonb,''perk'')');
 perform t.eq('S4.17 benefits writer still keeps eligibility (D3.7)', (j::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='founding'), 'updated/false');
 perform t.eq('S4.18 grants: hc_tier_write service-only; hc_upsert_tier authenticated+service_role, not anon', (has_function_privilege('authenticated','public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text)','execute') or has_function_privilege('anon','public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text)','execute'))::text||'/'||has_function_privilege('authenticated','public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text)','execute')::text||'/'||has_function_privilege('anon','public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text)','execute')::text, 'false/true/false');
 perform t.eq('S4.19 still ONE tier writer: only hc_tier_write writes public.hc_tiers', (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ~* '(insert\s+into|update|delete\s+from|merge\s+into)\s+public\.hc_tiers\M'), 'hc_tier_write');
end $$;

-- ===================== E-G2: current_plus_term guard =====================
do $$
declare u uuid:=t.mkuser(); v uuid:=t.mkuser(); ee uuid; r text;
begin
 insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope,active) values (u,'plus','plus_annual','web','g2-1','production',now(),'account',true) returning id into ee;
 perform t.eq('S5.1 service role: any user (permitted caller, same result)', (t.as_claims(null,'service_role','(select count(*) from public.current_plus_term('''||u||'''::uuid))')), '1');
 perform t.eq('S5.2 signed-in user: own id (permitted caller, same result)', (t.as_claims(u,'authenticated','(select count(*) from public.current_plus_term('''||u||'''::uuid))')), '1');
 perform t.eq('S5.3 signed-in user: someone else refused', (t.as_claims(v,'authenticated','(select count(*) from public.current_plus_term('''||u||'''::uuid))')), 'ERR P0001:not_authorized');
 perform t.eq('S5.4 E-G2: NO identity at all is refused (previously passed)', (t.as_claims(null,null,'(select count(*) from public.current_plus_term('''||u||'''::uuid))')), 'ERR P0001:not_authorized');
 perform t.eq('S5.5 anon role without uid refused', (t.as_claims(null,'anon','(select count(*) from public.current_plus_term('''||u||'''::uuid))')), 'ERR P0001:not_authorized');
 update public.gathering_entitlements set refunded_at=now() where id=ee;
 perform t.eq('S5.6 refund-safe filter (205004) kept: refunded Plus no longer a term', (t.as_claims(null,'service_role','(select count(*) from public.current_plus_term('''||u||'''::uuid))')), '0');
 perform t.eq('S5.7 EXECUTE grants unchanged: service_role only (no anon / authenticated / PUBLIC)', (has_function_privilege('anon','public.current_plus_term(uuid)','execute') or has_function_privilege('authenticated','public.current_plus_term(uuid)','execute'))::text||'/'||has_function_privilege('service_role','public.current_plus_term(uuid)','execute')::text, 'false/true');
 perform t.eq('S5.8 the callers of current_plus_term keep working: plus_gatherings_used_this_term for the service role and (as the user) for the signed-in owner', (t.q(null,'service_role','public.plus_gatherings_used_this_term('''||u||'''::uuid)') not like 'ERR%')::text||'/'||(t.as_claims(u,'authenticated','public.plus_gatherings_used_this_term('''||u||'''::uuid)') not like 'ERR%')::text, 'true/true');
end $$;

select t.report();
