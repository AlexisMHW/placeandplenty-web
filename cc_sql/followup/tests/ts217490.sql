-- Follow-up suite for 217490 (owner-controlled PARTIAL-REFUND HOLD RESOLUTION). Scratch Postgres only; runs after harness.sql on the full chain (61 main steps + followup 217490 / 217491).
-- usage: bash followup/tests/scripts/run_suite.sh <db_with_followup> out.txt followup/tests/ts217490.sql     (DB timezone UTC)
-- Drives the ledger for real (apply_payment_event), record_purchase_dispute / record_purchase_partial_refund exactly as the webhook calls them, sweep_commissions as the webhook / daily job run it.
-- NEGATIVE CONTROL: on the chain WITHOUT 217490 the resolver does not exist and the "sweep respects the release" assertions fail (see report).
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
create or replace function t.cid(p_ent uuid) returns uuid language sql as $f$ select id from public.commissions where entitlement_id = p_ent $f$;
-- resolve as <uid> (authenticated) ; returns value or 'ERR sqlstate:message'
create or replace function t.rs(p_uid uuid, p_ent uuid, p_res text, p_note text default 'owner reviewed the refund', p_confirm text default 'true') returns text language sql as $f$
  select t.q(p_uid,'authenticated','public.hc_resolve_partial_refund_hold('''||t.cid(p_ent)||'''::uuid,'||coalesce(''''||p_res||'''','null')||','||coalesce(''''||p_note||'''','null')||','||p_confirm||')') $f$;
create or replace function t.rsj(p_uid uuid, p_ent uuid, p_res text) returns text language sql as $f$ select coalesce((t.qj(p_uid,'authenticated','public.hc_resolve_partial_refund_hold('''||t.cid(p_ent)||'''::uuid,'''||p_res||''',''owner reviewed the refund'',true)')->>'status'), 'ERR') $f$;
create or replace function t.nev(p_ent uuid, p_to text, p_reason text) returns bigint language sql as $f$ select count(*) from public.commission_events where commission_id = t.cid(p_ent) and to_state = p_to and reason = p_reason $f$;
create or replace function t.nres(p_ent uuid) returns bigint language sql as $f$ select count(*) from public.hc_partial_refund_resolutions where commission_id = t.cid(p_ent) $f$;
-- partial-refund a purchase as the webhook does and sweep once; returns commission state/reason
create or replace function t.pr(p_pi text, p_cents int) returns text language sql as $f$ select coalesce((t.q(null,'service_role','public.record_purchase_partial_refund('''||p_pi||''','||p_cents||')')::jsonb)->>'status','ERR') $f$;

-- ===================== setup =====================
do $$
declare own uuid:=t.mkuser(); fin uuid:=t.mkuser(); cpm uuid:=t.mkuser(); pid uuid;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(fin,'business_admin'),(cpm,'creator_program_manager');
 perform t.wset('own',own::text); perform t.wset('fin',fin::text); perform t.wset('cpm',cpm::text);
 update public.hc_settings set enabled=true where singleton;
 perform t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''fixture'')');
 insert into public.partners(user_id,display_name,status,tier) values (null,'J Partner','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'jpartner');
 perform t.wset('partner',pid::text);
 perform t.wset('g', t.mkg(own)::text);
 perform t.eq('J0.1 defaults: paid referrals OFF before activation; approved economics untouched (Pass 50c, Plus 1200c, hold 45d, min 5000c); hc.payout held by owner only',
   (select (not paid_referrals_enabled)::text from public.hc_settings where singleton)||'/'||(select string_agg(canonical_product_id||'='||amount_cents, ',' order by canonical_product_id) from public.hc_terms_amounts where version=1)||'/'||(select validation_days||'/'||min_payout_cents from public.hc_terms_versions where version=1)||'/'||(select string_agg(role,',') from public.staff_role_permissions where permission='hc.payout'),
   'true/gathering_pass=50,plus_annual=1200/45/5000/owner');
end $$;
select pg_sleep(0.05);
select t.eq('J0.2 owner activates paid referrals (switch is ON only inside this scratch DB)', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''j suite'')')->>'status','ERR'), 'activated');
select pg_sleep(0.05);
insert into public.staff_role_permissions(role,permission) values ('business_admin','hc.payout');   -- scratch only: a NON-OWNER holding the financial permission (removed at the end)

-- ===================== A. permissions, validation, negative controls =====================
do $$ declare own uuid:=t.wget('own')::uuid; fin uuid:=t.wget('fin')::uuid; cpm uuid:=t.wget('cpm')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_a1', t.wget('g')::uuid); j text; begin
 perform t.rec(e); perform t.pr('pi_a1',300);
 perform t.eq('A0 setup: commission held / partial_refund_review after the partial refund', t.cs(e), 'held/partial_refund_review');
 perform t.eq('A1 non-owner staff holding hc.payout: RELEASE refused owner_required', t.rs(fin,e,'release'), 'ERR P0001:owner_required');
 perform t.eq('A2 non-owner staff holding hc.payout: REVERSE refused owner_required', t.rs(fin,e,'reverse'), 'ERR P0001:owner_required');
 perform t.eq('A3 hc.read-only manager refused owner_required', t.rs(cpm,e,'release'), 'ERR P0001:owner_required');
 perform t.eq('A4 service role (no identity) refused owner_required', t.q(null,'service_role','public.hc_resolve_partial_refund_hold('''||t.cid(e)||'''::uuid,''release'',''some note'',true)'), 'ERR P0001:owner_required');
 perform t.eq('A5 anonymous refused (no EXECUTE for anon)', t.q(null,'anon','public.hc_resolve_partial_refund_hold('''||t.cid(e)||'''::uuid,''release'',''some note'',true)') like 'ERR 42501%', 'true');
 perform t.eq('A6 nothing changed by the refusals: still held, no resolution row, no release event', t.cs(e)||'/'||t.nres(e)||'/'||t.nev(e,'pending','partial_refund_released'), 'held/partial_refund_review/0/0');
 perform t.eq('A7 owner: confirmation required', t.rs(own,e,'release','owner reviewed the refund','false'), 'ERR P0001:confirmation_required');
 perform t.eq('A8 owner: confirmation null refused', t.rs(own,e,'release','owner reviewed the refund','null'), 'ERR P0001:confirmation_required');
 perform t.eq('A9 owner: note required (empty / 2 chars / spaces)', t.rs(own,e,'release','')||'|'||t.rs(own,e,'release','ab')||'|'||t.rs(own,e,'release','     '), 'ERR P0001:note_required|ERR P0001:note_required|ERR P0001:note_required');
 perform t.eq('A10 owner: invalid resolution refused', t.rs(own,e,'approve')||'|'||t.rs(own,e,null), 'ERR P0001:invalid_resolution|ERR P0001:invalid_resolution');
 perform t.eq('A11 owner: unknown commission', t.q(own,'authenticated','public.hc_resolve_partial_refund_hold(gen_random_uuid(),''release'',''some note'',true)'), 'ERR P0001:commission_not_found');
 perform t.eq('A12 still untouched after every invalid attempt', t.cs(e)||'/'||t.nres(e), 'held/partial_refund_review/0');
 -- the list function: VIEW for hc.payout (owner and non-owner holding it), denied otherwise
 perform t.eq('A13 list: owner can view the hold (1 held, release_blocker null, can_release true)', (t.qj(own,'authenticated','public.hc_admin_list_partial_refund_holds(100)')->'holds'->0->>'can_release')||'/'||(select jsonb_array_length(t.qj(own,'authenticated','public.hc_admin_list_partial_refund_holds(100)')->'holds')>=1)::text, 'true/true');
 perform t.eq('A14 list: non-owner with hc.payout can VIEW', coalesce(t.qj(fin,'authenticated','public.hc_admin_list_partial_refund_holds(100)')->'holds'->0->>'commission_id','ERR')=t.cid(e)::text, 'true');
 perform t.eq('A15 list: hc.read-only manager denied', t.q(cpm,'authenticated','public.hc_admin_list_partial_refund_holds(100)'), 'ERR P0001:not_authorized');
 perform t.eq('A16 list: anon / service role denied', (t.q(null,'anon','public.hc_admin_list_partial_refund_holds(100)') like 'ERR 42501%')::text||'/'||t.q(null,'service_role','public.hc_admin_list_partial_refund_holds(100)'), 'true/ERR P0001:not_authorized');
 perform t.eq('A17 internal helpers are not API-callable (authenticated)', (t.q(own,'authenticated','public.hc_partial_refund_open(gen_random_uuid())') like 'ERR 42501%')::text||'/'||(t.q(own,'authenticated','public.hc_partial_refund_release_blocker(gen_random_uuid())') like 'ERR 42501%')::text, 'true/true');
 perform t.eq('A18 history table has no API access (authenticated cannot read it)', t.q(own,'authenticated','(select count(*) from public.hc_partial_refund_resolutions)') like 'ERR 42501%', 'true');
 perform t.wset('ea1', e::text);
end $$;

-- ===================== B. RELEASE: back on the normal path; the sweep respects it; payable only after the normal 45 days =====================
do $$ declare own uuid:=t.wget('own')::uuid; fin uuid:=t.wget('fin')::uuid; e uuid := t.wget('ea1')::uuid; j jsonb; va timestamptz; begin
 -- control: WITHOUT a resolution the sweep keeps it held, even 46 days later (the original defect: no release path)
 perform t.sw(0); perform t.sw(46);
 perform t.eq('B0 control: unresolved flag keeps it held through sweeps at day 0 and day 46', t.cs(e), 'held/partial_refund_review');
 -- control: a plain state change (what a staff "release" did before) is undone by the next sweep
 update public.commissions set state='pending', reason=null where id=t.cid(e); perform t.sw(0);
 perform t.eq('B0b control: a manual pending (no recorded resolution) is re-held by the next sweep', t.cs(e), 'held/partial_refund_review');
 select validate_after into va from public.commissions where id=t.cid(e);
 j := t.qj(own,'authenticated','public.hc_resolve_partial_refund_hold('''||t.cid(e)||'''::uuid,''release'',''Refund reviewed: goodwill amount, purchase stands'',true)');
 perform t.eq('B1 owner RELEASE: status released, state pending', (j->>'status')||'/'||(j->>'state'), 'released/pending');
 perform t.eq('B2 commission pending / partial_refund_released, amount and validate_after untouched', t.cs(e)||'/'||(select commission_cents from public.commissions where id=t.cid(e))||'/'||((select validate_after from public.commissions where id=t.cid(e)) = va)::text, 'pending/partial_refund_released/50/true');
 perform t.eq('B3 one resolution row: release, note, owner, refunded amount reviewed (300), held -> pending', (select resolution||'/'||note||'/'||(resolved_by=t.wget('own')::uuid)::text||'/'||refunded_cents_at_resolution||'/'||from_state||'>'||to_state from public.hc_partial_refund_resolutions where commission_id=t.cid(e)), 'release/Refund reviewed: goodwill amount, purchase stands/true/300/held>pending');
 perform t.eq('B4 hc event row written (held -> pending, partial_refund_released, actor staff:<owner>)', (select count(*) from public.commission_events where commission_id=t.cid(e) and from_state='held' and to_state='pending' and reason='partial_refund_released' and actor='staff:'||t.wget('own'))::text, '1');
 perform t.eq('B5 admin audit row carries the note and says no money moved', (select (detail->>'note')||'/'||(detail->>'moved_money_here')||'/'||(detail->>'resolution') from public.admin_audit_log where action='hc.partial_refund_hold_resolved' and target_id=t.cid(e)::text), 'Refund reviewed: goodwill amount, purchase stands/false/release');
 perform t.sw(0); perform t.sw(0);
 perform t.eq('B6 sweeps do NOT re-hold it (still pending / partial_refund_released), no second held event', t.cs(e)||'/'||(select count(*) from public.commission_events where commission_id=t.cid(e) and to_state='held' and reason='partial_refund_review'), 'pending/partial_refund_released/2');
 j := t.q(null,'service_role','public.hc_commission_maintenance(30,500)')::jsonb;
 perform t.eq('B7 maintenance (reconcile + sweep) does not re-hold or reverse it (held=0 reversed=0)', t.cs(e)||'/'||(j->'sweep'->>'held')||'/'||(j->'sweep'->>'reversed'), 'pending/partial_refund_released/0/0');
 perform t.sw(44);
 perform t.eq('B8 day 44: still pending (not early)', t.cs(e), 'pending/partial_refund_released');
 perform t.eq('B9 blocked predicate: a released commission is not blocked, an unresolved flag is', (select public.hc_commission_blocked(t.wget('ea1')::uuid))::text, 'false');
 perform t.sw(46);
 perform t.eq('B10 day 46: validated through the NORMAL path (reason cleared, amount 50c)', t.cs(e)||'/'||(select commission_cents from public.commissions where id=t.cid(e)), 'validated/-/50');
 perform t.sw(0); perform t.sw(100);
 perform t.eq('B11 stays validated after later sweeps (never re-held)', t.cs(e), 'validated/-');
 perform t.eq('B12 the hold is gone from the list; the resolution is shown', (select jsonb_array_length(t.qj(own,'authenticated','public.hc_admin_list_partial_refund_holds(100)')->'holds') from (select 1) z where true)::text||'/'||(t.qj(fin,'authenticated','public.hc_admin_list_partial_refund_holds(100)')->'recent_resolutions'->0->>'resolution'), '0/release');
end $$;

-- B2: payable only after the normal 45 days; the unresolved sibling stays excluded; draft amount never exceeds approved amounts
do $$
declare own uuid := t.wget('own')::uuid; pidp uuid; e uuid[]; i int; j text; pay uuid; begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'J Pay Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'jpay');
 for i in 1..7 loop e[i] := t.mkp('jpay','plus_annual','sub_jp'||i); perform t.rec(e[i]); end loop;
 perform t.pr('sub_jp6',500); perform t.pr('sub_jp7',500);
 perform t.eq('P0 six Plus commissions pending, jp6 and jp7 held for the partial refund', (select count(*) from public.commissions where entitlement_id = any(e) and state='pending')||'/'||t.cs(e[6])||'/'||t.cs(e[7]), '5/held/partial_refund_review/held/partial_refund_review');
 perform t.eq('P1 release jp6', t.rsj(own,e[6],'release'), 'released');
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)')::text;
 perform t.eq('P2 day 0: nothing validated yet, so nothing can be drafted (below minimum, 0)', (j::jsonb)->>'status'||'/'||((j::jsonb)->>'eligible_cents'), 'below_minimum/0');
 perform t.sw(44); perform t.eq('P3 day 44: no validated commission', (select count(*) from public.commissions where entitlement_id = any(e) and state='validated')::text, '0');
 perform t.sw(46);
 perform t.eq('P4 day 46: the five normal and the released one validate; the unresolved one stays held', (select count(*) from public.commissions where entitlement_id = any(e) and state='validated')||'/'||t.cs(e[6])||'/'||t.cs(e[7]), '6/validated/-/held/partial_refund_review');
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)')::text; pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('P5 owner draft = 6 x 1200 = 7200 (released commission included at its approved amount; unresolved excluded; never above the approved amounts)', (j::jsonb)->>'net_cents'||'/'||(select count(*) from public.commissions where payout_id=pay)||'/'||t.cs(e[7]), '7200/6/held/partial_refund_review');
 perform t.eq('P6 the released commission is payable inside the draft', t.cs(e[6]), 'payable/-');
 perform t.eq('P7 approval allowed (no blocked commission in the batch)', coalesce(t.qj(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')->>'status','ERR'), 'approved');
 perform t.wset('pay_approved', pay::text); perform t.wset('e_pay', e[6]::text); perform t.wset('e_pay7', e[7]::text);
 -- C-block cases on an APPROVED payout: a partial refund seen on a commission in the approved batch cannot be resolved by release / reverse
 perform t.eq('P8 a commission already in an APPROVED payout cannot be released (commission_in_payout)', t.rs(own,e[6],'release'), 'ERR P0001:commission_in_payout');
 perform t.eq('P9 ... nor reversed through this function (commission_in_payout); owner uses the payout controls', t.rs(own,e[6],'reverse'), 'ERR P0001:commission_in_payout');
 perform t.eq('P10 ... and nothing changed', t.cs(e[6])||'/'||(select status from public.payouts where id=pay)||'/'||t.nres(e[6]), 'payable/-/approved/1');
 -- record the (external) payment, then the same commission is PAID
 j := t.qj(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-J-0001'',current_date,''bank transfer'',true)')::text;
 perform t.eq('P11 owner records the external payment (existing control)', (j::jsonb)->>'status', 'paid_recorded');
 perform t.eq('P12 a commission in a PAID payout cannot be released or reversed through this function', t.rs(own,e[6],'release')||'|'||t.rs(own,e[6],'reverse'), 'ERR P0001:commission_in_payout|ERR P0001:commission_in_payout');
 -- partial refund on a paid commission: flag only; resolving remains refused
 perform t.eq('P13 partial refund on a PAID commission: flag only', t.pr('sub_jp1',100)||'/'||t.cs(e[1]), 'flagged/paid/-');
 perform t.eq('P14 resolving a PAID commission: commission_in_payout', t.rs(own,e[1],'release'), 'ERR P0001:commission_in_payout');
end $$;

-- ===================== C. release blocked: open dispute, lost dispute, full refund, invalid entitlement =====================
-- C1 open dispute blocks release; after the dispute is WON the owner can release
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_c1', t.wget('g')::uuid); o text; j jsonb; begin
 perform t.rec(e); perform t.pr('pi_c1',100);
 o := t.ev('c1_open','dispute_opened','charge.dispute.created','pi_c1',1); perform t.dsp('pi_c1','open');
 perform t.eq('C1.0 ledger: dispute opened -> access paused (revoked dispute_open); commission still held / partial_refund_review', t.es(e)||'/'||t.cs(e), 'false/dispute_open/false/held/partial_refund_review');
 perform t.eq('C1.1 release refused: dispute_open', t.rs(own,e,'release'), 'ERR P0001:dispute_open');
 perform t.eq('C1.2 the list shows the blocker and can_release=false', (select x->>'release_blocker'||'/'||(x->>'can_release') from jsonb_array_elements(t.qj(own,'authenticated','public.hc_admin_list_partial_refund_holds(500)')->'holds') x where x->>'commission_id'=t.cid(e)::text), 'dispute_open/false');
 perform t.eq('C1.3 nothing changed (still held, no resolution row)', t.cs(e)||'/'||t.nres(e), 'held/partial_refund_review/0');
 o := t.ev('c1_won','dispute_won','charge.dispute.closed','pi_c1',5); perform t.dsp('pi_c1','won'); perform t.sw(0);
 perform t.eq('C1.4 dispute won: the sweep does NOT release a commission whose partial refund is unresolved', t.cs(e), 'held/partial_refund_review');
 perform t.eq('C1.5 now the owner can release it', t.rsj(own,e,'release')||'/'||t.cs(e), 'released/pending/partial_refund_released');
 perform t.sw(0); perform t.eq('C1.6 and the sweep keeps it pending', t.cs(e), 'pending/partial_refund_released');
end $$;
-- C2 dispute lost blocks release (before the sweep reverses)
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_c2', t.wget('g')::uuid); o text; begin
 perform t.rec(e); perform t.pr('pi_c2',100);
 o := t.ev('c2_open','dispute_opened','charge.dispute.created','pi_c2',1); perform t.dsp('pi_c2','open');
 o := t.ev('c2_lost','dispute_lost','charge.dispute.closed','pi_c2',5); perform t.dsp('pi_c2','lost');
 perform t.eq('C2.1 dispute lost: release refused (dispute_lost)', t.rs(own,e,'release'), 'ERR P0001:dispute_lost');
 perform t.sw(0);
 perform t.eq('C2.2 the sweep then reverses it exactly as before (refund_or_dispute)', t.cs(e), 'reversed/refund_or_dispute');
 perform t.eq('C2.3 a reversed commission cannot be resolved (not_held_for_partial_refund)', t.rs(own,e,'release')||'|'||t.rs(own,e,'reverse'), 'ERR P0001:not_held_for_partial_refund|ERR P0001:not_held_for_partial_refund');
end $$;
-- C3 full refund blocks release
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_c3', t.wget('g')::uuid); o text; begin
 perform t.rec(e); perform t.pr('pi_c3',100);
 o := t.ev('c3_full','refund','charge.refunded','pi_c3',3);
 perform t.eq('C3.1 full refund recorded on the entitlement before the sweep: release refused (fully_refunded)', t.rs(own,e,'release'), 'ERR P0001:fully_refunded');
 perform t.sw(0); perform t.eq('C3.2 sweep reverses it', t.cs(e), 'reversed/refund_or_dispute');
end $$;
-- C4 entitlement no longer valid (revoked for a reason other than ordinary subscription cancellation) blocks release; subscription_deleted does not
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','plus_annual','sub_c4', null); e2 uuid := t.mkp('jpartner','plus_annual','sub_c4b', null); begin
 perform t.rec(e); perform t.pr('sub_c4',100); perform t.rec(e2); perform t.pr('sub_c4b',100);
 update public.gathering_entitlements set revoked_at = now(), revoked_reason = 'admin_revoked' where id = e;
 perform t.eq('C4.1 entitlement revoked (admin_revoked): release refused (entitlement_not_valid)', t.rs(own,e,'release'), 'ERR P0001:entitlement_not_valid');
 update public.gathering_entitlements set revoked_at = now(), revoked_reason = 'subscription_deleted' where id = e2;
 perform t.eq('C4.2 ordinary subscription cancellation is NOT a blocker (same rule the sweep and reconcile apply)', t.rsj(own,e2,'release'), 'released');
end $$;
-- C5 a commission that is not held for a partial refund cannot be resolved
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_c5', t.wget('g')::uuid); begin
 perform t.rec(e);
 perform t.eq('C5.1 pending commission with no partial refund: not_held_for_partial_refund (release and reverse)', t.rs(own,e,'release')||'|'||t.rs(own,e,'reverse'), 'ERR P0001:not_held_for_partial_refund|ERR P0001:not_held_for_partial_refund');
 update public.commissions set state='held', reason='shared_payment_card' where id=t.cid(e);
 perform t.eq('C5.2 held for ANOTHER reason (shared_payment_card): refused, not ours to release', t.rs(own,e,'release'), 'ERR P0001:not_held_for_partial_refund');
end $$;

-- ===================== D. REVERSE is terminal =====================
do $$ declare own uuid:=t.wget('own')::uuid; fin uuid:=t.wget('fin')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_d1', t.wget('g')::uuid); j jsonb; begin
 perform t.rec(e); perform t.pr('pi_d1',300);
 j := t.qj(own,'authenticated','public.hc_resolve_partial_refund_hold('''||t.cid(e)||'''::uuid,''reverse'',''Customer refund was for the full service'',true)');
 perform t.eq('D1 owner REVERSE: reversed / partial_refund_reversed, no clawback, no payout', (j->>'status')||'/'||t.cs(e)||'/'||(select coalesce(clawback_cents,0)||'/'||coalesce(payout_id::text,'-') from public.commissions where id=t.cid(e)), 'reversed/reversed/partial_refund_reversed/0/-');
 perform t.eq('D2 hc event row + resolution row + audit row (one each, note kept)', t.nev(e,'reversed','partial_refund_reversed')||'/'||t.nres(e)||'/'||(select count(*) from public.admin_audit_log where action='hc.partial_refund_hold_resolved' and target_id=t.cid(e)::text and detail->>'note'='Customer refund was for the full service'), '1/1/1');
 perform t.sw(0); perform t.sw(46); perform t.sw(200); perform t.q(null,'service_role','public.hc_commission_maintenance(30,500)');
 perform t.eq('D3 terminal: sweeps / maintenance never revive it', t.cs(e), 'reversed/partial_refund_reversed');
 perform t.eq('D4 release after reverse refused (already_resolved_differently); reverse again idempotent', t.rs(own,e,'release')||'|'||t.rsj(own,e,'reverse'), 'ERR P0001:already_resolved_differently|already_resolved');
 perform t.eq('D5 non-owner still refused after the decision', t.rs(fin,e,'reverse'), 'ERR P0001:owner_required');
 perform t.eq('D6 a further partial refund event for the same purchase leaves it reversed (flag only)', t.pr('pi_d1',400)||'/'||t.cs(e), 'flagged/reversed/partial_refund_reversed');
 perform t.eq('D7 still exactly one resolution row and one reversal event', t.nres(e)||'/'||t.nev(e,'reversed','partial_refund_reversed'), '1/1');
 perform t.eq('D8 reconcile does not recreate or change it', t.rec(e)||'/'||t.cs(e), 'already_recorded/reversed/partial_refund_reversed');
end $$;

-- ===================== E. idempotency, replay, newer partial refund =====================
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_e1', t.wget('g')::uuid); j jsonb; begin
 perform t.rec(e); perform t.pr('pi_e1',300);
 perform t.eq('E1 first release', t.rsj(own,e,'release'), 'released');
 j := t.qj(own,'authenticated','public.hc_resolve_partial_refund_hold('''||t.cid(e)||'''::uuid,''release'',''owner reviewed the refund'',true)');
 perform t.eq('E2 identical replay: already_resolved, state unchanged', (j->>'status')||'/'||(j->>'state'), 'already_resolved/pending');
 perform t.sw(46);
 perform t.eq('E3 replay after the commission validated: still already_resolved, still validated, still 1 row / 1 event', t.rsj(own,e,'release')||'/'||t.cs(e)||'/'||t.nres(e)||'/'||t.nev(e,'pending','partial_refund_released'), 'already_resolved/validated/-/1/1');
 perform t.eq('E4 the opposite decision after the fact is refused (already_resolved_differently), nothing changed', t.rs(own,e,'reverse')||'/'||t.cs(e), 'ERR P0001:already_resolved_differently/validated/-');
 perform t.eq('E5 webhook replay of the SAME partial refund after release: no re-hold (already_resolved_released)', t.pr('pi_e1',300)||'/'||t.cs(e), 'already_resolved_released/validated/-');
 perform t.eq('E6 ... and a SMALLER amount seen out of order: no re-hold', t.pr('pi_e1',100)||'/'||t.cs(e), 'already_resolved_released/validated/-');
 perform t.sw(0);
 perform t.eq('E7 sweeps afterwards keep it validated', t.cs(e), 'validated/-');
 -- a LARGER refunded amount than the one reviewed is new information: held again, resolvable again
 perform t.eq('E8 a LARGER partial refund (500 > 300 reviewed) holds it for review again', t.pr('pi_e1',500)||'/'||t.cs(e), 'held_for_review/held/partial_refund_review');
 perform t.sw(0); perform t.eq('E9 sweep keeps it held until the owner decides again', t.cs(e), 'held/partial_refund_review');
 perform t.eq('E10 owner releases again (second resolution row)', t.rsj(own,e,'release')||'/'||t.nres(e), 'released/2');
 perform t.eq('E10b the second resolution records the refunded amount reviewed (500)', (select max(refunded_cents_at_resolution) from public.hc_partial_refund_resolutions where commission_id=t.cid(e))::text, '500');
 perform t.sw(46); perform t.eq('E11 and it validates again through the normal path (original validate_after already elapsed)', t.cs(e), 'validated/-');
end $$;
-- E2: a released commission that later gets an open dispute follows the DISPUTE rules (hold, never validate; won -> normal path)
do $$ declare own uuid:=t.wget('own')::uuid; e uuid := t.mkp('jpartner','gathering_pass','pi_e2', t.wget('g')::uuid); o text; begin
 perform t.rec(e); perform t.pr('pi_e2',300); perform t.rsj(own,e,'release');
 o := t.ev('e2_open','dispute_opened','charge.dispute.created','pi_e2',1); perform t.dsp('pi_e2','open'); perform t.sw(0);
 perform t.eq('E12 released, then a dispute opens: held / dispute_open (dispute rules apply)', t.cs(e), 'held/dispute_open');
 perform t.sw(46); perform t.eq('E13 an open dispute never validates it', t.cs(e), 'held/dispute_open');
 o := t.ev('e2_won','dispute_won','charge.dispute.closed','pi_e2',5); perform t.dsp('pi_e2','won'); perform t.sw(0);
 perform t.eq('E14 dispute won: released to pending / dispute_won (NOT re-held for the already-reviewed partial refund)', t.cs(e), 'pending/dispute_won');
 perform t.sw(46); perform t.eq('E15 then validated on the normal path', t.cs(e), 'validated/-');
 perform t.eq('E16 partial-refund reviewed once: single resolution row', t.nres(e)::text, '1');
end $$;


-- Q: partial refund seen on a commission inside a DRAFT payout (state payable): resolving is refused until the sweep voids the batch; then release works
do $$
declare own uuid := t.wget('own')::uuid; pidp uuid; e uuid[]; i int; j text; pay uuid; begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'J Draft Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'jdraft');
 for i in 1..6 loop e[i] := t.mkp('jdraft','plus_annual','sub_jq'||i); perform t.rec(e[i]); end loop;
 perform t.sw(46);
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)')::text; pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('Q1 draft = 7200', (j::jsonb)->>'net_cents', '7200');
 perform t.pr('sub_jq3',500);
 perform t.eq('Q2 flagged commission is payable inside the draft: release and reverse refused (commission_in_payout)', t.rs(own,e[3],'release')||'|'||t.rs(own,e[3],'reverse'), 'ERR P0001:commission_in_payout|ERR P0001:commission_in_payout');
 perform t.eq('Q3 approval of that batch is refused (existing control)', t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'), 'ERR P0001:payout_contains_reversed_commission');
 perform t.sw(0);
 perform t.eq('Q4 the sweep voids the batch and holds the commission for review', (select status from public.payouts where id=pay)||'/'||t.cs(e[3]), 'void/held/partial_refund_review');
 perform t.eq('Q5 now the owner can release; a new draft contains all six only after the normal path (validated needs the original 45 days: sweep 46)', t.rsj(own,e[3],'release')||'/'||t.cs(e[3]), 'released/pending/partial_refund_released');
 perform t.sw(46);
 perform t.eq('Q6 released commission validated again and drafted with the others: 6 x 1200', ((t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'))->>'net_cents'), '7200');
end $$;

-- ===================== F. history is append-only; economics and defaults untouched =====================
do $$ begin
 perform t.eq('F1 resolution rows cannot be updated', (select (t.x(null,'service_role','update public.hc_partial_refund_resolutions set note=''x'' where true') like 'ERR%')::text), 'true');
 begin update public.hc_partial_refund_resolutions set note='tamper tamper' where true; perform t.eq('F2 superuser update refused (append-only trigger)','updated','refused'); exception when others then perform t.eq('F2 superuser update refused (append-only trigger)', sqlerrm, 'hc_ledger_is_append_only'); end;
 begin delete from public.hc_partial_refund_resolutions where true; perform t.eq('F3 superuser delete refused','deleted','refused'); exception when others then perform t.eq('F3 superuser delete refused', sqlerrm, 'hc_ledger_is_append_only'); end;
 begin truncate public.hc_partial_refund_resolutions; perform t.eq('F4 truncate refused','truncated','refused'); exception when others then perform t.eq('F4 truncate refused', sqlerrm, 'hc_ledger_is_append_only'); end;
 perform t.eq('F5 economics untouched (Pass 50c, Plus 1200c, 45d, 5000c); every resolved commission amount still equals its approved amount', (select string_agg(canonical_product_id||'='||amount_cents, ',' order by canonical_product_id) from public.hc_terms_amounts where version=1)||'/'||(select validation_days||'/'||min_payout_cents from public.hc_terms_versions where version=1)||'/'||(select count(*) from public.commissions c where c.canonical_product_id='gathering_pass' and c.commission_cents <> 50 or c.canonical_product_id='plus_annual' and c.commission_cents <> 1200), 'gathering_pass=50,plus_annual=1200/45/5000/0');
 perform t.eq('F6 role map unchanged: hc.payout was granted to business_admin ONLY inside this scratch run', (select string_agg(role,',' order by role) from public.staff_role_permissions where permission='hc.payout'), 'business_admin,owner');
end $$;
delete from public.staff_role_permissions where role='business_admin' and permission='hc.payout';
select t.eq('F7 scratch permission removed: hc.payout is held by owner only', (select string_agg(role,',') from public.staff_role_permissions where permission='hc.payout'), 'owner');
select t.report();
