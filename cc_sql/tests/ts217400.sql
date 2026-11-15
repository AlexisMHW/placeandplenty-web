-- Agent S2 suite for 217400..217450 (founder decisions D-1..D-4 + E-PLUS). Scratch Postgres only; runs after harness.sql on the full chain with ALL steps (incl. 202100) applied.
-- usage: bash tests/s2_sql/scripts/run_tf.sh <full_chain_db> out.txt cc_sql/tests/ts217400.sql
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
create table if not exists t.w (k text primary key, v text);
create or replace function t.wset(p_k text, p_v text) returns void language sql as $f$ insert into t.w values (p_k,p_v) on conflict (k) do update set v=excluded.v $f$;
create or replace function t.wget(p_k text) returns text language sql as $f$ select v from t.w where k=p_k $f$;
-- run a statement as the superuser with a simulated identity (no role switch => no table privilege / RLS effects; triggers and in-body guards still see auth.uid())
create or replace function t.as_claims(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', case when p_role is null and p_uid is null then '' else json_build_object('sub',p_uid,'role',p_role)::text end, true);
  begin execute 'select ('||p_sql||')::text' into v; exception when others then v := 'ERR '||sqlstate||':'||sqlerrm; end;
  perform set_config('request.jwt.claims','',true);
  return coalesce(v,'NULL');
end $f$;
-- json variant of t.q: errors come back as {"err": "..."} so a failing call is reported as a FAIL instead of aborting the block
create or replace function t.qj(p_uid uuid, p_role text, p_sql text) returns jsonb language plpgsql as $f$ declare v text := t.q(p_uid,p_role,p_sql); begin if v like 'ERR%' or v = 'NULL' then return jsonb_build_object('err', v); end if; return v::jsonb; end $f$;
-- try a statement in a subtransaction that is ALWAYS rolled back: returns 'OK' or 'ERR sqlstate:message' (role switching optional via p_role not null)
create or replace function t.try(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text := 'OK';
begin
  perform set_config('request.jwt.claims', case when p_uid is null and p_role is null then '' when p_uid is null then json_build_object('role',p_role)::text else json_build_object('sub',p_uid,'role',coalesce(p_role,'authenticated'))::text end, true);
  begin
    if p_role is not null then execute 'set local role '||quote_ident(p_role); end if;
    execute p_sql;
    raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm = 'T_ROLLBACK' then v := 'OK'; else v := 'ERR '||sqlstate||':'||sqlerrm; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims','',true);
  return v;
end $f$;
-- a gathering whose lifecycle_ends_at (= event + 30 days, UTC) is exactly now() + p_delta (default 0). status active/cancelled/draft; completion follows from the date.
create or replace function t.mkg(p_owner uuid, p_status text, p_ends_delta interval default interval '0') returns uuid language plpgsql as $f$
declare g uuid := gen_random_uuid(); ts timestamp := (now() at time zone 'UTC') + p_ends_delta - interval '30 days';
begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time, timezone) values (g, p_owner, 'g-'||left(g::text,6), 'dinner', ts::date, ts::time, 'UTC');
  if p_status = 'cancelled' then perform set_config('placeandplenty.lifecycle_transition','cancel',true); end if;   -- canonical transition marker (gatherings status authority trigger)
  update public.gatherings set status = p_status::gathering_status where id = g;
  perform set_config('placeandplenty.lifecycle_transition','',true);
  return g;
end $f$;
create or replace function t.mkp(p_code text, p_prod text, p_txn text, p_at timestamptz, p_gid uuid default null) returns uuid language plpgsql as $f$
declare uu uuid; ee uuid; plus boolean := (p_prod = 'plus_annual');
begin
  uu := t.mkuser(); update auth.users set created_at = now() - interval '10 minutes' where id = uu;
  perform t.q(uu,'authenticated','public.record_referral_claim('''||p_code||''', now()-interval ''5 minutes'')');
  insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope,gathering_id)
    values (uu, case when plus then 'plus' else 'gathering_pass' end, p_prod, 'web', p_txn, 'production', p_at, case when plus then 'account' else 'gathering' end, case when plus then null else p_gid end) returning id into ee;
  perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,'''||p_txn||''',''usd'','||case when plus then 5999 else 1500 end||',0,200,null,null,''webhook'')');
  return ee;
end $f$;

create or replace function t.rec(p_ent text) returns text language plpgsql as $f$
declare j text := t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||p_ent||'''::uuid)'); c record;
begin
  select commission_cents, state into c from public.commissions where entitlement_id = p_ent::uuid;
  return coalesce(j::jsonb->>'status', j)||'/'||coalesce(c.commission_cents::text,'-')||'/'||coalesce(c.state,'-');
end $f$;
-- ===================== setup: staff, partner, tier =====================
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); bad uuid:=t.mkuser(); fin uuid:=t.mkuser(); pid uuid;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager'),(fin,'business_admin');
 perform t.wset('own',own::text); perform t.wset('cpm',cpm::text); perform t.wset('fin',fin::text); perform t.wset('bad',bad::text);
 update public.hc_settings set enabled=true where singleton;
 perform t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''fixture'')');
 insert into public.partners(user_id,display_name,status,tier) values (null,'S2 Partner','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'s2partner');
 perform t.wset('partner', pid::text);
 perform t.eq('Z0.1 start state: paid referrals OFF, no window rows, approved economics (Pass 50c, Plus 1200c, hold 45d, min 5000c)',
   (select (not paid_referrals_enabled)::text from public.hc_settings where singleton)||'/'||(select count(*) from public.hc_paid_referral_windows)||'/'||
   (select string_agg(canonical_product_id||'='||amount_cents, ',' order by canonical_product_id) from public.hc_terms_amounts where version=1)||'/'||(select validation_days||'/'||min_payout_cents from public.hc_terms_versions where version=1),
   'true/0/gathering_pass=50,plus_annual=1200/45/5000');
end $$;

-- ===================== D-3: NO RETROACTIVE ACCRUAL (append-only paid-referral windows) =====================
-- Each top-level statement below is its OWN transaction, so now() really advances between activation / deactivation / purchases (separate pg_sleep steps).
select t.wset('g_pass', t.mkg(t.wget('own')::uuid,'active', interval '20 days')::text);
select t.wset('e_off_plus', t.mkp('s2partner','plus_annual','s2-w-off-plus', now())::text);
select t.wset('e_off_pass', t.mkp('s2partner','gathering_pass','s2-w-off-pass', now(), t.wget('g_pass')::uuid)::text);
select t.eq('W1.1 while OFF (before the first activation): reconcile reports paid_referrals_disabled and creates nothing', (t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_off_plus')||'''::uuid)')::jsonb)->>'status'||'/'||(select count(*) from public.commissions), 'paid_referrals_disabled/0');
select t.eq('W1.2 while OFF: maintenance is a complete no-op', ((t.q(null,'service_role','public.hc_commission_maintenance()'))::jsonb)->>'status'||'/'||(select count(*) from public.commissions), 'paid_referrals_disabled/0');
select pg_sleep(0.05);
select t.eq('W1.3 owner activates paid referrals (first activation)', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''s2 window one'')')->>'status','ERR'), 'activated');
select t.wset('s1', (select started_at::text from public.hc_paid_referral_windows order by id limit 1));
select t.eq('W1.4 exactly one open window, started at the activation instant, with actor and reason', (select count(*)||'/'||count(*) filter (where ended_at is null)||'/'||bool_and(started_by = t.wget('own')::uuid)||'/'||min(start_reason) from public.hc_paid_referral_windows), '1/1/true/s2 window one');
-- purchases made BEFORE the first activation, reconciled AFTER it
select t.eq('W1.5 purchase made while OFF, reconciled after activation: NOT accrued, clear reason (Plus)', t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_off_plus')||'''::uuid)'), '{"reason": "paid_referrals_off_at_purchase", "status": "not_qualifying_paid_referrals_off_at_purchase"}');
select t.eq('W1.6 same for the Gathering Pass', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_off_pass')||'''::uuid)'))::jsonb)->>'status', 'not_qualifying_paid_referrals_off_at_purchase');
select t.eq('W1.7 maintenance after activation: those purchases are not even candidates (skipped_off_at_purchase = 2), zero commissions', (select ((j::jsonb)->>'skipped_off_at_purchase')||'/'||((j::jsonb)->>'reconciled')||'/'||((j::jsonb)->>'accrued')||'/'||((j::jsonb)->>'status')||'/'||(select count(*) from public.commissions) from (select t.q(null,'service_role','public.hc_commission_maintenance()') j) x), '2/0/0/ok/0');
select t.eq('W1.8 sweep (even 46 days later) creates nothing', ((t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')'))::jsonb)->>'status'||'/'||(select count(*) from public.commissions), 'ok/0');
-- purchases made while ON accrue exactly as before
select t.wset('e_on_plus', t.mkp('s2partner','plus_annual','s2-w-on-plus', now())::text);
select t.wset('e_on_pass', t.mkp('s2partner','gathering_pass','s2-w-on-pass', now(), t.wget('g_pass')::uuid)::text);
select t.eq('W2.1 purchase made while ON: Plus annual first qualifying purchase accrues $12.00 pending', t.rec(t.wget('e_on_plus')), 'pending/1200/pending');
select t.eq('W2.1b the commission froze terms version 1 (Plus 1200c, 45-day hold, 5000c minimum, 30-day window)', (select terms_version||'/'||terms_amount_cents||'/'||terms_validation_days||'/'||terms_min_payout_cents||'/'||terms_window_days from public.commissions where entitlement_id=t.wget('e_on_plus')::uuid), '1/1200/45/5000/30');
select t.eq('W2.2 Gathering Pass first qualifying purchase accrues $0.50 pending', t.rec(t.wget('e_on_pass')), 'pending/50/pending');
select t.eq('W2.3 replay is idempotent (already_recorded), still exactly 2 rows', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_on_plus')||'''::uuid)'))::jsonb)->>'status'||'/'||(select count(*) from public.commissions), 'already_recorded/2');
-- boundary instants of window 1 (start)
select t.wset('e_b_s1', t.mkp('s2partner','plus_annual','s2-w-b-s1', t.wget('s1')::timestamptz)::text);
select t.wset('e_b_s1m', t.mkp('s2partner','plus_annual','s2-w-b-s1m', t.wget('s1')::timestamptz - interval '1 microsecond')::text);
select t.eq('W3.1 purchase EXACTLY at the activation instant is inside the window (start included): accrues 1200', t.rec(t.wget('e_b_s1')), 'pending/1200/pending');
select t.eq('W3.2 purchase one microsecond BEFORE the activation instant is outside: not accrued', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_b_s1m')||'''::uuid)'))::jsonb)->>'status'||'/'||(select count(*) from public.commissions where entitlement_id=t.wget('e_b_s1m')::uuid), 'not_qualifying_paid_referrals_off_at_purchase/0');
-- a purchase made inside window 1 but only reconciled after later OFF/ON toggles must still qualify (decided by purchase time, not by when reconcile runs)
select t.wset('e_w1_late', t.mkp('s2partner','plus_annual','s2-w-w1-late', now())::text);
select pg_sleep(0.05);
-- OFF2
select t.eq('W4.1 owner deactivates (OFF2)', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_deactivate_paid_referrals(''s2 window one ends'')')->>'status','ERR'), 'deactivated');
select t.wset('e1', (select ended_at::text from public.hc_paid_referral_windows order by id limit 1));
select t.eq('W4.2 window 1 is sealed at the deactivation instant with actor and reason; nothing else changed', (select (ended_at = t.wget('e1')::timestamptz and ended_at > started_at)::text||'/'||(ended_by = t.wget('own')::uuid)::text||'/'||end_reason from public.hc_paid_referral_windows order by id limit 1), 'true/true/s2 window one ends');
select t.eq('W4.3 already-created commissions untouched by the deactivation: 3 rows pending/validated unchanged amounts', (select count(*)||'/'||sum(commission_cents) from public.commissions), '3/2450');
select pg_sleep(0.05);
-- purchases made while OFF (gap between window 1 and window 2)
select t.wset('e_gap', t.mkp('s2partner','plus_annual','s2-w-gap', now())::text);
select pg_sleep(0.05);
-- ON2
select t.eq('W5.1 owner re-activates (ON2)', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''s2 window two'')')->>'status','ERR'), 'activated');
select t.wset('s2', (select started_at::text from public.hc_paid_referral_windows order by id desc limit 1));
select t.wset('e_b_e1', t.mkp('s2partner','plus_annual','s2-w-b-e1', t.wget('e1')::timestamptz)::text);
select t.wset('e_b_e1m', t.mkp('s2partner','plus_annual','s2-w-b-e1m', t.wget('e1')::timestamptz - interval '1 microsecond')::text);
select t.wset('e_b_s2', t.mkp('s2partner','plus_annual','s2-w-b-s2', t.wget('s2')::timestamptz)::text);
select t.wset('e_b_s2m', t.mkp('s2partner','plus_annual','s2-w-b-s2m', t.wget('s2')::timestamptz - interval '1 microsecond')::text);
select t.eq('W5.2 purchase made in the OFF gap, reconciled after ON2: NOT accrued', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_gap')||'''::uuid)'))::jsonb)->>'status', 'not_qualifying_paid_referrals_off_at_purchase');
select t.eq('W5.3 purchase EXACTLY at the deactivation instant: outside (end excluded), not accrued', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_b_e1')||'''::uuid)'))::jsonb)->>'status', 'not_qualifying_paid_referrals_off_at_purchase');
select t.eq('W5.4 purchase one microsecond BEFORE the deactivation instant is inside window 1: accrues even though reconciled during window 2', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_b_e1m')||'''::uuid)'))::jsonb)->>'status', 'pending');
select t.eq('W5.5 purchase EXACTLY at the second activation instant: accrues', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_b_s2')||'''::uuid)'))::jsonb)->>'status', 'pending');
select t.eq('W5.6 purchase one microsecond before the second activation: not accrued', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_b_s2m')||'''::uuid)'))::jsonb)->>'status', 'not_qualifying_paid_referrals_off_at_purchase');
select t.eq('W5.7 purchase made inside window 1 but reconciled only now (after OFF + ON): accrues', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_w1_late')||'''::uuid)'))::jsonb)->>'status', 'pending');
-- OFF3 by a DIRECT service-role update of the switch (no function): still recorded; then ON3 via the function
select pg_sleep(0.05);
select t.eq('W6.1 direct service-role flip of the switch is recorded too (window 2 sealed)', (select (case when (select count(*) from public.hc_paid_referral_windows where ended_at is null)=1 then 'open1' end)), 'open1');
update public.hc_settings set paid_referrals_enabled = false where singleton;
select t.eq('W6.2 after the direct flip: 2 windows, none open', (select count(*)||'/'||count(*) filter (where ended_at is null) from public.hc_paid_referral_windows), '2/0');
select pg_sleep(0.05);
select t.wset('e_gap2', t.mkp('s2partner','plus_annual','s2-w-gap2', now())::text);
select pg_sleep(0.05);
select t.eq('W6.3 ON3', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''s2 window three'')')->>'status','ERR'), 'activated');
select t.eq('W6.4 purchase made in the second OFF gap, reconciled after ON3: not accrued', ((t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||t.wget('e_gap2')||'''::uuid)'))::jsonb)->>'status', 'not_qualifying_paid_referrals_off_at_purchase');
select t.wset('e_on3', t.mkp('s2partner','plus_annual','s2-w-on3', now())::text);
-- maintenance + sweep over everything
select t.eq('W7.1 maintenance after all toggles: reconciles only ON-time purchases (e_on3 accrues); every OFF-time purchase is skipped', (select ((j::jsonb)->>'status')||'/'||((j::jsonb)->>'accrued')||'/'||((j::jsonb)->>'skipped_off_at_purchase') from (select t.q(null,'service_role','public.hc_commission_maintenance()') j) x), 'ok/1/7');
select t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')');
select t.eq('W7.2 final commission set = exactly the ON-time purchases (on_plus, on_pass, s1, e1-1us, s2, w1_late, on3); NO off / gap / boundary-outside purchase has a row',
  (select string_agg(pf.provider_transaction_id, ',' order by pf.provider_transaction_id) from public.commissions c join public.commission_purchase_facts pf on pf.entitlement_id=c.entitlement_id),
  's2-w-b-e1m,s2-w-b-s1,s2-w-b-s2,s2-w-on-pass,s2-w-on-plus,s2-w-on3,s2-w-w1-late');
select t.eq('W7.3 not one commission exists for an off-time purchase (off x2, s1-1us, gap, e1, s2-1us, gap2)', (select count(*) from public.commissions c join public.commission_purchase_facts pf on pf.entitlement_id=c.entitlement_id where pf.provider_transaction_id in ('s2-w-off-plus','s2-w-off-pass','s2-w-b-s1m','s2-w-gap','s2-w-b-e1','s2-w-b-s2m','s2-w-gap2'))::text, '0');
select t.eq('W7.4 amounts exactly as approved: Plus 1200c (x6), Pass 50c (x1); validated after the 45-day hold', (select string_agg(canonical_product_id||':'||commission_cents||':'||state, ',' order by canonical_product_id, purchased_at) from public.commissions), 'gathering_pass:50:validated,plus_annual:1200:validated,plus_annual:1200:validated,plus_annual:1200:validated,plus_annual:1200:validated,plus_annual:1200:validated,plus_annual:1200:validated');
select t.eq('W7.5 three windows: closed, closed, open', (select string_agg(case when ended_at is null then 'open' else 'closed' end, ',' order by id) from public.hc_paid_referral_windows), 'closed,closed,open');
-- tamper-proofing
do $$ declare v text; begin
  begin update public.hc_paid_referral_windows set started_at = started_at - interval '1 day' where id = (select min(id) from public.hc_paid_referral_windows); v := 'updated'; exception when others then v := sqlerrm; end;
  perform t.eq('W8.1 cannot rewrite a window start (tamper-proof)', v, 'hc_ledger_is_append_only');
  begin update public.hc_paid_referral_windows set ended_at = ended_at + interval '1 day' where id = (select min(id) from public.hc_paid_referral_windows); v := 'updated'; exception when others then v := sqlerrm; end;
  perform t.eq('W8.2 cannot move the end of a sealed window', v, 'hc_ledger_is_append_only');
  begin delete from public.hc_paid_referral_windows; v := 'deleted'; exception when others then v := sqlerrm; end;
  perform t.eq('W8.3 cannot delete windows', v, 'hc_ledger_is_append_only');
  begin truncate public.hc_paid_referral_windows; v := 'truncated'; exception when others then v := sqlerrm; end;
  perform t.eq('W8.4 cannot truncate windows', v, 'hc_ledger_is_append_only');
  begin insert into public.hc_paid_referral_windows(started_at) values (now()); v := 'inserted'; exception when others then v := sqlstate; end;
  perform t.eq('W8.5 at most one open window (unique)', v, '23505');
  begin update public.hc_paid_referral_windows set ended_at = started_at - interval '1 second' where ended_at is null; v := 'updated'; exception when others then v := sqlstate; end;
  perform t.eq('W8.6 an open window cannot be sealed before it started (check / guard)', v, 'P0001');
  perform t.eq('W8.7 API roles have no access to the table or the helper', (has_table_privilege('authenticated','public.hc_paid_referral_windows','select') or has_table_privilege('anon','public.hc_paid_referral_windows','select')
     or has_table_privilege('service_role','public.hc_paid_referral_windows','insert') or has_table_privilege('service_role','public.hc_paid_referral_windows','update') or has_table_privilege('service_role','public.hc_paid_referral_windows','delete')
     or has_function_privilege('authenticated','public.hc_paid_referrals_on_at(timestamptz)','execute') or has_function_privilege('anon','public.hc_paid_referrals_on_at(timestamptz)','execute'))::text||'/'||has_table_privilege('service_role','public.hc_paid_referral_windows','select')::text, 'false/true');
  perform t.eq('W8.8 helper boundary semantics: before first start false, at start true, inside true, at end false, null false', (select string_agg(public.hc_paid_referrals_on_at(x)::text, ',') from (values (t.wget('s1')::timestamptz - interval '1 microsecond'), (t.wget('s1')::timestamptz), (t.wget('s1')::timestamptz + interval '1 microsecond'), (t.wget('e1')::timestamptz - interval '1 microsecond'), (t.wget('e1')::timestamptz), (t.wget('s2')::timestamptz - interval '1 microsecond'), (t.wget('s2')::timestamptz), (null::timestamptz)) v(x)), 'false,true,true,true,false,false,true,false');
  perform t.eq('W8.9 service role may read the windows (audit), cannot write', t.q(null,'service_role','(select count(*) from public.hc_paid_referral_windows)')||'/'||left(t.x(null,'service_role','insert into public.hc_paid_referral_windows(started_at) values (now())'),9), '3/ERR 42501');
end $$;

-- ===================== D-1: create_purchase_intent(gathering_pass) needs start_purchase (regression guard; NOT widened) =====================
do $$
declare o uuid:=t.mkuser(); l uuid:=t.mkuser(); m uuid:=t.mkuser(); p uuid:=t.mkuser(); x uuid:=t.mkuser(); g uuid; r text;
begin
 g := t.mkg(o,'active', interval '20 days');   -- future-ish window irrelevant for an active gathering
 update public.gatherings set gathering_date=current_date+20 where id=g;
 insert into public.gathering_members(gathering_id,user_id,invited_email,status,accepted_at,permission_level) values
   (g,l,'s2l@x.test','accepted',now(),'legacy_full'),(g,m,'s2m@x.test','accepted',now(),'manager'),(g,p,'s2p@x.test','accepted',now(),'planner');
 perform t.eq('D1.0 capability map unchanged: start_purchase is held ONLY by legacy_full (owner implicit)', (select string_agg(level,',' order by level) from public.cohost_level_capabilities where capability='start_purchase'), 'legacy_full');
 r := t.q(o,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'); perform t.eq('D1.1 owner may start a Gathering Pass purchase', (r ~ '^[0-9a-f-]{36}$')::text, 'true');
 r := t.q(l,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'); perform t.eq('D1.2 legacy_full co-host may', (r ~ '^[0-9a-f-]{36}$')::text, 'true');
 perform t.eq('D1.3 manager co-host is DENIED', t.q(m,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'), 'ERR P0001:not your gathering');
 perform t.eq('D1.4 planner co-host is DENIED', t.q(p,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'), 'ERR P0001:not your gathering');
 perform t.eq('D1.5 stranger is DENIED', t.q(x,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'), 'ERR P0001:not your gathering');
 perform t.eq('D1.6 anon is DENIED (no EXECUTE or no identity)', (t.q(null,'anon','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)') ~ '^ERR')::text, 'true');
 perform t.eq('D1.7 Pass without a gathering is refused', t.q(o,'authenticated','public.create_purchase_intent(''gathering_pass'',null)'), 'ERR P0001:gathering required');
 -- the rule follows cohost_level_capabilities ONLY when that table is explicitly changed (we change and restore it here)
 insert into public.cohost_level_capabilities(level,capability) values ('manager','start_purchase');
 r := t.q(m,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'); perform t.eq('D1.8 only after an EXPLICIT capability change may a manager purchase', (r ~ '^[0-9a-f-]{36}$')::text, 'true');
 delete from public.cohost_level_capabilities where level='manager' and capability='start_purchase';
 perform t.eq('D1.9 restored: manager denied again', t.q(m,'authenticated','public.create_purchase_intent(''gathering_pass'','''||g||'''::uuid)'), 'ERR P0001:not your gathering');
 perform t.eq('D1.10 capability map restored (legacy_full only)', (select string_agg(level,',' order by level) from public.cohost_level_capabilities where capability='start_purchase'), 'legacy_full');
end $$;

-- ===================== D-2: payout READ = hc.payout; WRITE = owner only =====================
do $$
declare own uuid:=t.wget('own')::uuid; cpm uuid:=t.wget('cpm')::uuid; fin uuid:=t.wget('fin')::uuid; bad uuid:=t.wget('bad')::uuid; j text; pay uuid; rep jsonb; fn text; r text; n int; pid uuid; ee uuid; i int;
begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'S2 Partner Two','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'s2partner2');
 -- program fixture: activate (windows 217400 record it), 6 validated commissions of 1200c => 7200c draft
 perform t.q(own,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''s2 scratch'')');
 for i in 1..6 loop
   ee := t.mkp('s2partner2','plus_annual','s2-d2-'||i, now());
   perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||ee||'''::uuid)');
 end loop;
 perform t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')');
 perform t.eq('D2.0 fixture: 6 validated commissions of 1200c (Plus annual, first qualifying purchase)', (select count(*)||'/'||sum(commission_cents) from public.commissions where state='validated' and partner_id=pid), '6/7200');
 -- reads: owner yes, hc.read-only manager no
 foreach fn in array array['public.hc_admin_payout_ledger()','public.hc_admin_list_payouts(10)','public.hc_admin_payout_history(null,10)','public.hc_admin_payout_eligibility()'] loop
   perform t.eq('D2.1 owner can read '||fn, (t.q(own,'authenticated',fn) not like 'ERR%')::text, 'true');
   perform t.eq('D2.2 creator_program_manager (hc.read only) CANNOT read '||fn, t.q(cpm,'authenticated',fn), 'ERR P0001:not_authorized');
   perform t.eq('D2.3 business_admin (hc.read only) CANNOT read '||fn, t.q(fin,'authenticated',fn), 'ERR P0001:not_authorized');
   perform t.eq('D2.4 non-staff / anon cannot read '||fn, (t.q(bad,'authenticated',fn) = 'ERR P0001:not_authorized' and t.q(null,'anon',fn) like 'ERR 42501%')::text, 'true');
 end loop;
 -- commission report: still readable by hc.read, but no payout-side money without hc.payout
 rep := t.q(own,'authenticated','public.hc_admin_commission_report()')::jsonb;
 perform t.eq('D2.5 owner report has clawback keys and the validated bucket', (select bool_and(p ? 'outstanding_clawback_cents' and p ? 'clawback_pending_contract_language') from jsonb_array_elements(rep->'partners') p)::text||'/'||((rep->'partners'->0->'by_state') ? 'validated')::text, 'true/true');
 rep := t.q(cpm,'authenticated','public.hc_admin_commission_report()')::jsonb;
 perform t.eq('D2.6 manager (hc.read) still reads the report (counts / pending / validated)', ((rep->'partners'->0->'by_state') ? 'validated')::text||'/'||(rep->'partners'->0->>'signups'), 'true/'||(select count(*) from public.referral_claims where partner_id=t.wget('partner')::uuid));
 perform t.eq('D2.7 manager report carries NO clawback keys', (select bool_or(p ? 'outstanding_clawback_cents' or p ? 'clawback_pending_contract_language') from jsonb_array_elements(rep->'partners') p)::text, 'false');
 -- owner drafts (allowed for hc.payout) ; a non-owner who HOLDS hc.payout reads but cannot change anything
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pid||'''::uuid)')::text; pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('D2.8 owner draft = 7200', (j::jsonb)->>'net_cents', '7200');
 insert into public.staff_role_permissions(role,permission) values ('business_admin','hc.payout');   -- scratch: business_admin explicitly granted the financial permission
 perform t.eq('D2.9 non-owner holding hc.payout can now READ the ledger, list, history, eligibility',
   (t.q(fin,'authenticated','public.hc_admin_payout_ledger()') not like 'ERR%' and t.q(fin,'authenticated','public.hc_admin_list_payouts(10)') not like 'ERR%' and t.q(fin,'authenticated','public.hc_admin_payout_history(null,10)') not like 'ERR%' and t.q(fin,'authenticated','public.hc_admin_payout_eligibility()') not like 'ERR%')::text, 'true');
 rep := t.q(fin,'authenticated','public.hc_admin_commission_report()')::jsonb;
 perform t.eq('D2.10 ... and then also sees the payout-side keys in the commission report', (select bool_and(p ? 'outstanding_clawback_cents') from jsonb_array_elements(rep->'partners') p)::text, 'true');
 perform t.eq('D2.11 non-owner with hc.payout CANNOT approve (owner_required), payout untouched', t.q(fin,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:owner_required/draft');
 perform t.eq('D2.12 non-owner with hc.payout CANNOT void a draft, payout untouched', t.q(fin,'authenticated','public.hc_void_payout('''||pay||'''::uuid,''nope nope'')')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:owner_required/draft');
 perform t.eq('D2.13 owner approves (approval is not payment)', t.qj(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')->>'status', 'approved');
 perform t.eq('D2.14 non-owner with hc.payout CANNOT record an externally completed payment, payout still approved',
   t.q(fin,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-1001'',current_date,''bank transfer'',true)')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:owner_required/approved');
 perform t.eq('D2.15 non-owner with hc.payout CANNOT void an approved payout', t.q(fin,'authenticated','public.hc_void_payout('''||pay||'''::uuid,''nope nope'')')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:owner_required/approved');
 perform t.eq('D2.16 owner records the externally completed payment', coalesce(t.qj(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-1001'',current_date,''bank transfer'',true)')->>'status','ERR'), 'paid_recorded');
 perform t.eq('D2.17 non-owner with hc.payout CANNOT reverse a recorded payment, payout still paid', t.q(fin,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''returned'')')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:owner_required/paid');
 perform t.eq('D2.18 non-owner with hc.payout CANNOT settle a clawback (owner gate runs before any lookup)', t.q(fin,'authenticated','public.hc_settle_clawback(gen_random_uuid(),''waived'',null,''note'',true)'), 'ERR P0001:owner_required');
 perform t.eq('D2.19 control: the owner passes the owner gate (reaches the business rule no_clawback)', t.q(own,'authenticated','public.hc_settle_clawback(gen_random_uuid(),''waived'',null,''note'',true)'), 'ERR P0001:no_clawback');
 perform t.eq('D2.20 service_role / no identity is not the owner', t.as_claims(null,'service_role','public.hc_is_owner()')||'/'||t.as_claims(own,'authenticated','public.hc_is_owner()')||'/'||t.as_claims(fin,'authenticated','public.hc_is_owner()'), 'false/true/false');
 r := coalesce(t.qj(own,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''bank returned it'')')->>'status','ERR');
 perform t.eq('D2.21 the owner reverses the recorded payment (reason required, audit row written)', r||'/'||(select count(*) from public.payout_events where payout_id=pay and event='payment_reversed'), 'reversed/1');
 delete from public.staff_role_permissions where role='business_admin' and permission='hc.payout';
 perform t.eq('D2.22 scratch permission removed again: business_admin back to hc.read only, reads denied', t.q(fin,'authenticated','public.hc_admin_payout_ledger()'), 'ERR P0001:not_authorized');
 perform t.eq('D2.23 role map unchanged: hc.payout is held by owner only', (select string_agg(role,',') from public.staff_role_permissions where permission='hc.payout'), 'owner');
 perform t.eq('D2.24 no automated money movement: no payout/commission function calls net.http / stripe / transfer, no new cron job', (select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f' and (p.proname like 'hc\_%' or p.proname like '%payout%' or p.proname like '%commission%') and pg_get_functiondef(p.oid) ~* '(net\.http_|api\.stripe|stripe\.transfer|transfer_money)')||'/'||(select count(*) from cron.job where jobname not in ('hc_commission_maintenance_daily','process-scheduled-host-reminders')), '0/0');
end $$;

-- ===================== E-PLUS: dispute / partial refund on a PLUS charge reach the purchase facts =====================
create or replace function t.sweepnow() returns void language sql as $f$ select t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')')::text; $f$;
do $$
declare own uuid:=t.wget('own')::uuid; pidp uuid; eA uuid; eB uuid; eC uuid; eG uuid; gG uuid; r text; j text; ev uuid; n0 int; i int; pays uuid[] := '{}'; e uuid; pay uuid; v text;
begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'S2 Plus Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'s2plus');
 gG := t.wget('g_pass')::uuid;
 -- A: Plus granted through the ledger: purchase_payments knows subscription, invoice, payment intent and charge; facts keyed by the SUBSCRIPTION id
 eA := t.mkp('s2plus','plus_annual','sub_A', now());
 insert into public.purchase_payments(provider,transaction_id,entitlement_id,canonical_product_id,store,environment,currency,gross_amount_minor,stripe_payment_intent_id,stripe_invoice_id,stripe_charge_id,stripe_subscription_id,purchased_at)
   values ('stripe','sub_A',eA,'plus_annual','web','production','USD',5999,'pi_A','in_A','ch_A','sub_A',now());
 -- B: v18-granted Plus (no purchase_payments row); the renewal invoice's charge is linked through subscription_invoice_payments
 eB := t.mkp('s2plus','plus_annual','sub_B', now());
 insert into public.subscription_invoice_payments(provider_event_id,invoice_id,subscription_id,transaction_id,billing_reason,is_renewal,payment_intent_id,charge_id,paid_at,environment)
   values ('evt_B','in_B2','sub_B','sub_B','subscription_cycle',true,'pi_B2','ch_B2',now(),'production');
 -- C: v18-granted Plus linked only through the payment_linked entitlement event (invoice -> payment_intent / charge)
 eC := t.mkp('s2plus','plus_annual','sub_C', now());
 insert into public.entitlement_events(entitlement_id,user_id,event_type,source,provider_transaction_id,payload)
   select eC, user_id, 'payment_linked', 'web', 'in_C', '{"payment_intent":"pi_C","charge":"ch_C"}'::jsonb from public.gathering_entitlements where id=eC;
 -- G: Gathering Pass: facts keyed by the PaymentIntent itself
 eG := t.mkp('s2plus','gathering_pass','pi_G', now(), gG);
 foreach e in array array[eA,eB,eC,eG] loop perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||e||'''::uuid)'); end loop;
 perform t.eq('P0.1 fixtures: Plus A/B/C 1200c, Pass 50c, all pending', (select string_agg(commission_cents||':'||state,',' order by commission_cents desc) from public.commissions where entitlement_id in (eA,eB,eC,eG)), '1200:pending,1200:pending,1200:pending,50:pending');
 -- grants / shape
 perform t.eq('P0.2 helper is internal: not callable by anon / authenticated, callable by service_role; record_purchase_dispute keeps service-only + void', (has_function_privilege('anon','public.resolve_purchase_fact_entitlements(text)','execute') or has_function_privilege('authenticated','public.resolve_purchase_fact_entitlements(text)','execute'))::text||'/'||has_function_privilege('service_role','public.resolve_purchase_fact_entitlements(text)','execute')::text||'/'||(select pg_get_function_result(oid) from pg_proc where oid='public.record_purchase_dispute(text,text)'::regprocedure)||'/'||has_function_privilege('authenticated','public.record_purchase_dispute(text,text)','execute')::text, 'false/true/void/false');
 -- resolution through each linkage
 perform t.eq('P1.1 resolver: PaymentIntent of the Plus charge -> A', (select string_agg(entitlement_id::text, ',') from public.resolve_purchase_fact_entitlements('pi_A')), eA::text);
 perform t.eq('P1.2 resolver: invoice / charge / subscription ids of A all resolve to A', (select count(distinct entitlement_id)||'/'||count(*) from (select * from public.resolve_purchase_fact_entitlements('in_A') union all select * from public.resolve_purchase_fact_entitlements('ch_A') union all select * from public.resolve_purchase_fact_entitlements('sub_A')) x), '1/3');
 perform t.eq('P1.3 resolver: renewal-invoice PaymentIntent / charge -> B (subscription_invoice_payments)', (select count(distinct entitlement_id)||'/'||min(entitlement_id::text) from (select * from public.resolve_purchase_fact_entitlements('pi_B2') union all select * from public.resolve_purchase_fact_entitlements('ch_B2')) x), '1/'||eB::text);
 perform t.eq('P1.4 resolver: payment_linked event payload (PaymentIntent, charge) and its invoice -> C', (select count(distinct entitlement_id)||'/'||count(*)||'/'||min(entitlement_id::text) from (select * from public.resolve_purchase_fact_entitlements('pi_C') union all select * from public.resolve_purchase_fact_entitlements('ch_C') union all select * from public.resolve_purchase_fact_entitlements('in_C')) x), '1/3/'||eC::text);
 perform t.eq('P1.5 resolver: Pass PaymentIntent = exact facts key -> G; unknown / null / blank -> nothing', (select string_agg(entitlement_id::text, ',') from public.resolve_purchase_fact_entitlements('pi_G'))||'/'||(select count(*) from public.resolve_purchase_fact_entitlements('pi_unknown'))||'/'||(select count(*) from public.resolve_purchase_fact_entitlements(null))||'/'||(select count(*) from public.resolve_purchase_fact_entitlements('  ')), eG::text||'/0/0/0');
 -- BEFORE this migration a Plus dispute by PaymentIntent matched nothing; now:
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_A'',''open'')');
 perform t.eq('P2.1 dispute OPEN by the charge PaymentIntent updates the PLUS facts (A) and nothing else', (select string_agg(pf.provider_transaction_id||'='||pf.dispute_status, ',' order by pf.provider_transaction_id) from public.commission_purchase_facts pf where pf.provider_transaction_id in ('sub_A','sub_B','sub_C','pi_G')), 'pi_G=none,sub_A=open,sub_B=none,sub_C=none');
 perform t.sweepnow();
 perform t.eq('P2.2 sweep holds the Plus commission while the dispute is open (dispute_open), others untouched', (select state||':'||coalesce(reason,'-') from public.commissions where entitlement_id=eA)||'/'||(select count(*) from public.commissions where entitlement_id in (eB,eC,eG) and state='validated'), 'held:dispute_open/3');
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_A'',''won'')'); perform t.sweepnow();
 perform t.eq('P2.3 dispute WON releases and (45-day hold elapsed) validates the commission again', (select state from public.commissions where entitlement_id=eA)||'/'||(select dispute_status from public.commission_purchase_facts where entitlement_id=eA), 'validated/won');
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_B2'',''open'')');
 perform t.eq('P2.4 dispute on a RENEWAL charge (B) resolves through subscription_invoice_payments', (select dispute_status from public.commission_purchase_facts where entitlement_id=eB), 'open');
 perform t.q(null,'service_role','public.record_purchase_dispute(''ch_C'',''open'')');
 perform t.eq('P2.5 dispute by CHARGE id on a payment_linked Plus (C) resolves', (select dispute_status from public.commission_purchase_facts where entitlement_id=eC), 'open');
 perform t.q(null,'service_role','public.record_purchase_dispute(''in_C'',''none'')');
 perform t.eq('P2.6 and by INVOICE id (back to none)', (select dispute_status from public.commission_purchase_facts where entitlement_id=eC), 'none');
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_B2'',''lost'')'); perform t.sweepnow();
 perform t.eq('P2.7 dispute LOST on the Plus charge: sweep reverses the commission', (select state||':'||coalesce(reason,'-') from public.commissions where entitlement_id=eB), 'reversed:refund_or_dispute');
 -- Gathering Pass unchanged
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_G'',''open'')'); perform t.sweepnow();
 perform t.eq('P3.1 Gathering Pass: exact PaymentIntent match still works exactly as before (held, dispute_open)', (select pf.dispute_status||'/'||c.state||':'||coalesce(c.reason,'-') from public.commission_purchase_facts pf join public.commissions c on c.entitlement_id=pf.entitlement_id where pf.entitlement_id=eG), 'open/held:dispute_open');
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_G'',''won'')');
 -- unknown / invalid
 n0 := (select count(*) from public.commission_purchase_facts where dispute_status <> 'none');
 perform t.eq('P4.1 unknown reference is a silent no-op (returns, changes nothing)', coalesce(t.q(null,'service_role','public.record_purchase_dispute(''pi_nobody'',''open'')'),'-')||'/'||((select count(*) from public.commission_purchase_facts where dispute_status <> 'none')-n0), '/0');
 perform t.eq('P4.2 invalid status still rejected; anon / authenticated still cannot call', t.q(null,'service_role','public.record_purchase_dispute(''pi_A'',''bogus'')')||'/'||left(t.q(own,'authenticated','public.record_purchase_dispute(''pi_A'',''open'')'),10)||'/'||left(t.q(null,'anon','public.record_purchase_dispute(''pi_A'',''open'')'),10), 'ERR P0001:invalid_status/ERR 42501:/ERR 42501:');
 -- partial refund through the linkage
 j := t.q(null,'service_role','public.record_purchase_partial_refund(''pi_A'',300)');
 perform t.eq('P5.1 partial refund by the Plus PaymentIntent: facts.refunded_cents recorded, commission held for review', (j::jsonb)->>'status'||'/'||(select refunded_cents from public.commission_purchase_facts where entitlement_id=eA)||'/'||(select state||':'||reason from public.commissions where entitlement_id=eA), 'held_for_review/300/held:partial_refund_review');
 perform t.eq('P5.2 partial refund by the exact (subscription) key still works; unknown -> no_facts', ((t.q(null,'service_role','public.record_purchase_partial_refund(''sub_C'',100)'))::jsonb)->>'status'||'/'||(((t.q(null,'service_role','public.record_purchase_partial_refund(''pi_nobody'',100)'))::jsonb)->>'status'), 'held_for_review/no_facts');
 perform t.eq('P5.3 partial refund validation unchanged (amount > 0)', t.q(null,'service_role','public.record_purchase_partial_refund(''pi_A'',0)'), 'ERR P0001:invalid_amount');
 -- FULL refund of a Plus charge: the ledger resolves the charge, the entitlement is marked refunded, the sweep reverses the commission (path unchanged, covered end to end)
 eA := t.mkp('s2plus','plus_annual','sub_R', now());
 insert into public.purchase_payments(provider,transaction_id,entitlement_id,canonical_product_id,store,environment,currency,gross_amount_minor,stripe_payment_intent_id,stripe_invoice_id,stripe_charge_id,stripe_subscription_id,purchased_at)
   values ('stripe','sub_R',eA,'plus_annual','web','production','USD',5999,'pi_R','in_R','ch_R','sub_R',now());
 perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||eA||'''::uuid)');
 j := t.q(null,'service_role','public.apply_payment_event(jsonb_build_object(''provider'',''stripe'',''provider_event_id'',''evt_ref_R'',''provider_event_type'',''charge.refunded'',''event_kind'',''refund'',''event_at'',now(),''environment'',''production'',''payment_intent_id'',''pi_R'',''reason'',''requested_by_customer''))');
 perform t.sweepnow();
 perform t.eq('P6.1 FULL refund of a Plus charge: ledger marks the entitlement refunded, sweep reverses the commission', coalesce((j::jsonb)->>'outcome',j)||'/'||(select (refunded_at is not null)::text from public.gathering_entitlements where id=eA)||'/'||(select state from public.commissions where entitlement_id=eA), 'applied/true/reversed');
 -- payout interplay: a Plus dispute opened AFTER the draft blocks approval (E-C1 predicate now sees the Plus facts)
 insert into public.partners(user_id,display_name,status,tier) values (null,'S2 Plus Payout Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'s2pluspay');
 for i in 1..6 loop
   e := t.mkp('s2pluspay','plus_annual','sub_PP'||i, now());
   insert into public.purchase_payments(provider,transaction_id,entitlement_id,canonical_product_id,store,environment,currency,gross_amount_minor,stripe_payment_intent_id,stripe_subscription_id,purchased_at) values ('stripe','sub_PP'||i,e,'plus_annual','web','production','USD',5999,'pi_PP'||i,'sub_PP'||i,now());
   perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||e||'''::uuid)');
 end loop;
 perform t.sweepnow();
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)')::text; pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('P7.1 draft of six Plus commissions = 7200', (j::jsonb)->>'net_cents', '7200');
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_PP3'',''open'')');
 perform t.eq('P7.2 a dispute opened on a PLUS charge after the draft BLOCKS approval (payout_contains_reversed_commission), nothing changed', t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:payout_contains_reversed_commission/draft');
 -- fail-safe: a broken linkage table must not make recording raise (exact match keeps working, linked match degrades to a no-op)
 alter table public.subscription_invoice_payments rename to subscription_invoice_payments_off;
 v := t.q(null,'service_role','public.record_purchase_dispute(''sub_PP4'',''open'')');
 perform t.eq('P8.1 fail-safe: with a linkage table missing, exact-match recording still works', coalesce(v,'-')||'/'||(select dispute_status from public.commission_purchase_facts where provider_transaction_id='sub_PP4'), '/open');
 v := t.q(null,'service_role','public.record_purchase_dispute(''pi_PP5'',''open'')');
 perform t.eq('P8.2 fail-safe: linked reference degrades to a no-op instead of raising', coalesce(v,'-')||'/'||(select dispute_status from public.commission_purchase_facts where provider_transaction_id='sub_PP5'), '/none');
 alter table public.subscription_invoice_payments_off rename to subscription_invoice_payments;
 perform t.q(null,'service_role','public.record_purchase_dispute(''pi_PP5'',''open'')');
 perform t.eq('P8.3 linkage restored: resolves again', (select dispute_status from public.commission_purchase_facts where provider_transaction_id='sub_PP5'), 'open');
 -- the approved economics are still exactly the approved ones
 perform t.eq('P9.1 terms unchanged by this migration (v1: Pass 50, Plus 1200, 45d, 5000)', (select string_agg(canonical_product_id||'='||amount_cents, ',' order by canonical_product_id) from public.hc_terms_amounts where version=1)||'/'||(select validation_days||'/'||min_payout_cents from public.hc_terms_versions where version=1), 'gathering_pass=50,plus_annual=1200/45/5000');
end $$;

-- ===================== D-4: photos: completed gatherings are read-only EXCEPT authorized photo uploads inside the existing 30-day window =====================
create or replace function t.tryn(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text; n bigint;
begin
  perform set_config('request.jwt.claims', case when p_uid is null and p_role is null then '' when p_uid is null then json_build_object('role',p_role)::text else json_build_object('sub',p_uid,'role',coalesce(p_role,'authenticated'))::text end, true);
  begin
    if p_uid is not null and p_role is null then null; end if;
    execute p_sql; get diagnostics n = row_count; v := 'OK:'||n;
    raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm = 'T_ROLLBACK' then null; else v := 'ERR '||sqlstate||':'||sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims','',true);
  return v;
end $f$;
-- same but with a real role switch (RLS and table privileges apply)
create or replace function t.tryr(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text; n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role',p_role)::text, true);
  begin
    execute 'set local role '||quote_ident(p_role);
    execute p_sql; get diagnostics n = row_count; v := 'OK:'||n;
    raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm = 'T_ROLLBACK' then null; else v := 'ERR '||sqlstate||':'||sqlerrm; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims','',true);
  return v;
end $f$;
create or replace function t.mkins(p_tbl text, p_gid uuid) returns text language plpgsql as $f$
declare cols text := ''; vals text := ''; c record; v text;
begin
 if p_tbl = 'guest_update_receipts' then   -- no gathering_id column: link through the gathering's seeded guest_update + invitation_party (202101)
   return format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values ((select id from public.guest_updates where gathering_id=%L limit 1), (select id from public.invitation_parties where gathering_id=%L limit 1))', p_gid, p_gid);
 end if;
 for c in select a.attname, format_type(a.atttypid,a.atttypmod) ft, ty.typtype, ty.oid toid
            from pg_attribute a join pg_type ty on ty.oid=a.atttypid
           where a.attrelid=('public.'||p_tbl)::regclass and a.attnum>0 and not a.attisdropped
             and ((a.attnotnull and not a.atthasdef and a.attidentity='' and a.attgenerated='') or a.attname='gathering_id') loop
   v := case when c.attname='gathering_id' then quote_literal(p_gid)||'::uuid'
     when c.typtype='e' then (select quote_literal(enumlabel)||'::'||c.ft from pg_enum where enumtypid=c.toid order by enumsortorder limit 1)
     when c.ft='uuid' then 'gen_random_uuid()'
     when c.ft ~ '^(text|character|citext)' then '''x'''
     when c.ft ~ '^(integer|bigint|smallint|numeric|real|double)' then '1'
     when c.ft='boolean' then 'false'
     when c.ft='date' then 'current_date'
     when c.ft ~ '^timestamp' then 'now()'
     when c.ft ~ '^time' then '''12:00''::time'
     when c.ft ~ '^json' then '''{}''::'||c.ft
     when c.ft like '%[]' then '''{}'''
     when c.ft='bytea' then '''\x00''::bytea'
     else 'null' end;
   cols := cols||quote_ident(c.attname)||','; vals := vals||v||',';
 end loop;
 return format('insert into public.%I (%s) values (%s)', p_tbl, trim(trailing ',' from cols), trim(trailing ',' from vals));
end $f$;
create or replace function t.mkga(p_owner uuid) returns uuid language plpgsql as $f$   -- a future, ACTIVE gathering
declare g uuid := gen_random_uuid();
begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time, timezone) values (g, p_owner, 'ga-'||left(g::text,6), 'dinner', current_date+10, '18:00', 'UTC');
  update public.gatherings set status='active' where id=g;
  return g;
end $f$;
create or replace function t.mkmd(p_owner uuid, p_end_ago int) returns uuid language plpgsql as $f$   -- completed MULTI-DAY gathering whose last day was p_end_ago days ago (UTC)
declare g uuid := gen_random_uuid(); d date := (now() at time zone 'UTC')::date - p_end_ago;
begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, gathering_end_date, duration_type, arrival_time, timezone) values (g, p_owner, 'gm-'||left(g::text,6), 'dinner', d-2, d, 'multi_day', '18:00', 'UTC');
  update public.gatherings set status='active' where id=g;
  return g;
end $f$;
create or replace function t.blocked(p_res text) returns boolean language sql immutable as $f$ select p_res like 'ERR%' or p_res = 'OK:0' $f$;
create or replace function t.ro(p_res text) returns boolean language sql immutable as $f$ select p_res = 'ERR P0001:gathering_read_only' $f$;
do $$
declare o uuid:=t.mkuser(); l uuid:=t.mkuser(); pl uuid:=t.mkuser(); x uuid:=t.mkuser();
  names text[] := array['A','g29','g30m','g30','g30p','gCan','gDone']; nm text; g uuid; seed uuid; ins text; res text; isopen boolean; iscan boolean; i int;
  gids jsonb := '{}'::jsonb; owners jsonb := '{}'::jsonb; ow uuid; n2 text;
begin
 -- gatherings: A future active; g29 = event 29 days ago (window ends in +1 day); g30m = ends in +1 second; g30 = ends EXACTLY now; g30p = ended 1 second ago; gCan cancelled; gDone completed early (completed_at) with the event still ahead
 -- the free tier allows ONE open gathering per owner (assert_free_gathering_slot_available), so every gathering gets its own owner
 foreach n2 in array names loop owners := owners || jsonb_build_object(n2, t.mkuser()); end loop;
 gids := jsonb_build_object('A', t.mkga((owners->>'A')::uuid), 'g29', t.mkg((owners->>'g29')::uuid,'active', interval '1 day'), 'g30m', t.mkg((owners->>'g30m')::uuid,'active', interval '1 second'), 'g30', t.mkg((owners->>'g30')::uuid,'active', interval '0'),
   'g30p', t.mkg((owners->>'g30p')::uuid,'active', interval '-1 second'), 'gCan', t.mkg((owners->>'gCan')::uuid,'cancelled', interval '20 days'), 'gDone', t.mkga((owners->>'gDone')::uuid));
 perform set_config('placeandplenty.lifecycle_transition','complete',true); update public.gatherings set completed_at = now() where id = (gids->>'gDone')::uuid; perform set_config('placeandplenty.lifecycle_transition','',true);
 perform t.eq('V0.1 statuses: A active, 29/30m/30/30p/gDone completed, gCan cancelled', (select string_agg(n||'='||public.effective_gathering_status((gids->>n)::uuid)::text, ',' order by n) from unnest(names) n),
   'A=active,g29=completed,g30=completed,g30m=completed,g30p=completed,gCan=cancelled,gDone=completed');
 perform t.eq('V0.2 existing window definition: gathering_photos_are_editable (as service, no identity) agrees: open for A/g29/g30m/gDone, closed for g30 (boundary closed), g30p, gCan',
   (select string_agg(n||'='||public.gathering_photos_are_editable((gids->>n)::uuid)::text, ',' order by n) from unnest(names) n), 'A=true,g29=true,g30=false,g30m=true,g30p=false,gCan=false,gDone=true');
 perform t.eq('V0.3 lifecycle_ends_at of g30 is exactly now(), of g29 now()+1 day (event end + 30 days)', (public.gathering_lifecycle_ends_at((gids->>'g30')::uuid) = now())::text||'/'||(public.gathering_lifecycle_ends_at((gids->>'g29')::uuid) = now() + interval '1 day')::text, 'true/true');
 foreach nm in array names loop
   g := (gids->>nm)::uuid;
   insert into public.gathering_members(gathering_id,user_id,invited_email,status,accepted_at,permission_level) values (g,l,'s2pl'||nm||'@x.test','accepted',now(),'legacy_full'),(g,pl,'s2pp'||nm||'@x.test','accepted',now(),'planner');
   perform set_config('placeandplenty.lifecycle_transition','seed',true);
   insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (g, g||'/seed.jpg', o, now()+interval '1 day') returning id into seed;
   perform set_config('placeandplenty.lifecycle_transition','',true);
   perform t.wset('seed_'||nm, seed::text);
 end loop;
 -- ---- per gathering, every photo operation, at the database level (no RLS: proves the trigger) and through the real client path (RLS + RPC) ----
 foreach nm in array names loop
   g := (gids->>nm)::uuid; ow := (owners->>nm)::uuid; seed := t.wget('seed_'||nm)::uuid; isopen := nm in ('A','g29','g30m','gDone'); iscan := nm = 'gCan';
   ins := format('insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')', g, g||'/new.jpg', o);
   -- DB level (owner identity, superuser, RLS bypassed)
   res := t.tryn(ow,null,ins);      perform t.eq('V1.'||nm||'.a DB-level INSERT by the owner: '||case when isopen then 'allowed' else 'refused gathering_read_only' end, case when isopen then res else (t.ro(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryn(ow,null,format('update public.gathering_photos set hidden_at=now(), hidden_by=%L where id=%L', o, seed)); perform t.eq('V1.'||nm||'.b DB-level hide (moderation columns): '||case when isopen then 'allowed' else 'refused' end, case when isopen then res else (t.ro(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryn(ow,null,format('update public.gathering_photos set caption=%L where id=%L', 'edited', seed)); perform t.eq('V1.'||nm||'.c DB-level edit of any OTHER photo column (caption): '||case when nm='A' then 'allowed (active)' else 'refused' end, case when nm='A' then res else (t.ro(res))::text end, case when nm='A' then 'OK:1' else 'true' end);
   res := t.tryn(ow,null,format('delete from public.gathering_photos where id=%L', seed)); perform t.eq('V1.'||nm||'.d DB-level delete by the owner: '||case when isopen then 'allowed' else 'refused' end, case when isopen then res else (t.ro(res))::text end, case when isopen then 'OK:1' else 'true' end);
   -- real client path: authenticated owner, RLS + privileges
   res := t.tryr(ow,'authenticated',ins);   perform t.eq('V2.'||nm||'.a client INSERT (RLS) by the owner', case when isopen then res else (t.blocked(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryr(ow,'authenticated',format('select public.add_gathering_photo(%L,%L)', g, g||'/rpc.jpg')); perform t.eq('V2.'||nm||'.b add_gathering_photo RPC by the owner', case when isopen then left(res,5) else (res like 'ERR P0001:photo_gallery_read_only')::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryr(ow,'authenticated',format('select public.set_gathering_photo_hidden(%L,true)', seed)); perform t.eq('V2.'||nm||'.c set_gathering_photo_hidden RPC by the owner', case when isopen then left(res,5) else (t.blocked(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryr(ow,'authenticated',format('select public.delete_gathering_photo(%L)', seed)); perform t.eq('V2.'||nm||'.d delete_gathering_photo RPC by the owner', case when isopen then left(res,5) else (t.blocked(res))::text end, case when isopen then 'OK:1' else 'true' end);
   -- co-hosts (accepted members): legacy_full and planner behave like the owner for photos (existing rule: any accepted member), strangers never
   res := t.tryr(l,'authenticated',format('select public.add_gathering_photo(%L,%L)', g, g||'/l.jpg')); perform t.eq('V3.'||nm||'.a legacy_full co-host add_gathering_photo', case when isopen then left(res,5) else (t.blocked(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryr(pl,'authenticated',format('insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')', g, g||'/p.jpg', pl)); perform t.eq('V3.'||nm||'.b planner co-host direct INSERT (RLS)', case when isopen then res else (t.blocked(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryr(x,'authenticated',ins); perform t.eq('V3.'||nm||'.c stranger INSERT is always refused', (t.blocked(res))::text, 'true');
   -- service role = guest-token edge function path (auth.uid() null)
   res := t.tryn(null,'service_role',format('insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')', g, g||'/guest.jpg', o)); perform t.eq('V4.'||nm||'.a service-role (guest upload) INSERT: '||case when isopen then 'allowed' else 'refused' end, case when isopen then res else (t.ro(res))::text end, case when isopen then 'OK:1' else 'true' end);
   res := t.tryn(null,'service_role',format('delete from public.gathering_photos where id=%L', seed)); perform t.eq('V4.'||nm||'.b service-role DELETE (retention purge / account deletion) always allowed', res, 'OK:1');
   res := t.tryn(null,'service_role',format('update public.gathering_photos set hidden_at=now() where id=%L', seed)); perform t.eq('V4.'||nm||'.c service-role UPDATE: '||case when isopen then 'allowed' else 'refused' end, case when isopen then res else (t.ro(res))::text end, case when isopen then 'OK:1' else 'true' end);
 end loop;
 -- ---- kill switch / level / marker honour the same switches as 202100 ----
 g := (gids->>'g30')::uuid; ow := (owners->>'g30')::uuid; ins := format('insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')', g, g||'/sw.jpg', o);
 update public.lifecycle_read_only_config set enforcement='off' where id;
 perform t.eq('V5.1 kill switch off: closed-window insert is allowed again (prior behaviour)', t.tryn(ow,null,ins), 'OK:1');
 update public.lifecycle_read_only_config set enforcement='cancelled' where id;
 perform t.eq('V5.2 level cancelled: completed not enforced, cancelled still refused', t.tryn(ow,null,ins)||'/'||(t.ro(t.tryn((owners->>'gCan')::uuid,null,replace(ins, g::text, (gids->>'gCan'))))::text), 'OK:1/true');
 update public.lifecycle_read_only_config set enforcement='terminal' where id;
 perform t.eq('V5.3 level terminal again: refused', (t.ro(t.tryn(ow,null,ins)))::text, 'true');
 perform set_config('placeandplenty.lifecycle_transition','complete',true);
 perform set_config('placeandplenty.lifecycle_transition','complete',true);
 perform t.eq('V5.4 canonical lifecycle-transition marker bypasses (cancel/complete/archive flows): with the marker set, the insert passes, the insert passes', t.tryn(ow,null,ins), 'OK:1');
 perform set_config('placeandplenty.lifecycle_transition','',true);
 -- ---- the 202100 sweep: every OTHER guarded table stays read-only on completed gatherings, window open or not; only gathering_photos differs, and only inside the window ----
 declare tbls text[]; tb text; bad text; cases text[] := array['A','g29','g30m','gDone','g30','g30p','gCan']; cs text; ntot int; notblocked text;
 begin
   select array_agg(distinct c.relname order by c.relname) into tbls from pg_trigger tg join pg_class c on c.oid=tg.tgrelid where tg.tgname in ('trg_terminal_read_only','trg_terminal_read_only_strict') and not tg.tgisinternal and c.relname not in ('gatherings','gathering_days');   -- gathering_days: multi-day only (own test below); guest_update_receipts IS in the sweep since 202101 (real guest_updates/invitation_parties links, seeded below)
   ntot := cardinality(tbls);
   -- seed one guest_update + one invitation_party per sweep gathering (superuser, no claims: auth.uid() null => the non-strict triggers pass) so guest_update_receipts can be exercised through its real links
   foreach cs in array cases loop
     insert into public.guest_updates(gathering_id, author_user_id, title, body) values ((gids->>cs)::uuid, (owners->>cs)::uuid, 'sweep', 'sweep');
     insert into public.invitation_parties(gathering_id, party_name) values ((gids->>cs)::uuid, 'sweep');
   end loop;
   perform t.eq('V6.0 sweep covers the 202100 table list (>= 25 child tables incl. gathering_photos and, since 202101, guest_update_receipts; gathering_days handled separately)', (ntot >= 25 and 'gathering_photos' = any(tbls) and 'guest_update_receipts' = any(tbls))::text, 'true');
   foreach cs in array cases loop
     g := (gids->>cs)::uuid; notblocked := '';
     foreach tb in array tbls loop
       res := t.tryn((owners->>cs)::uuid,null,t.mkins(tb,g));
       if not t.ro(res) then notblocked := notblocked || tb || ','; end if;
     end loop;
     perform t.eq('V6.'||cs||' sweep over '||ntot||' tables, owner: tables NOT refused with gathering_read_only = ['||case when cs in ('A','g29','g30m','gDone') then 'photos/active' else 'none' end||']',
       case when cs = 'A' then (notblocked = (select string_agg(xx, ',' order by xx)||',' from unnest(tbls) xx))::text
            when cs in ('g29','g30m','gDone') then (notblocked = 'gathering_photos,')::text
            else (notblocked = '')::text end, 'true');
     if notblocked <> '' and cs not in ('A') then raise notice 'sweep % unexpected not-blocked: % ; sample: %', cs, notblocked, t.tryn((owners->>cs)::uuid,null,t.mkins('gathering_days',g))||' | '||t.tryn((owners->>cs)::uuid,null,t.mkins('guest_update_receipts',g))||' | '||t.tryn((owners->>cs)::uuid,null,t.mkins('gathering_photos',g)); end if;
   end loop;
   -- sanity: the sweep must really reach the triggers on the ACTIVE gathering (inserts are not refused there for read-only reasons)
   perform t.eq('V6.9 on the active gathering no table is refused with gathering_read_only', (select count(*) from unnest(tbls) zz where t.ro(t.tryn((owners->>'A')::uuid,null,t.mkins(zz,(gids->>'A')::uuid))))::text, '0');
 end;
 -- guest_update_receipts: the 202100 defect (strict trigger read a gathering_id column this table does not have => 42703 on every write) is fixed by 202101; full coverage in ts202101.sql
 perform t.eq('V6.8 guest_update_receipts (202101): service-role insert is no longer a 42703 - it is NOT refused for an active gathering and IS refused gathering_read_only for a completed one',
   t.tryn(null,'service_role',t.mkins('guest_update_receipts',(gids->>'A')::uuid))||'/'||t.tryn(null,'service_role',t.mkins('guest_update_receipts',(gids->>'g30')::uuid)), 'OK:1/ERR P0001:gathering_read_only');
 -- multi-day gatherings: same window rule (last day 23:59:59 + 30 days); gathering_days (multi-day schedule) stays read-only with no exception
 declare mo uuid:=t.mkuser(); mc uuid:=t.mkuser(); gmo uuid; gmc uuid; rr text;
 begin
   gmo := t.mkmd(mo, 29); gmc := t.mkmd(mc, 31);
   perform t.eq('V8.0 multi-day: effective status completed both; photos window open (last day 29 days ago) / closed (31 days ago)', public.effective_gathering_status(gmo)::text||'/'||public.effective_gathering_status(gmc)::text||'/'||public.gathering_photos_are_editable(gmo)::text||'/'||public.gathering_photos_are_editable(gmc)::text, 'completed/completed/true/false');
   perform t.eq('V8.1 multi-day inside window: photo INSERT allowed (owner)', t.tryn(mo,null,format('insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')', gmo, gmo||'/m.jpg', mo)), 'OK:1');
   perform t.eq('V8.2 multi-day after the window: photo INSERT refused gathering_read_only', t.tryn(mc,null,format('insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')', gmc, gmc||'/m.jpg', mc)), 'ERR P0001:gathering_read_only');
   perform t.eq('V8.3 gathering_days (multi-day schedule) read-only on a completed multi-day gathering, window open or closed (no exception)', t.tryn(mo,null,format('insert into public.gathering_days(gathering_id,day_date,sort_order) select id,gathering_date,9 from public.gatherings where id=%L',gmo))||'/'||t.tryn(mc,null,format('insert into public.gathering_days(gathering_id,day_date,sort_order) select id,gathering_date,9 from public.gatherings where id=%L',gmc)), 'ERR P0001:gathering_read_only/ERR P0001:gathering_read_only');
 end;
 perform t.eq('V7.1 gatherings row itself: owner update on completed (inside window) and cancelled still refused (never OK; 202100 unchanged)', (left(t.tryn(ow,null,format('update public.gatherings set notes=%L where id=%L','x',(gids->>'g29')::uuid)),3)='ERR')::text||'/'||(left(t.tryn(ow,null,format('update public.gatherings set notes=%L where id=%L','x',(gids->>'gCan')::uuid)),3)='ERR')::text, 'true/true');
 perform t.eq('V7.2 202100 enforcement function body untouched by 217450 (still the 202100 text: photos class defers completed)', (select (position('v_class = ''photos''' in pg_get_functiondef('public.enforce_terminal_read_only()'::regprocedure))>0 and pg_get_functiondef('public.enforce_terminal_read_only()'::regprocedure) !~ 'gathering_lifecycle_ends_at')::text), 'true');
 perform t.eq('V7.3 both triggers present on gathering_photos (202100 + 217450); 202100 is still the LAST migration of the order', (select string_agg(tgname,',' order by tgname) from pg_trigger where tgrelid='public.gathering_photos'::regclass and not tgisinternal and tgname like 'trg\_%'), 'trg_archived_read_only_strict,trg_gathering_photo_window,trg_terminal_read_only');
end $$;

select t.report();
