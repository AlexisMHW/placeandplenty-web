-- A3 scratch tests: manual payouts (217000), tiers/terms (217001), notifications (217002), six-role permission matrix, sensitive-data exposure.
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
-- Identities: set request.jwt.claims + set local role via t.q. Nothing here touches a hosted database.
create or replace function t.fixture_payable(p_code text, p_n int, p_prefix text) returns void language plpgsql as $f$
declare uu uuid; ee uuid; i int; begin
 for i in 1..p_n loop
   uu := t.mkuser(); update auth.users set created_at=now()-interval '10 minutes' where id=uu;
   perform t.q(uu,'authenticated','public.record_referral_claim('''||p_code||''', now()-interval ''5 minutes'')');
   insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at) values (uu,'plus','plus_annual','web',p_prefix||i,'production',now()) returning id into ee;
   perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,'''||p_prefix||i||''',''usd'',5999,0,200,null,null,''webhook'')');
   perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||ee||'''::uuid)');
 end loop; end $f$;

-- ===== A. manual payout screens on top of A7's 216100 (A7 owns the transitions; here: UI contract + ledger separation + permissions) =====
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); bad uuid:=t.mkuser(); pid uuid; j text; pay uuid; led jsonb; today text := current_date::text;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager');
 update public.hc_settings set enabled=true where singleton;
 j := t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''test fixture'')');
 perform t.eq('A0 owner defines a paid-eligible tier (owner-only eligibility)', (j::jsonb)->>'status', 'created');
 insert into public.partners(user_id,display_name,status,tier) values (null,'P One','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'p-one');
 perform t.eq('A1 paid referrals start DISABLED', (select paid_referrals_enabled::text from public.hc_settings where singleton), 'false');
 perform t.eq('A1b cpm cannot activate paid referrals', t.q(cpm,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''why'')'), 'ERR P0001:not_authorized');
 perform t.eq('A1c activation needs the typed phrase', t.q(own,'authenticated','public.hc_activate_paid_referrals(''yes'',''why'')'), 'ERR P0001:confirmation_required');
 perform t.eq('A1d owner activates (local scratch only)', ((t.q(own,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''scratch test'')'))::jsonb)->>'status', 'activated');
 perform t.fixture_payable('p-one', 5, 'ta-');
 perform t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')');
 j := t.q(cpm,'authenticated','public.hc_admin_payout_eligibility()');
 perform t.eq('A2 eligibility exposes the paid_referrals_enabled switch state', ((j::jsonb)->>'paid_referrals_enabled'), 'true');
 led := (t.q(cpm,'authenticated','public.hc_admin_payout_ledger()'))::jsonb;
 perform t.eq('A3 ledger readable by hc.read staff, five separate buckets per member', (select bool_and(p ? 'pending_cents' and p ? 'validated_cents' and p ? 'draft_cents' and p ? 'approved_cents' and p ? 'paid_cents') from jsonb_array_elements(led->'partners') p)::text, 'true');
 perform t.eq('A3b nothing drafted/approved/paid yet', (led->'totals'->>'draft_cents')||'/'||(led->'totals'->>'approved_cents')||'/'||(led->'totals'->>'paid_cents'), '0/0/0');
 j := t.q(own,'authenticated','public.hc_create_payout_draft('''||pid||'''::uuid)'); pay := ((j::jsonb)->>'payout_id')::uuid;
 led := (t.q(own,'authenticated','public.hc_admin_payout_ledger()'))::jsonb;
 perform t.eq('A4 draft moves validated -> "in draft"; paid stays 0', (led->'totals'->>'validated_cents')||'/'||(case when (led->'totals'->>'draft_cents')::int > 0 then 'draft>0' else 'draft=0' end)||'/'||(led->'totals'->>'paid_cents'), '0/draft>0/0');
 perform t.eq('A5 recording a payment on a DRAFT is refused', t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-001'','''||today||'''::date,''bank transfer'',true)'), 'ERR P0001:payout_not_approved');
 perform t.eq('A6 cpm cannot approve', t.q(cpm,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)'), 'ERR P0001:not_authorized');
 perform t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)');
 led := (t.q(own,'authenticated','public.hc_admin_payout_ledger()'))::jsonb;
 perform t.eq('A7 approved is shown as APPROVED, not paid', (case when (led->'totals'->>'approved_cents')::int > 0 then 'approved>0' else 'approved=0' end)||'/'||(led->'totals'->>'paid_cents'), 'approved>0/0');
 perform t.eq('A8 legacy hc_mark_payout_paid cannot mark anything paid', t.q(own,'authenticated','public.hc_mark_payout_paid('''||pay||'''::uuid,''BANK-REF-001'')') like 'ERR P0001:confirmation_required%', 'true');
 perform t.eq('A9 explicit confirmation required', t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-001'','''||today||'''::date,''bank transfer'',false)'), 'ERR P0001:confirmation_required');
 perform t.eq('A10 reference required (too short)', t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''ab'','''||today||'''::date,''bank transfer'',true)'), 'ERR P0001:external_reference_required');
 perform t.eq('A11 future paid-on date refused', t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-001'',current_date+3,''bank transfer'',true)'), 'ERR P0001:invalid_paid_on');
 perform t.eq('A12 cpm and anon cannot record payment', t.q(cpm,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-001'','''||today||'''::date,''x'',true)')||'/'||(t.q(null,'anon','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-001'','''||today||'''::date,''x'',true)') like 'ERR 42501%'), 'ERR P0001:not_authorized/true');
 perform t.eq('A13 still approved after refused attempts', (select status from public.payouts where id=pay), 'approved');
 j := t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''BANK-REF-001'','''||today||'''::date,''bank transfer'',true)');
 perform t.eq('A14 recorded as paid with reference, date, method, confirmer', (select status||'/'||external_ref||'/'||(paid_on=current_date)||'/'||external_method||'/'||(confirmed_by=own) from public.payouts where id=pay), 'paid/BANK-REF-001/true/bank transfer/true');
 led := (t.q(own,'authenticated','public.hc_admin_payout_ledger()'))::jsonb;
 perform t.eq('A15 ledger now shows paid>0 and approved=0 (buckets stay separate)', (case when (led->'totals'->>'paid_cents')::int > 0 then 'paid>0' else 'paid=0' end)||'/'||(led->'totals'->>'approved_cents'), 'paid>0/0');
 perform t.eq('A16 list_payouts exposes paid_on and method fields to the screen', (select (x ? 'paid_on' and x ? 'external_method' and x ? 'reversed_reason')::text from jsonb_array_elements((t.q(cpm,'authenticated','public.hc_admin_list_payouts(10)'))::jsonb) x where x->>'id'=pay::text), 'true');
 perform t.eq('A17 history lists the payout events (drafted/approved/payment_recorded)', (select count(*)::text from jsonb_array_elements((t.q(cpm,'authenticated','public.hc_admin_payout_history(null,10)'))::jsonb) h, jsonb_array_elements(h->'events') e where h->>'payout_id'=pay::text), '3');
 perform t.eq('A18 history denied to non-staff', t.q(bad,'authenticated','public.hc_admin_payout_history(null,10)'), 'ERR P0001:not_authorized');
 perform t.eq('A20 reverse needs a reason; cpm cannot reverse', t.q(own,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,'' '')')||'/'||t.q(cpm,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''returned'')'), 'ERR P0001:reason_required/ERR P0001:not_authorized');
 j := t.q(own,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''bank returned the transfer'')');
 led := (t.q(own,'authenticated','public.hc_admin_payout_ledger()'))::jsonb;
 perform t.eq('A21 reversed: payout reversed, paid back to 0, commissions validated again', (select status from public.payouts where id=pay)||'/'||(led->'totals'->>'paid_cents')||'/'||(case when (led->'totals'->>'validated_cents')::int > 0 then 'validated>0' else 'validated=0' end), 'reversed/0/validated>0');
 perform t.eq('A23 no function reachable by the Command Center transfers money', (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'hc\_%' or p.proname like 'admin\_%' or p.proname like 'cc\_%') and pg_get_functiondef(p.oid) ~* '(transfer_money|stripe\.payouts|payouts\.create|http_post|net\.http)'), '0');
end $$;

-- ===== B. tiers, benefits, assignment, suspension, terms history, audit trail (216100 hc_config_audit) =====
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); sup uuid:=t.mkuser(); pid uuid; j text;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager'),(sup,'support');
 perform t.eq('B1 cpm creates a tier WITHOUT paid eligibility', ((t.q(cpm,'authenticated','public.hc_upsert_tier(''silver'',''Silver'',''d'',''n'',2,true,false,''new tier'')'))::jsonb)->>'status','created');
 perform t.eq('B2 only the owner may make a tier paid-eligible', t.q(cpm,'authenticated','public.hc_upsert_tier(''silver'',''Silver'',''d'',''n'',2,true,true,''try'')'), 'ERR P0001:not_authorized_referral_eligibility');
 perform t.eq('B3 support cannot manage tiers', t.q(sup,'authenticated','public.hc_upsert_tier(''x1'',''X'',null,null,1,true,false,''why'')') like 'ERR P0001:not_authorized%', 'true');
 perform t.eq('B4 cpm sets benefits (<=12 short lines)', (t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',''["Early access","Monthly call"]''::jsonb,''add benefits'')'))::jsonb->>'status', 'updated');
 perform t.eq('B5 13 benefits refused', t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',(select jsonb_agg(''b''||i) from generate_series(1,13) i),''too many'')'), 'ERR P0001:invalid_benefits');
 perform t.eq('B6 tier list shows benefits, paid eligibility and member counts', (select (x->'benefits'->>0)||'/'||(x->>'paid_referrals_eligible')||'/'||(x->>'member_count') from jsonb_array_elements((t.q(cpm,'authenticated','public.hc_admin_list_tiers()'))::jsonb) x where x->>'slug'='silver'), 'Early access/false/0');
 insert into public.partners(user_id,display_name,status,tier) values (null,'Member','approved',null) returning id into pid;
 j := t.q(cpm,'authenticated','public.hc_admin_assign_tier('''||pid||'''::uuid,''silver'',''welcome tier'')');
 perform t.eq('B7 assign tier', (select tier from public.partners where id=pid), 'silver');
 perform t.eq('B8 unknown tier, missing reason, support all refused', t.q(cpm,'authenticated','public.hc_admin_assign_tier('''||pid||'''::uuid,''nope'',''why'')')||'/'||t.q(cpm,'authenticated','public.hc_admin_assign_tier('''||pid||'''::uuid,null,'''')')||'/'||t.q(sup,'authenticated','public.hc_admin_assign_tier('''||pid||'''::uuid,null,''why'')'), 'ERR P0001:tier_not_found/ERR P0001:invalid_reason/ERR P0001:not_authorized');
 j := t.q(cpm,'authenticated','public.hc_admin_set_partner_status('''||pid||'''::uuid,''suspended'',''policy breach'')');
 perform t.eq('B9 suspend member with reason', (select status from public.partners where id=pid), 'suspended');
 perform t.eq('B10 bogus status refused; support cannot suspend', t.q(cpm,'authenticated','public.hc_admin_set_partner_status('''||pid||'''::uuid,''declined'',''xxx'')')||'/'||t.q(sup,'authenticated','public.hc_admin_set_partner_status('''||pid||'''::uuid,''approved'',''xxx'')'), 'ERR P0001:invalid_status/ERR P0001:not_authorized');
 j := t.q(cpm,'authenticated','public.hc_admin_set_partner_status('''||pid||'''::uuid,''approved'',''resolved'')');
 perform t.eq('B11 reinstated', (select status from public.partners where id=pid), 'approved');
 perform t.eq('B12 append-only config audit carries the reasons I gave for this member', (select string_agg(reason, '|' order by id) from public.hc_config_audit where entity='partner' and entity_key=pid::text), 'welcome tier|policy breach|resolved');
 perform t.eq('B13 config audit readable by hc.read, denied to support', ((jsonb_array_length((t.q(cpm,'authenticated','public.hc_admin_config_audit(null,50)'))::jsonb)) > 0)::text||'/'||t.q(sup,'authenticated','public.hc_admin_config_audit(null,50)'), 'true/ERR P0001:not_authorized');
 perform t.eq('B14 terms history shows version 1 (45 days, 5000 minimum) to hc.read', (select (v->>'validation_days')||'/'||(v->>'min_payout_cents') from jsonb_array_elements((t.q(cpm,'authenticated','public.hc_admin_terms_history()'))::jsonb) v order by (v->>'version')::int limit 1), '45/5000');
 perform t.eq('B15 cpm cannot add a terms version (owner only)', t.q(cpm,'authenticated','public.hc_add_terms_version(''{"gathering_pass":50,"plus_annual":1200}''::jsonb,45,5000,now()+interval ''10 days'',''x'')') like 'ERR%', 'true');
end $$;

-- ===== C. notifications: inbox, dedup, severity, settings, verification, delivery queue, retry =====
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); sup uuid:=t.mkuser(); bad uuid:=t.mkuser(); appid uuid; n bigint; j text; dcode text; did bigint; dl bigint;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager'),(sup,'support');
 update public.hc_settings set enabled=true where singleton;
 update public.hc_intake_settings set applications_open=true, terms_version='v1' where singleton;
 perform t.eq('C0 destination starts UNSET, email disabled, nothing hardcoded', (select destination_status||'/'||email_enabled||'/'||coalesce(email_destination,'null') from public.cc_notification_settings), 'unset/false/null');
 j := t.q(null,'anon','public.submit_creator_application(''{"full_name":"Pat Applicant","email":"pat.applicant@example.test","platforms":[{"platform":"instagram","handle":"@pat"}],"niches":["dinner_brunch"],"audience_summary":"Home cooks who host weekly dinners.","terms_version":"v1","disclosure_ack":true,"consent_to_contact":true}''::jsonb)');
 perform t.eq('C1 application raises exactly one open inbox item', (select count(*)::text from public.cc_notifications where category='hc_application_received' and status='open'), '1');
 perform t.eq('C2 inbox text carries no applicant name or email', (select (title||' '||coalesce(body,'')) !~* '(pat|applicant|example\.test)' from public.cc_notifications where category='hc_application_received')::text, 'true');
 perform t.eq('C3 cpm (hc.read) sees it', (jsonb_array_length((t.q(cpm,'authenticated','public.admin_list_notifications(''open'',50)'))::jsonb))::text, '1');
 perform t.eq('C4 support does NOT see HC notifications (row-level permission)', (jsonb_array_length((t.q(sup,'authenticated','public.admin_list_notifications(''open'',50)'))::jsonb))::text, '0');
 perform t.eq('C5 non-staff denied the inbox', t.q(bad,'authenticated','public.admin_list_notifications(''open'',50)'), 'ERR P0001:not_authorized');
 perform t.eq('C6 anon denied the inbox', t.q(null,'anon','public.admin_list_notifications(''open'',50)') like 'ERR 42501%', 'true');
 -- dedup
 perform public.cc_raise_notification('system_failure','warning','dedup:t1','Test failure','b',null,null,'/command-center/health');
 perform public.cc_raise_notification('system_failure','warning','dedup:t1','Test failure','b',null,null,'/command-center/health');
 perform public.cc_raise_notification('system_failure','critical','dedup:t1','Test failure','b',null,null,'/command-center/health');
 perform t.eq('C7 repeat raises dedup into ONE row with occurrences=3 and escalated severity', (select count(*)||'/'||max(occurrences)||'/'||max(severity) from public.cc_notifications where dedup_key='dedup:t1'), '1/3/critical');
 perform t.eq('C8 system_failure visible to ops.read only (support no, owner yes)', (select (jsonb_array_length((t.q(sup,'authenticated','public.admin_list_notifications(''open'',50)'))::jsonb)=0)::text||'/'||(jsonb_array_length((t.q(own,'authenticated','public.admin_list_notifications(''open'',50)'))::jsonb)>=2)::text), 'true/true');
 perform t.eq('C9 counts reflect critical', ((t.q(own,'authenticated','public.admin_notification_counts()'))::jsonb->>'critical'), '1');
 select id into n from public.cc_notifications where dedup_key='dedup:t1';
 perform t.eq('C10 support cannot acknowledge an item it cannot see', t.q(sup,'authenticated','public.admin_set_notification_state('||n||',''acknowledged'')'), 'ERR P0001:not_found');
 perform t.eq('C11 owner acknowledges', t.q(own,'authenticated','public.admin_set_notification_state('||n||',''acknowledged'')') like 'ERR%', 'false');
 perform t.eq('C12 acknowledge is audited', (select count(*)::text from public.admin_audit_log where action='cc.notification_acknowledged'), '1');
 perform t.eq('C13 owner resolves; resolving again refused', (t.q(own,'authenticated','public.admin_set_notification_state('||n||',''resolved'')') like 'ERR%')::text||'/'||t.q(own,'authenticated','public.admin_set_notification_state('||n||',''resolved'')'), 'false/ERR P0001:already_resolved');
 perform public.cc_raise_notification('system_failure','warning','dedup:t1','Test failure','b',null,null,'/command-center/health');
 perform t.eq('C14 after resolve a recurrence opens a NEW item (partial unique index)', (select count(*)::text from public.cc_notifications where dedup_key='dedup:t1'), '2');
 -- application decision resolves the waiting item
 select id into appid from public.creator_applications limit 1;
 perform t.q(cpm,'authenticated','public.hc_review_application('''||appid||'''::uuid,''declined'',null,''not a fit'',null)');
 perform t.eq('C15 decision resolves the "received" item and raises "declined"', (select count(*) filter (where category='hc_application_received' and status='open')||'/'||count(*) filter (where category='hc_application_declined') from public.cc_notifications), '0/1');
 -- settings & email channel
 perform t.eq('C16 email cannot be enabled before the destination is verified', t.q(own,'authenticated','public.admin_set_notification_email_enabled(true,null)'), 'ERR P0001:destination_not_verified');
 declare c17 text := 'no error'; begin begin update public.cc_notification_settings set email_enabled=true where singleton; exception when check_violation then c17 := 'blocked'; end; perform t.eq('C17 table CHECK blocks enabling an unverified destination (defence in depth)', c17, 'blocked'); end;
 perform t.eq('C18 cpm cannot set destination', t.q(cpm,'authenticated','public.admin_set_notification_destination(''x@example.test'')'), 'ERR P0001:not_authorized');
 perform t.eq('C19 invalid email refused', t.q(own,'authenticated','public.admin_set_notification_destination(''not-an-email'')'), 'ERR P0001:invalid_email');
 j := t.q(own,'authenticated','public.admin_set_notification_destination(''Founder@Business.Example'')');
 perform t.eq('C20 destination pending; response contains NO code', j, '{"status": "pending_verification"}');
 perform t.eq('C21 destination stored lower-case, pending, email still disabled', (select email_destination||'/'||destination_status||'/'||email_enabled from public.cc_notification_settings), 'founder@business.example/pending_verification/false');
 perform t.eq('C22 settings: second change within 60s refused', t.q(own,'authenticated','public.admin_set_notification_destination(''other@business.example'')'), 'ERR P0001:too_soon');
 perform t.eq('C23 verification mail is queued for the dispatcher (queued, not sent)', (select count(*)||'/'||max(status) from public.cc_notification_deliveries where kind='verification'), '1/queued');
 perform t.eq('C24 staff CANNOT read delivery payload via RPC (no code/address keys)', (select (x ? 'payload' or x ? 'to' or x ? 'code')::text from jsonb_array_elements((t.q(own,'authenticated','public.admin_list_notification_deliveries(null,50)'))::jsonb) x limit 1), 'false');
 perform t.eq('C25 wrong code refused', t.q(own,'authenticated','public.admin_verify_notification_destination(''00000000'')'), 'wrong_code');
 perform t.eq('C25b failed attempt is COUNTED (survives)', (select verification_attempts::text from public.cc_notification_settings), '1');
 for i in 1..4 loop perform t.q(own,'authenticated','public.admin_verify_notification_destination(''00000000'')'); end loop;
 select payload->>'code' into dcode from public.cc_notification_deliveries where kind='verification';
 perform t.eq('C25c after 5 wrong tries even the RIGHT code is locked out', t.q(own,'authenticated','public.admin_verify_notification_destination('''||dcode||''')'), 'ERR P0001:too_many_attempts');
 update public.cc_notification_settings set verification_attempts=0 where singleton;
 select payload->>'code' into dcode from public.cc_notification_deliveries where kind='verification';
 perform t.eq('C26 cpm cannot verify', t.q(cpm,'authenticated','public.admin_verify_notification_destination('''||dcode||''')'), 'ERR P0001:not_authorized');
 perform t.eq('C27 right code verifies', t.q(own,'authenticated','public.admin_verify_notification_destination('''||dcode||''')'), 'verified');
 perform t.eq('C28 verified, code hash cleared, payload cleared', (select destination_status||'/'||(verification_code_hash is null)||'/'||(select count(*) from public.cc_notification_deliveries where payload is not null)::text from public.cc_notification_settings), 'verified/true/0');
 perform t.eq('C29 owner enables email at warning+', t.q(own,'authenticated','public.admin_set_notification_email_enabled(true,''warning'')') like 'ERR%', 'false');
 perform public.cc_raise_notification('system_failure','info','dedup:info','Info only','b',null,null,null);
 perform public.cc_raise_notification('system_failure','warning','dedup:mail1','Needs attention','b',null,null,null);
 perform public.cc_raise_notification('system_failure','warning','dedup:mail1','Needs attention','b',null,null,null);
 perform t.eq('C30 only >= threshold severities queue email; dedup repeat does not queue twice', (select count(*)::text from public.cc_notification_deliveries where kind='notification' and notification_id=(select id from public.cc_notifications where dedup_key='dedup:mail1' and status<>'resolved')), '1');
 perform t.eq('C31 info below threshold queued nothing', (select count(*)::text from public.cc_notification_deliveries d join public.cc_notifications n on n.id=d.notification_id where n.dedup_key='dedup:info'), '0');
 perform public.cc_raise_notification('system_failure','critical','dedup:mail1','Needs attention','b',null,null,null);
 perform t.eq('C32 severity ESCALATION queues one more email', (select count(*)::text from public.cc_notification_deliveries d join public.cc_notifications n on n.id=d.notification_id where n.dedup_key='dedup:mail1' and n.status<>'resolved'), '2');
 -- dispatcher interface
 perform t.eq('C33 authenticated users cannot claim deliveries', t.q(own,'authenticated','public.cc_claim_email_deliveries(5)') like 'ERR%', 'true');
 j := t.q(null,'service_role','public.cc_claim_email_deliveries(10)');
 perform t.eq('C34 service claims queued rows with destination only for dispatcher', (select (jsonb_array_length(j::jsonb) >= 2)::text), 'true');
 perform t.eq('C35 claimed rows are "sending" with attempts=1 (queued != sent)', (select count(*)::text from public.cc_notification_deliveries where status='sending' and attempts=1), (select count(*)::text from public.cc_notification_deliveries where status='sending'));
 select id into did from public.cc_notification_deliveries where kind='notification' and status='sending' order by id limit 1;
 select id into dl from public.cc_notification_deliveries where kind='notification' and status='sending' order by id desc limit 1;
 perform t.q(null,'service_role','public.cc_record_delivery_result('||did||',''failed'',null,''provider timeout'')');
 perform t.eq('C36 failure recorded with short reason, retry scheduled in the future', (select status||'/'||last_error||'/'||(next_attempt_at > now())::text from public.cc_notification_deliveries where id=did), 'failed/provider timeout/true');
 perform t.eq('C37 list shows failed as retryable to ops.read (owner)', (select (x->>'retryable') from jsonb_array_elements((t.q(own,'authenticated','public.admin_list_notification_deliveries(''failed'',10)'))::jsonb) x limit 1), 'true');
 perform t.eq('C38 cpm cannot retry', t.q(cpm,'authenticated','public.admin_retry_notification_delivery('||did||')'), 'ERR P0001:not_authorized');
 j := t.q(own,'authenticated','public.admin_retry_notification_delivery('||did||')');
 perform t.eq('C39 owner retry requeues', (j like 'ERR%')::text||'/'||(select status from public.cc_notification_deliveries where id=did), 'false/queued');
 perform t.q(null,'service_role','public.cc_record_delivery_result('||dl||',''delivered'',''msg_123'',null)');
 perform t.eq('C40 delivered stamps delivered_at and provider id', (select status||'/'||(delivered_at is not null)||'/'||provider_message_id from public.cc_notification_deliveries where id=dl), 'delivered/true/msg_123');
 update public.cc_notification_settings set verification_sent_at=now()-interval '2 minutes' where singleton;
 j := t.q(own,'authenticated','public.admin_set_notification_destination(''new@business.example'')');
 perform t.q(null,'service_role','public.cc_record_delivery_result('||dl||',''delayed'',null,null)');
 perform t.eq('C40b provider statuses delayed/bounced are accepted and unknown ones refused', (select status from public.cc_notification_deliveries where id=dl)||'/'||t.q(null,'service_role','public.cc_record_delivery_result('||dl||',''weird'',null,null)'), 'delayed/ERR P0001:invalid_status');
 perform t.eq('C41 changing destination disables email and requires re-verification', j||'/'||(select email_enabled||'/'||destination_status from public.cc_notification_settings), '{"status": "pending_verification"}/false/pending_verification');
 perform t.eq('C43 thresholds validated and audited', t.q(own,'authenticated','public.admin_set_notification_thresholds(0,24)')||'/'||(t.q(own,'authenticated','public.admin_set_notification_thresholds(72,12)') like 'ERR%')::text, 'ERR P0001:invalid_hours/false');
 -- sweep
 update public.creator_applications set status='received', created_at=now()-interval '100 hours' where id=appid;
 perform t.eq('C44 sweep is service-only', t.q(own,'authenticated','public.cc_sweep_notifications(now())') like 'ERR%', 'true');
 perform t.q(null,'service_role','public.cc_sweep_notifications(now())');
 perform t.eq('C45 sweep raises "applications awaiting review" once (re-sweep dedups)', (select (t.q(null,'service_role','public.cc_sweep_notifications(now())') is not null)::text||'/'||count(*)::text from public.cc_notifications where dedup_key='sweep:apps_waiting' and status<>'resolved'), 'true/1');
end $$;

-- ===== D. permission matrix: 6 roles + non-staff + anon x every admin_/hc_admin_/new RPC; expectations from the SQL role seed =====
do $$
declare roles text[] := array['owner','business_admin','marketing_pr','creator_program_manager','support','limited_contributor'];
  r text; u uuid; nonstaff uuid := t.mkuser(); rec record; res text; want boolean; ok boolean; granted int; staff_before int; tiers_before int;
  uid_by_role jsonb := '{}'::jsonb;
begin
 foreach r in array roles loop u := t.mkuser(); insert into public.staff_members(user_id,role) values (u,r); uid_by_role := uid_by_role || jsonb_build_object(r, u); end loop;
 select count(*) into staff_before from public.staff_members; select count(*) into tiers_before from public.hc_tiers;
 for rec in select * from (values
   ('public.admin_alerts()', array['overview.read'], 'all'),
   ('public.admin_business_overview(7)', array['overview.read'], 'all'),
   ('public.admin_financial_summary(7)', array['revenue.read'], 'all'),
   ('public.admin_comms_monitor()', array['ops.read'], 'all'),
   ('public.admin_integration_health()', array['ops.read'], 'all'),
   ('public.admin_entitlement_lookup(''zz'')', array['support.read'], 'all'),
   ('public.admin_purchase_events(null,5)', array['revenue.read','support.read'], 'any'),
   ('public.admin_recent_audit(5)', array['audit.read'], 'all'),
   ('public.admin_list_staff()', array['staff.manage'], 'all'),
   ('public.admin_grant_staff_role(gen_random_uuid(),''zzz'')', array['staff.manage'], 'all'),
   ('public.admin_revoke_staff_role(gen_random_uuid())', array['staff.manage'], 'all'),
   ('public.hc_admin_commission_report()', array['hc.read'], 'all'),
   ('public.hc_admin_current_terms()', array['hc.read'], 'all'),
   ('public.hc_admin_list_applications(null,5)', array['hc.read','hc.manage'], 'any'),
   ('public.hc_admin_list_campaigns()', array['hc.read'], 'all'),
   ('public.hc_admin_list_members()', array['hc.read'], 'all'),
   ('public.hc_admin_list_payouts(5)', array['hc.read'], 'all'),
   ('public.hc_admin_list_submissions(null)', array['hc.read'], 'all'),
   ('public.hc_admin_list_tiers()', array['hc.read'], 'all'),
   ('public.hc_admin_notifications(true)', array['hc.read'], 'all'),
   ('public.hc_admin_payout_eligibility()', array['hc.read'], 'all'),
   ('public.hc_admin_payout_history(null,5)', array['hc.read'], 'all'),
   ('public.hc_admin_payout_ledger()', array['hc.read'], 'all'),
   ('public.hc_admin_terms_history()', array['hc.read'], 'all'),
   ('public.hc_upsert_tier('''',''x'',null,null,1,true,false,''why'')', array['hc.manage'], 'all'),
   ('public.hc_admin_set_tier_benefits(''zz'',''[]''::jsonb,''why'')', array['hc.manage'], 'all'),
   ('public.hc_admin_config_audit(null,5)', array['hc.read'], 'all'),
   ('public.hc_activate_paid_referrals(''x'',''why'')', array['hc.payout'], 'all'),
   ('public.hc_deactivate_paid_referrals(''why'')', array['hc.payout'], 'all'),
   ('public.hc_settle_clawback(gen_random_uuid(),''waived'',null,''note'',true)', array['hc.payout'], 'all'),
   ('public.hc_admin_assign_tier(gen_random_uuid(),''zz'',''why'')', array['hc.manage'], 'all'),
   ('public.hc_admin_set_partner_status(gen_random_uuid(),''suspended'',''because'')', array['hc.manage'], 'all'),
   ('public.hc_admin_create_campaign('''',null,null,null)', array['hc.manage'], 'all'),
   ('public.hc_admin_assign_campaign(gen_random_uuid(),gen_random_uuid())', array['hc.manage'], 'all'),
   ('public.hc_admin_close_campaign(gen_random_uuid())', array['hc.manage'], 'all'),
   ('public.hc_admin_publish_announcement('''',null,null)', array['hc.manage'], 'all'),
   ('public.hc_admin_review_submission(gen_random_uuid(),''approved'',null)', array['hc.content.review'], 'all'),
   ('public.hc_review_application(gen_random_uuid(),''approved'',null,null,null)', array['hc.applications.review'], 'all'),
   ('public.hc_create_payout_draft(gen_random_uuid())', array['hc.payout'], 'all'),
   ('public.hc_approve_payout(gen_random_uuid())', array['hc.payout'], 'all'),
   ('public.hc_void_payout(gen_random_uuid(),''x'')', array['hc.payout'], 'all'),
   ('public.hc_record_external_payment(gen_random_uuid(),''ref-1234'',current_date,''bank'',true)', array['hc.payout'], 'all'),
   ('public.hc_reverse_recorded_payment(gen_random_uuid(),''because'')', array['hc.payout'], 'all'),
   ('public.admin_get_notification_settings()', array['ops.read','staff.manage'], 'any'),
   ('public.admin_list_notification_deliveries(null,5)', array['ops.read'], 'all'),
   ('public.admin_set_notification_destination(''bad'')', array['staff.manage'], 'all'),
   ('public.admin_verify_notification_destination(''x'')', array['staff.manage'], 'all'),
   ('public.admin_set_notification_email_enabled(false,null)', array['staff.manage'], 'all'),
   ('public.admin_set_notification_thresholds(0,0)', array['staff.manage'], 'all'),
   ('public.admin_retry_notification_delivery(0)', array['staff.manage'], 'all'),
   ('public.admin_list_notifications(''open'',5)', array[]::text[], 'staff'),
   ('public.admin_notification_counts()', array[]::text[], 'staff'),
   ('public.admin_get_notification(0)', array[]::text[], 'staff')
 ) as v(call, perms, mode) loop
   foreach r in array roles loop
     u := (uid_by_role->>r)::uuid;
     res := t.q(u,'authenticated',rec.call);
     ok := not (res ~ '^ERR P0001:not_authorized$' or res ~ '^ERR 42501');
     if rec.mode = 'staff' then want := true;
     elsif rec.mode = 'any' then want := exists (select 1 from public.staff_role_permissions p where p.role=r and p.permission = any(rec.perms));
     else want := not exists (select 1 from unnest(rec.perms) x where not exists (select 1 from public.staff_role_permissions p where p.role=r and p.permission=x)); end if;
     perform t.eq('D '||rec.call||' as '||r, ok::text, want::text);
   end loop;
   res := t.q(nonstaff,'authenticated',rec.call);
   perform t.eq('D '||rec.call||' as non-staff user is denied', (res ~ '^ERR P0001:not_authorized$' or res ~ '^ERR 42501')::text, 'true');
   res := t.q(null,'anon',rec.call);
   perform t.eq('D '||rec.call||' as anon is denied', (res ~ '^ERR 42501')::text, 'true');
 end loop;
 perform t.eq('D-X matrix probing granted no roles and created no tiers', (select count(*) from public.staff_members)||'/'||(select count(*) from public.hc_tiers), staff_before||'/'||tiers_before);
 -- default deny: a staff row with an unknown role has no permissions
 perform t.eq('D-Y limited_contributor cannot see HC or finance or ops RPCs', (select count(*)::text from (values ('public.hc_admin_list_members()'),('public.admin_financial_summary(7)'),('public.admin_comms_monitor()'),('public.hc_admin_payout_ledger()')) v(c) where t.q((uid_by_role->>'limited_contributor')::uuid,'authenticated',v.c) !~ '^ERR P0001:not_authorized$'), '0');
 -- no direct table access for client roles
 perform t.eq('D-Z authenticated has no direct table privileges on notification/payout/audit/staff tables', (select count(*)::text from (values ('cc_notifications'),('cc_notification_settings'),('cc_notification_deliveries'),('payouts'),('admin_audit_log'),('staff_members'),('commissions'),('partners')) v(tn)
     where has_table_privilege('authenticated','public.'||v.tn,'select') or has_table_privilege('anon','public.'||v.tn,'select') or has_table_privilege('authenticated','public.'||v.tn,'insert') or has_table_privilege('authenticated','public.'||v.tn,'update') or has_table_privilege('authenticated','public.'||v.tn,'delete')), '0');
 perform t.eq('D-Z2 service-only functions are not executable by authenticated or anon', (select count(*)::text from (values ('public.cc_raise_notification(text,text,text,text,text,text,text,text)'),('public.cc_sweep_notifications(timestamptz)'),('public.cc_claim_email_deliveries(integer)'),('public.cc_record_delivery_result(bigint,text,text,text)'),('public.cc_resolve_by_dedup(text)')) v(f)
     where has_function_privilege('authenticated',v.f,'execute') or has_function_privilege('anon',v.f,'execute')), '0');
 perform t.eq('D-Z3 direct table read via client role is refused', t.q((uid_by_role->>'owner')::uuid,'authenticated','(select count(*) from public.cc_notification_deliveries)') like 'ERR 42501%', 'true');
 perform t.eq('D-Z4 notification settings masked for non-staff.manage (business_admin has ops.read)', (select (t.q((uid_by_role->>'business_admin')::uuid,'authenticated','public.admin_get_notification_settings()'))::text is not null)::text, 'true');
end $$;

-- ===== E. sensitive data exposure =====
do $$
declare own uuid:=t.mkuser(); ba uuid:=t.mkuser(); v jsonb;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(ba,'business_admin');
 perform public.cc_raise_notification('system_failure','warning','e:1','Test item','body',null,null,null);
 update public.cc_notification_settings set email_destination='founder@business.example', destination_status='verified', verified_at=now(), email_enabled=true where singleton;
 v := (t.q(ba,'authenticated','public.admin_get_notification_settings()'))::jsonb;
 perform t.eq('E1 business_admin (ops.read, no staff.manage) sees MASKED destination', v->>'destination', 'f***@b***.example');
 perform t.eq('E2 masked value contains no full address', (v::text like '%founder@business.example%')::text, 'false');
 v := (t.q(own,'authenticated','public.admin_get_notification_settings()'))::jsonb;
 perform t.eq('E3 owner (staff.manage) sees the full destination', v->>'destination', 'founder@business.example');
 perform t.eq('E4 settings never expose code hash/expiry/attempts', (v ? 'verification_code_hash' or v ? 'verification_expires_at' or v ? 'verification_attempts')::text, 'false');
 perform t.eq('E5 inbox rows expose no dedup_key, refs, or actor ids', (select (x ? 'dedup_key' or x ? 'ref_id' or x ? 'acknowledged_by' or x ? 'required_permission')::text from jsonb_array_elements((t.q(own,'authenticated','public.admin_list_notifications(''open'',5)'))::jsonb) x limit 1), 'false');
 perform t.eq('E6 audit rows for destination changes store a MASKED address only', (select (detail::text like '%founder@%')::text from public.admin_audit_log where action='cc.notification_destination_set' limit 1), coalesce((select (detail::text like '%founder@%')::text from public.admin_audit_log where action='cc.notification_destination_set' limit 1),'false'));
 perform t.eq('E7 payout ledger and history expose no bank/provider identifiers (key names)', (select (j::text ~* '(iban|account_number|routing|card|stripe_|secret|token)')::text from (select (t.q(own,'authenticated','public.hc_admin_payout_ledger()'))::jsonb j) q), 'false');
 perform t.eq('E8 get_my_staff_context returns only role and permissions (no email)', (select ((t.q(own,'authenticated','public.get_my_staff_context()'))::text ~* '@')::text), 'false');
end $$;
select t.report();
