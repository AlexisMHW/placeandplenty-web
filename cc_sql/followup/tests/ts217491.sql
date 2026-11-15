-- Follow-up suite for 217491 (hc_create_payout_draft OWNER-ONLY at the database; hc.payout = VIEW). Scratch Postgres only; harness.sql first; full chain + follow-up (DB timezone UTC).
-- usage: bash followup/tests/scripts/run_suite.sh <db_with_followup> out.txt followup/tests/ts217491.sql
-- NEGATIVE CONTROL: on the chain WITHOUT 217491 a non-owner holding hc.payout CAN draft (that is the gap this closes): X4 / X5 fail there.
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
create or replace function t.qj(p_uid uuid, p_role text, p_sql text) returns jsonb language plpgsql as $f$ declare v text := t.q(p_uid,p_role,p_sql); begin if v like 'ERR%' or v = 'NULL' then return jsonb_build_object('err', v); end if; return v::jsonb; end $f$;
create table if not exists t.w (k text primary key, v text);
create or replace function t.wset(p_k text, p_v text) returns void language sql as $f$ insert into t.w values (p_k,p_v) on conflict (k) do update set v=excluded.v $f$;
create or replace function t.wget(p_k text) returns text language sql as $f$ select v from t.w where k=p_k $f$;
create or replace function t.mkg(p_owner uuid) returns uuid language plpgsql as $f$
declare g uuid := gen_random_uuid(); ts timestamp := (now() at time zone 'UTC') + interval '20 days' - interval '30 days';
begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time, timezone) values (g, p_owner, 'g-'||left(g::text,6), 'dinner', ts::date, ts::time, 'UTC');
  return g;
end $f$;
-- a referred buyer + a web production entitlement + purchase facts (+ the payment row the ledger resolves events through); returns the entitlement id
create or replace function t.mkp(p_code text, p_prod text, p_txn text, p_gid uuid default null) returns uuid language plpgsql as $f$
declare uu uuid; ee uuid; plus boolean := (p_prod = 'plus_annual');
begin
  uu := t.mkuser(); update auth.users set created_at = now() - interval '10 minutes' where id = uu;
  perform t.q(uu,'authenticated','public.record_referral_claim('''||p_code||''', now()-interval ''5 minutes'')');
  insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope,gathering_id)
    values (uu, case when plus then 'plus' else 'gathering_pass' end, p_prod, 'web', p_txn, 'production', now(), case when plus then 'account' else 'gathering' end, case when plus then null else p_gid end) returning id into ee;
  insert into public.purchase_payments(provider,transaction_id,entitlement_id,canonical_product_id,store,environment,currency,gross_amount_minor,stripe_payment_intent_id,purchased_at)
    values ('stripe',p_txn,ee,p_prod,'web','production','USD',case when plus then 5999 else 1500 end,p_txn,now());
  perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,'''||p_txn||''',''usd'','||case when plus then 5999 else 1500 end||',0,200,null,null,''webhook'')');
  return ee;
end $f$;
-- ledger event (service role), event_at = now() + p_sec seconds; returns the outcome
create or replace function t.ev(p_id text, p_kind text, p_type text, p_pi text, p_sec int, p_extra text default '') returns text language plpgsql as $f$
begin
  return coalesce((t.q(null,'service_role','public.apply_payment_event(jsonb_build_object(''provider'',''stripe'',''provider_event_id'','''||p_id||''',''provider_event_type'','''||p_type||''',''event_kind'','''||p_kind||''',''event_at'',now()+interval '''||p_sec||' seconds'',''environment'',''production'',''payment_intent_id'','''||p_pi||''''||p_extra||'))')::jsonb)->>'outcome','ERR');
end $f$;
create or replace function t.sw(p_days int default 0) returns jsonb language sql as $f$ select t.q(null,'service_role','public.sweep_commissions(now()+interval '''||p_days||' days'')')::jsonb $f$;
create or replace function t.cs(p_ent uuid) returns text language sql as $f$ select coalesce((select state||'/'||coalesce(reason,'-') from public.commissions where entitlement_id = p_ent),'none') $f$;
create or replace function t.es(p_ent uuid) returns text language sql as $f$ select active::text||'/'||coalesce(revoked_reason,'-')||'/'||(refunded_at is not null)::text from public.gathering_entitlements where id = p_ent $f$;
create or replace function t.dsp(p_pi text, p_st text) returns void language sql as $f$ select t.q(null,'service_role','public.record_purchase_dispute('''||p_pi||''','''||p_st||''')')::text $f$;
create or replace function t.rec(p_ent uuid) returns text language sql as $f$ select coalesce((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||p_ent||'''::uuid)')::jsonb)->>'status','ERR') $f$;

do $$
declare own uuid:=t.mkuser(); fin uuid:=t.mkuser(); cpm uuid:=t.mkuser(); nos uuid:=t.mkuser(); pid uuid; i int;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(fin,'business_admin'),(cpm,'creator_program_manager');
 perform t.wset('own',own::text); perform t.wset('fin',fin::text); perform t.wset('cpm',cpm::text); perform t.wset('nos',nos::text);
 update public.hc_settings set enabled=true where singleton;
 perform t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''fixture'')');
 insert into public.partners(user_id,display_name,status,tier) values (null,'K Partner','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'kpartner');
 perform t.wset('partner',pid::text);
end $$;
select pg_sleep(0.05);
select t.eq('X0 owner activates paid referrals (scratch only)', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''k suite'')')->>'status','ERR'), 'activated');
select pg_sleep(0.05);
insert into public.staff_role_permissions(role,permission) values ('business_admin','hc.payout');   -- scratch only: a NON-OWNER holding the financial permission
do $$
declare own uuid:=t.wget('own')::uuid; fin uuid:=t.wget('fin')::uuid; cpm uuid:=t.wget('cpm')::uuid; nos uuid:=t.wget('nos')::uuid; pidp uuid:=t.wget('partner')::uuid; i int; j jsonb; pay uuid; before_n int;
begin
 for i in 1..6 loop perform t.rec(t.mkp('kpartner','plus_annual','sub_k'||i)); end loop;
 perform t.sw(46);
 perform t.eq('X1 setup: six validated Plus commissions, role map = owner + (scratch) business_admin', (select count(*) from public.commissions where state='validated')||'/'||(select string_agg(role,',' order by role) from public.staff_role_permissions where permission='hc.payout'), '6/business_admin,owner');
 -- refusals first: nothing may change
 select count(*) into before_n from public.payouts;
 perform t.eq('X2 hc.read-only manager (no hc.payout) denied on draft: not_authorized', t.q(cpm,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'), 'ERR P0001:not_authorized');
 perform t.eq('X3 signed-in user who is not staff denied: not_authorized', t.q(nos,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'), 'ERR P0001:not_authorized');
 perform t.eq('X4 NON-OWNER staff holding hc.payout: draft refused owner_required (database now matches the web)', t.q(fin,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'), 'ERR P0001:owner_required');
 perform t.eq('X5 ... nothing created, the commissions are still validated and unassigned', (select count(*) from public.payouts)-before_n||'/'||(select count(*) from public.commissions where state='validated' and payout_id is null), '0/6');
 perform t.eq('X6 service role (no staff identity) denied', t.q(null,'service_role','public.hc_create_payout_draft('''||pidp||'''::uuid)'), 'ERR P0001:not_authorized');
 perform t.eq('X7 anonymous: no EXECUTE', t.q(null,'anon','public.hc_create_payout_draft('''||pidp||'''::uuid)') like 'ERR 42501%', 'true');
 -- owner drafts
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'); pay := (j->>'payout_id')::uuid;
 perform t.eq('X8 OWNER can draft: 6 x 1200 = 7200, drafted_by owner', (j->>'status')||'/'||(j->>'net_cents')||'/'||((select created_by from public.payouts where id=pay)=own)::text, 'draft/7200/true');
 -- VIEW for non-owner hc.payout
 perform t.eq('X9 non-owner hc.payout can VIEW: payout list contains the draft', (t.qj(fin,'authenticated','public.hc_admin_list_payouts(50)')->0->>'status'), 'draft');
 perform t.eq('X10 ... history', (jsonb_array_length(t.qj(fin,'authenticated','public.hc_admin_payout_history(null,50)')) >= 0)::text, 'true');
 perform t.eq('X11 ... ledger', (t.q(fin,'authenticated','public.hc_admin_payout_ledger()') not like 'ERR%')::text, 'true');
 perform t.eq('X12 ... eligibility', (t.q(fin,'authenticated','public.hc_admin_payout_eligibility()') not like 'ERR%')::text, 'true');
 perform t.eq('X13 ... partial-refund hold list', (t.q(fin,'authenticated','public.hc_admin_list_partial_refund_holds(50)') not like 'ERR%')::text, 'true');
 perform t.eq('X14 hc.read-only manager cannot view any of them', t.q(cpm,'authenticated','public.hc_admin_list_payouts(50)')||'|'||t.q(cpm,'authenticated','public.hc_admin_payout_ledger()')||'|'||t.q(cpm,'authenticated','public.hc_admin_payout_eligibility()'), 'ERR P0001:not_authorized|ERR P0001:not_authorized|ERR P0001:not_authorized');
 -- every other write: owner_required for the non-owner, nothing changed
 perform t.eq('X15 non-owner hc.payout: approve owner_required', t.q(fin,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'), 'ERR P0001:owner_required');
 perform t.eq('X16 non-owner hc.payout: void owner_required', t.q(fin,'authenticated','public.hc_void_payout('''||pay||'''::uuid,''reason text'')'), 'ERR P0001:owner_required');
 perform t.eq('X17 non-owner hc.payout: record owner_required', t.q(fin,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-K-0001'',current_date,''bank transfer'',true)'), 'ERR P0001:owner_required');
 perform t.eq('X18 non-owner hc.payout: reverse owner_required', t.q(fin,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''reason text'')'), 'ERR P0001:owner_required');
 perform t.eq('X19 non-owner hc.payout: settle owner_required', t.q(fin,'authenticated','public.hc_settle_clawback(gen_random_uuid(),''waived'',null,''note'',true)'), 'ERR P0001:owner_required');
 perform t.eq('X20 hc.read-only manager: approve / void / record / reverse denied', t.q(cpm,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')||'|'||t.q(cpm,'authenticated','public.hc_void_payout('''||pay||'''::uuid,''reason text'')')||'|'||t.q(cpm,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-K-0002'',current_date,''bank transfer'',true)')||'|'||t.q(cpm,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''reason text'')'), 'ERR P0001:not_authorized|ERR P0001:not_authorized|ERR P0001:not_authorized|ERR P0001:not_authorized');
 perform t.eq('X21 the draft is untouched by every refusal', (select status||'/'||total_cents from public.payouts where id=pay), 'draft/7200');
 -- owner keeps working end to end (existing controls unchanged)
 perform t.eq('X22 owner approves', t.qj(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')->>'status', 'approved');
 perform t.eq('X23 owner records the externally completed payment (no automatic transfer)', t.qj(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-K-0003'',current_date,''bank transfer'',true)')->>'status', 'paid_recorded');
 perform t.eq('X24 paid referrals default / economics: min payout still 5000 (a 3-commission draft is below minimum)', (select min_payout_cents from public.hc_terms_versions where version=1)::text, '5000');
end $$;
delete from public.staff_role_permissions where role='business_admin' and permission='hc.payout';
select t.eq('X25 scratch permission removed: hc.payout held by owner only', (select string_agg(role,',') from public.staff_role_permissions where permission='hc.payout'), 'owner');
select t.eq('X26 function ACL: authenticated + service_role may execute (body enforces owner), anon / public may not', (select (has_function_privilege('authenticated','public.hc_create_payout_draft(uuid)','execute'))::text||'/'||(has_function_privilege('anon','public.hc_create_payout_draft(uuid)','execute'))::text||'/'||(has_function_privilege('public','public.hc_create_payout_draft(uuid)','execute'))::text), 'true/false/false');
select t.report();
