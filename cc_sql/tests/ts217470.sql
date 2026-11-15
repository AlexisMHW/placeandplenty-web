-- Agent H suite for 217470 (DEF-1 open dispute HOLDS / won releases / lost reverses; DEF-2 partial refund holds) and 217480 (m3 revoke EXECUTE on enforce_terminal_read_only()).
-- Scratch Postgres only; runs after harness.sql on the full chain (all steps incl. 217470 and 217480). usage: bash tests/s2_sql/scripts/run_tf.sh <full_chain_db> out.txt cc_sql/tests/ts217470.sql
-- NEGATIVE CONTROL: on the chain WITHOUT 217470 / 217480 the DEF-1 / DEF-2 / M3 assertions FAIL (see report); the "unchanged behaviour" assertions PASS on both.
-- The ledger side is driven for real: apply_payment_event (grant-side rows inserted like ts217400; dispute / refund events through the ledger, which sets revoked_at / revoked_reason 'dispute_open'),
-- record_purchase_dispute / record_purchase_partial_refund exactly as the webhook calls them, and sweep_commissions as the webhook runs it after every dispute / refund event.
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

-- ===================== setup =====================
do $$
declare own uuid:=t.mkuser(); pid uuid;
begin
 insert into public.staff_members(user_id,role) values (own,'owner');
 perform t.wset('own',own::text);
 update public.hc_settings set enabled=true where singleton;
 perform t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''fixture'')');
 insert into public.partners(user_id,display_name,status,tier) values (null,'H Partner','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'hpartner');
 perform t.wset('partner',pid::text);
 perform t.wset('g', t.mkg(own)::text);
 perform t.eq('H0.1 defaults: paid referrals OFF; approved economics untouched (Pass 50c, Plus 1200c, hold 45d, min 5000c)',
   (select (not paid_referrals_enabled)::text from public.hc_settings where singleton)||'/'||(select string_agg(canonical_product_id||'='||amount_cents, ',' order by canonical_product_id) from public.hc_terms_amounts where version=1)||'/'||(select validation_days||'/'||min_payout_cents from public.hc_terms_versions where version=1),
   'true/gathering_pass=50,plus_annual=1200/45/5000');
end $$;
select pg_sleep(0.05);
select t.eq('H0.2 owner activates paid referrals (switch is ON only inside this scratch DB)', coalesce(t.qj(t.wget('own')::uuid,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''h suite'')')->>'status','ERR'), 'activated');
select pg_sleep(0.05);

-- ===================== DEF-1: open dispute HOLDS, won releases, lost reverses (ledger-driven, with the webhook's sweep in between) =====================
-- D1: open -> sweep -> still held (this is the e3 repro: before 217470 the sweep reversed it)
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_d1', t.wget('g')::uuid); o text; begin
 o := t.rec(e); perform t.eq('D1.0 purchase reconciled: pending 50c (Gathering Pass first qualifying purchase)', o||'/'||t.cs(e)||'/'||(select commission_cents from public.commissions where entitlement_id=e), 'pending/pending/-/50');
 o := t.ev('d1_open','dispute_opened','charge.dispute.created','pi_d1',1); perform t.dsp('pi_d1','open');
 perform t.eq('D1.1 ledger: dispute opened -> entitlement revoked with reason dispute_open (access paused)', t.es(e), 'false/dispute_open/false');
 perform t.sw(0);
 perform t.eq('D1.2 sweep right after the dispute event: commission HELD / dispute_open (NOT reversed)', t.cs(e), 'held/dispute_open');
 perform t.sw(0); perform t.sw(0);
 perform t.eq('D1.3 repeated sweeps are idempotent: still held, exactly one held event', t.cs(e)||'/'||(select count(*) from public.commission_events where commission_id=(select id from public.commissions where entitlement_id=e) and to_state='held' and reason='dispute_open'), 'held/dispute_open/1');
 perform t.sw(46);
 perform t.eq('D1.4 an open dispute never validates, even 46 days later', t.cs(e), 'held/dispute_open');
 perform t.eq('D1.5 no reversal event, no clawback', (select count(*) from public.commission_events where commission_id=(select id from public.commissions where entitlement_id=e) and to_state='reversed')||'/'||(select coalesce(clawback_cents,0) from public.commissions where entitlement_id=e), '0/0');
 -- WON
 o := t.ev('d1_won','dispute_won','charge.dispute.closed','pi_d1',5); perform t.dsp('pi_d1','won');
 perform t.eq('D1.6 ledger: dispute won -> access restored', t.es(e), 'true/-/false');
 perform t.sw(0);
 perform t.eq('D1.7 sweep after WON: released to pending / dispute_won (45-day hold still running, nothing validated early)', t.cs(e), 'pending/dispute_won');
 perform t.sw(44);
 perform t.eq('D1.8 day 44: still pending', t.cs(e), 'pending/dispute_won');
 perform t.sw(46);
 perform t.eq('D1.9 day 46: validated (payable by the normal owner-only draft, amount unchanged 50c)', t.cs(e)||'/'||(select commission_cents from public.commissions where entitlement_id=e), 'validated/-/50');
 perform t.eq('D1.10 event trail: held -> pending(dispute_won) -> validated, never reversed', (select string_agg(to_state||':'||coalesce(reason,'-'), ',' order by created_at, id) from public.commission_events where commission_id=(select id from public.commissions where entitlement_id=e)), 'pending:created,held:dispute_open,pending:dispute_won,validated:validation_period_elapsed');
end $$;
-- D2: open -> LOST -> reversed
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_d2', t.wget('g')::uuid); o text; begin
 perform t.rec(e);
 o := t.ev('d2_open','dispute_opened','charge.dispute.created','pi_d2',1); perform t.dsp('pi_d2','open'); perform t.sw(0);
 perform t.eq('D2.1 open + sweep: held', t.cs(e), 'held/dispute_open');
 o := t.ev('d2_lost','dispute_lost','charge.dispute.closed','pi_d2',5); perform t.dsp('pi_d2','lost'); perform t.sw(0);
 perform t.eq('D2.2 dispute LOST: access revoked (dispute_lost) and the commission is REVERSED (refund_or_dispute)', t.es(e)||'/'||t.cs(e), 'false/dispute_lost/false/reversed/refund_or_dispute');
 perform t.sw(46);
 perform t.eq('D2.3 reversal is terminal: never validates later', t.cs(e), 'reversed/refund_or_dispute');
end $$;
-- D3: open -> full REFUND -> reversed
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_d3', t.wget('g')::uuid); o text; begin
 perform t.rec(e);
 o := t.ev('d3_open','dispute_opened','charge.dispute.created','pi_d3',1); perform t.dsp('pi_d3','open'); perform t.sw(0);
 o := t.ev('d3_ref','refund','charge.refunded','pi_d3',5); perform t.sw(0);
 perform t.eq('D3.1 refund after an open dispute: reversed', t.es(e)||'/'||t.cs(e), 'false/dispute_open/true/reversed/refund_or_dispute');
end $$;
-- D4: refund (no dispute) -> reversed (unchanged rule)
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_d4', t.wget('g')::uuid); o text; begin
 perform t.rec(e);
 o := t.ev('d4_ref','refund','charge.refunded','pi_d4',1); perform t.sw(0);
 perform t.eq('D4.1 full refund: reversed exactly as before', t.cs(e), 'reversed/refund_or_dispute');
end $$;
-- D5: ledger-only dispute (the purchase facts never say "open"): the entitlement alone holds; won through the ledger alone releases
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_d5', t.wget('g')::uuid); o text; begin
 perform t.rec(e);
 o := t.ev('d5_open','dispute_opened','charge.dispute.created','pi_d5',1); perform t.sw(0);
 perform t.eq('D5.1 facts say none but the entitlement is revoked for dispute_open: held (not reversed, not validated)', (select dispute_status from public.commission_purchase_facts where entitlement_id=e)||'/'||t.cs(e), 'none/held/dispute_open');
 perform t.sw(46);
 perform t.eq('D5.2 ... even 46 days later', t.cs(e), 'held/dispute_open');
 o := t.ev('d5_won','dispute_won','charge.dispute.closed','pi_d5',5); perform t.sw(0);
 perform t.eq('D5.3 ledger-only WON: released to pending', t.es(e)||'/'||t.cs(e), 'true/-/false/pending/dispute_won');
end $$;
-- D6: dispute BEFORE reconcile: the commission is created held/dispute_open (before: not_qualifying, nothing created)
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_d6', t.wget('g')::uuid); o text; begin
 o := t.ev('d6_open','dispute_opened','charge.dispute.created','pi_d6',1);
 perform t.eq('D6.1 reconcile while the dispute is open creates the commission HELD / dispute_open', t.rec(e)||'/'||t.cs(e), 'held/held/dispute_open');
 o := t.ev('d6_won','dispute_won','charge.dispute.closed','pi_d6',5); perform t.sw(0);
 perform t.eq('D6.2 won: released to pending, validates on day 45+', t.cs(e), 'pending/dispute_won');
 perform t.sw(46); perform t.eq('D6.3 validated', t.cs(e), 'validated/-');
end $$;
-- D7: unchanged: ordinary subscription cancellation does not reverse; any other revocation reason still reverses; refunded entitlement reversed
do $$ declare ea uuid := t.mkp('hpartner','plus_annual','sub_d7a'); eb uuid := t.mkp('hpartner','plus_annual','sub_d7b'); begin
 perform t.rec(ea); perform t.rec(eb);
 update public.gathering_entitlements set revoked_at = now(), revoked_reason = 'subscription_deleted' where id = ea;
 update public.gathering_entitlements set revoked_at = now(), revoked_reason = 'admin_revoked' where id = eb;
 perform t.sw(0);
 perform t.eq('D7.1 subscription_deleted: not reversed (as before)', t.cs(ea), 'pending/-');
 perform t.eq('D7.2 another revocation reason (admin_revoked): reversed (as before)', t.cs(eb), 'reversed/refund_or_dispute');
end $$;
-- D8: an already PAID commission is not reversed by an OPEN dispute (no clawback), only a loss claws back
do $$ declare e uuid := t.mkp('hpartner','plus_annual','sub_d8'); o text; begin
 perform t.rec(e);
 update public.commissions set state='paid', paid_at=now() where entitlement_id=e;
 update public.gathering_entitlements set revoked_at = now(), revoked_reason = 'dispute_open', active=false where id = e; perform t.dsp('sub_d8','open');
 perform t.sw(0);
 perform t.eq('D8.1 paid commission + OPEN dispute: stays paid, no clawback (a hold, not a reversal)', t.cs(e)||'/'||(select coalesce(clawback_cents,0) from public.commissions where entitlement_id=e), 'paid/-/0');
 update public.gathering_entitlements set revoked_reason = 'dispute_lost' where id = e; perform t.dsp('sub_d8','lost'); perform t.sw(0);
 perform t.eq('D8.2 then the dispute is LOST: reversed with the clawback recorded (existing model)', t.cs(e)||'/'||(select clawback_cents||'/'||clawback_status from public.commissions where entitlement_id=e), 'reversed/refund_or_dispute/1200/pending_contract_language');
end $$;
-- D9: a dispute opened on a commission inside a DRAFT payout voids the batch; others return to validated; the disputed one is held; won -> normal path (never early)
do $$
declare own uuid := t.wget('own')::uuid; pidp uuid; e uuid[]; i int; j text; pay uuid; begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'H Payout Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'hpay');
 for i in 1..6 loop e[i] := t.mkp('hpay','plus_annual','sub_d9'||i); perform t.rec(e[i]); end loop;
 perform t.sw(46);
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)')::text; pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('D9.1 draft of six validated Plus commissions = 7200', (j::jsonb)->>'net_cents', '7200');
 update public.gathering_entitlements set revoked_at = now(), revoked_reason = 'dispute_open', active=false where id = e[3]; perform t.dsp('sub_d9'||3,'open');
 perform t.eq('D9.2 a dispute opened after the draft BLOCKS approval (payout_contains_reversed_commission), nothing changed', t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:payout_contains_reversed_commission/draft');
 perform t.sw(46);
 perform t.eq('D9.3 sweep: batch voided (contains_disputed_commission); disputed commission held, the other five validated (not reversed)',
   (select status||'/'||void_reason from public.payouts where id=pay)||'/'||t.cs(e[3])||'/'||(select count(*) from public.commissions where entitlement_id = any(e) and state='validated'), 'void/contains_disputed_commission/held/dispute_open/5');
 update public.gathering_entitlements set revoked_at = null, revoked_reason = null, active=true where id = e[3]; perform t.dsp('sub_d9'||3,'won'); perform t.sw(46);
 perform t.eq('D9.4 dispute won: the held commission is released and (hold elapsed) validated again; amount intact; the owner can draft again = 7200', t.cs(e[3])||'/'||((t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'))->>'net_cents'), 'validated/-/7200');
end $$;

-- ===================== DEF-2: partial refund holds the commission =====================
-- R1: webhook order: ledger partial refund -> reconcile -> record_purchase_partial_refund -> sweep
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r1', t.wget('g')::uuid); o text; j text; begin
 perform t.rec(e);
 o := t.ev('r1_pr','refund_partial','charge.refunded','pi_r1',1,',''amount_refunded_minor'',300,''reason'',''stripe_partial_refund''');
 perform t.eq('R1.0 ledger: partial refund keeps access', t.es(e), 'true/-/false');
 j := t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r1'',300)');
 perform t.eq('R1.1 record_purchase_partial_refund -> held_for_review, commission held / partial_refund_review', (j::jsonb)->>'status'||'/'||t.cs(e), 'held_for_review/held/partial_refund_review');
 perform t.sw(0); perform t.sw(46);
 perform t.eq('R1.2 sweeps never validate it (day 0 and day 46)', t.cs(e), 'held/partial_refund_review');
 perform t.eq('R1.3 facts record the refunded amount and the flag; access kept', (select refunded_cents||'/'||(partial_refund_flagged_at is not null)::text from public.commission_purchase_facts where entitlement_id=e)||'/'||t.es(e), '300/true/true/-/false');
 perform t.eq('R1.4 replay is idempotent (greatest amount kept, still one held event)', (t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r1'',200)')::jsonb)->>'status'||'/'||(select refunded_cents from public.commission_purchase_facts where entitlement_id=e)||'/'||(select count(*) from public.commission_events where commission_id=(select id from public.commissions where entitlement_id=e) and to_state='held'), 'flagged/300/1');
end $$;
-- R2: partial refund recorded BEFORE the commission exists (facts exist): reconcile creates it held; never validates
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r2', t.wget('g')::uuid); j text; begin
 j := t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r2'',100)');
 perform t.eq('R2.1 no commission yet: recorded_no_commission', (j::jsonb)->>'status', 'recorded_no_commission');
 perform t.eq('R2.2 reconcile afterwards creates it HELD / partial_refund_review', t.rec(e)||'/'||t.cs(e), 'held/held/partial_refund_review');
 perform t.sw(46); perform t.eq('R2.3 never validates', t.cs(e), 'held/partial_refund_review');
end $$;
-- R3: commission already VALIDATED, then partial refund -> held
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r3', t.wget('g')::uuid); begin
 perform t.rec(e); perform t.sw(46);
 perform t.eq('R3.0 validated first', t.cs(e), 'validated/-');
 perform t.eq('R3.1 partial refund on a validated commission -> held_for_review', ((t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r3'',250)'))::jsonb)->>'status'||'/'||t.cs(e), 'held_for_review/held/partial_refund_review');
end $$;
-- R4: partial refund, then a dispute opens and is WON: must stay held for the partial refund (not released to pending / validated)
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r4', t.wget('g')::uuid); o text; begin
 perform t.rec(e); perform t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r4'',100)');
 o := t.ev('r4_open','dispute_opened','charge.dispute.created','pi_r4',1); perform t.dsp('pi_r4','open'); perform t.sw(0);
 perform t.eq('R4.1 dispute opened on a commission already held for a partial refund: stays held (partial_refund_review)', t.cs(e), 'held/partial_refund_review');
 o := t.ev('r4_won','dispute_won','charge.dispute.closed','pi_r4',5); perform t.dsp('pi_r4','won'); perform t.sw(46);
 perform t.eq('R4.2 dispute won does NOT release a commission whose partial refund is unresolved', t.cs(e), 'held/partial_refund_review');
end $$;
-- R5: dispute held first, then partial refund (flag only because already held), then WON: re-held for the partial refund, never validated
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r5', t.wget('g')::uuid); o text; begin
 perform t.rec(e);
 o := t.ev('r5_open','dispute_opened','charge.dispute.created','pi_r5',1); perform t.dsp('pi_r5','open'); perform t.sw(0);
 perform t.eq('R5.1 held for the dispute', t.cs(e), 'held/dispute_open');
 perform t.eq('R5.2 partial refund while held: flagged (state unchanged)', ((t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r5'',100)'))::jsonb)->>'status'||'/'||t.cs(e), 'flagged/held/dispute_open');
 o := t.ev('r5_won','dispute_won','charge.dispute.closed','pi_r5',5); perform t.dsp('pi_r5','won'); perform t.sw(46);
 perform t.eq('R5.3 dispute won: released, then held for the unresolved partial refund; not validated', t.cs(e), 'held/partial_refund_review');
end $$;
-- R6: partial then FULL refund -> reversed
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r6', t.wget('g')::uuid); o text; begin
 perform t.rec(e); perform t.q(null,'service_role','public.record_purchase_partial_refund(''pi_r6'',100)');
 o := t.ev('r6_full','refund','charge.refunded','pi_r6',3); perform t.sw(0);
 perform t.eq('R6.1 a later full refund reverses the held commission', t.cs(e), 'reversed/refund_or_dispute');
end $$;
-- R7: partial refund on a commission inside a DRAFT payout: approval refused, the sweep voids the batch, commission held, the others return to validated
do $$
declare own uuid := t.wget('own')::uuid; pidp uuid; e uuid[]; i int; j text; pay uuid; begin
 insert into public.partners(user_id,display_name,status,tier) values (null,'H Partial Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'hpart');
 for i in 1..6 loop e[i] := t.mkp('hpart','plus_annual','sub_r7'||i); perform t.rec(e[i]); end loop;
 perform t.sw(46);
 j := t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)')::text; pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('R7.1 draft = 7200', (j::jsonb)->>'net_cents', '7200');
 perform t.q(null,'service_role','public.record_purchase_partial_refund(''sub_r72'',500)');
 perform t.eq('R7.2 commission inside the draft is only flagged by the function (still payable)', t.cs(e[2]), 'payable/-');
 perform t.eq('R7.3 approval of a payout containing it is refused, nothing changed', t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)')||'/'||(select status from public.payouts where id=pay), 'ERR P0001:payout_contains_reversed_commission/draft');
 perform t.sw(0);
 perform t.eq('R7.4 sweep: batch voided (contains_partially_refunded_commission), that commission held, the other five validated', (select status||'/'||void_reason from public.payouts where id=pay)||'/'||t.cs(e[2])||'/'||(select count(*) from public.commissions where entitlement_id = any(e) and state='validated'), 'void/contains_partially_refunded_commission/held/partial_refund_review/5');
 perform t.eq('R7.5 a new draft excludes the held one: 5 x 1200 = 6000', ((t.qj(own,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'))->>'net_cents'), '6000');
end $$;
-- R8: partial refund on a PAID commission: flag only (no reversal, no clawback)
do $$ declare e uuid := t.mkp('hpartner','plus_annual','sub_r8'); begin
 perform t.rec(e); update public.commissions set state='paid', paid_at=now() where entitlement_id=e;
 perform t.eq('R8.1 paid + partial refund: flagged only', ((t.q(null,'service_role','public.record_purchase_partial_refund(''sub_r8'',100)'))::jsonb)->>'status', 'flagged');
 perform t.sw(0); perform t.eq('R8.2 still paid after a sweep, no clawback', t.cs(e)||'/'||(select coalesce(clawback_cents,0) from public.commissions where entitlement_id=e), 'paid/-/0');
end $$;
-- R9: a purchase with NO partial refund is not affected
do $$ declare e uuid := t.mkp('hpartner','gathering_pass','pi_r9', t.wget('g')::uuid); begin
 perform t.rec(e); perform t.sw(44); perform t.eq('R9.1 day 44 pending', t.cs(e), 'pending/-'); perform t.sw(46); perform t.eq('R9.2 day 46 validated (normal path unchanged)', t.cs(e), 'validated/-');
end $$;


-- ===================== PINNED (founder confirmation): draft = hc.payout only at the DATABASE; approve/record/void/reverse/settle = owner only; the WEB actions are owner-only for all of them =====================
-- (web layer: tests/payout-owner-only.test.ts pins that every payout action incl. draft is NOT_FOUND for a non-owner holding hc.payout.)
do $$
declare own uuid := t.wget('own')::uuid; fin uuid := t.mkuser(); pidp uuid; i int; j text; pay uuid; begin
 insert into public.staff_members(user_id,role) values (fin,'business_admin');
 insert into public.partners(user_id,display_name,status,tier) values (null,'H Layers Partner','approved','founding') returning id into pidp;
 insert into public.partner_codes(partner_id,code) values (pidp,'hlayers');
 for i in 1..6 loop perform t.rec(t.mkp('hlayers','plus_annual','sub_pl'||i)); end loop;
 perform t.sw(46);
 perform t.eq('L0 role map: hc.payout is held by the owner only (business_admin has none)', (select string_agg(role,',') from public.staff_role_permissions where permission='hc.payout'), 'owner');
 perform t.eq('L1 without hc.payout a non-owner cannot even draft', t.q(fin,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)'), 'ERR P0001:not_authorized');
 insert into public.staff_role_permissions(role,permission) values ('business_admin','hc.payout');   -- scratch only
 j := t.q(fin,'authenticated','public.hc_create_payout_draft('''||pidp||'''::uuid)');
 perform t.eq('L2 DATABASE: a non-owner holding hc.payout CAN create a draft (hc.payout-only rule, documented)', coalesce((j::jsonb)->>'status','ERR')||'/'||coalesce((j::jsonb)->>'net_cents','-'), 'draft/7200');
 pay := ((j::jsonb)->>'payout_id')::uuid;
 perform t.eq('L3 ... but approve is owner_required', t.q(fin,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'), 'ERR P0001:owner_required');
 perform t.eq('L4 ... void is owner_required', t.q(fin,'authenticated','public.hc_void_payout('''||pay||'''::uuid,''reason text'')'), 'ERR P0001:owner_required');
 perform t.eq('L5 ... record is owner_required', t.q(fin,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-2002'',current_date,''bank transfer'',true)'), 'ERR P0001:owner_required');
 perform t.eq('L6 ... reverse is owner_required', t.q(fin,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''reason text'')'), 'ERR P0001:owner_required');
 perform t.eq('L7 ... settle is owner_required', t.q(fin,'authenticated','public.hc_settle_clawback(gen_random_uuid(),''waived'',null,''note'',true)'), 'ERR P0001:owner_required');
 perform t.eq('L8 the draft is untouched by those refusals', (select status from public.payouts where id=pay), 'draft');
 delete from public.staff_role_permissions where role='business_admin' and permission='hc.payout';
 perform t.eq('L9 scratch permission removed: role map back to owner only', (select string_agg(role,',') from public.staff_role_permissions where permission='hc.payout'), 'owner');
end $$;

-- ===================== grants / shape / economics unchanged =====================
do $$ begin
 perform t.eq('G1 internal helpers still not callable by API roles', (has_function_privilege('anon','public.hc_sweep_commissions_core(timestamptz)','execute') or has_function_privilege('authenticated','public.hc_sweep_commissions_core(timestamptz)','execute')
   or has_function_privilege('authenticated','public.hc_commission_blocked(uuid)','execute') or has_function_privilege('anon','public.hc_commission_blocked(uuid)','execute'))::text, 'false');
 perform t.eq('G2 sweep_commissions / reconcile keep service-only: authenticated refused', left(t.q(t.wget('own')::uuid,'authenticated','public.sweep_commissions(now())'),16)||'/'||left(t.q(t.wget('own')::uuid,'authenticated','public.reconcile_commission_for_entitlement(gen_random_uuid())'),16), 'ERR 42501:permis/ERR 42501:permis');
 perform t.eq('G3 bodies contain no URL / credential / http call', (select bool_and(prosrc !~* '(https?://|net\.http|apikey|secret|bearer|password)')::text from pg_proc where oid in ('public.hc_sweep_commissions_core(timestamptz)'::regprocedure,'public.reconcile_commission_for_entitlement(uuid)'::regprocedure,'public.hc_commission_blocked(uuid)'::regprocedure)), 'true');
 perform t.eq('G4 economics unchanged: Pass 50c, Plus 1200c, 45-day hold, 5000c minimum (terms v1 frozen on the new commissions)', (select string_agg(distinct terms_amount_cents||'/'||terms_validation_days||'/'||terms_min_payout_cents, ',' order by terms_amount_cents||'/'||terms_validation_days||'/'||terms_min_payout_cents) from public.commissions), '1200/45/5000,50/45/5000');
 perform t.eq('G5 no commission was ever created for a purchase made while paid referrals were OFF, and none auto-reversed by a dispute hold (reversed rows are only D2/D3/D4/D7b/D8/R6)', (select count(*) from public.commissions where state='reversed')::text, '6');
end $$;

-- ===================== M3: enforce_terminal_read_only() EXECUTE revoked (217480) =====================
do $$ begin
 perform t.eq('M3.1 anon / authenticated / PUBLIC have no EXECUTE on the 202100 trigger function', (has_function_privilege('anon','public.enforce_terminal_read_only()','execute') or has_function_privilege('authenticated','public.enforce_terminal_read_only()','execute'))::text||'/'||
   (select (proacl is null or proacl::text ~ '(^|[{,])=X')::text from pg_proc where oid='public.enforce_terminal_read_only()'::regprocedure), 'false/false');
 perform t.eq('M3.2 the trigger is still attached to the terminal tables (guard intact; behaviour is covered by ts202101 / ts217400 on this same chain)', (select (count(*) > 20)::text from pg_trigger where tgfoid='public.enforce_terminal_read_only()'::regprocedure and not tgisinternal), 'true');
 perform t.eq('M3.3 sibling trigger functions keep their revoked state (202101 receipts, 217450 photo window)', (has_function_privilege('anon','public.enforce_terminal_read_only_receipts()','execute') or has_function_privilege('anon','public.enforce_gathering_photo_window()','execute'))::text, 'false');
end $$;
select t.report();
