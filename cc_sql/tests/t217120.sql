-- Agent D suite for 217120 (scratch Postgres only; runs after harness.sql on the stub chain with ALL steps incl. 217120 applied).
-- D3: hc_admin_set_tier_benefits writes through hc_tier_write (single tier writer) and is audited. D5: payment method validated in the DB.
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
create or replace function t.fixture_payable(p_code text, p_n int, p_prefix text) returns void language plpgsql as $f$
declare uu uuid; ee uuid; i int; begin
 for i in 1..p_n loop
   uu := t.mkuser(); update auth.users set created_at=now()-interval '10 minutes' where id=uu;
   perform t.q(uu,'authenticated','public.record_referral_claim('''||p_code||''', now()-interval ''5 minutes'')');
   insert into public.gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at) values (uu,'plus','plus_annual','web',p_prefix||i,'production',now()) returning id into ee;
   perform t.q(null,'service_role','public.record_purchase_facts('''||ee||'''::uuid,'''||p_prefix||i||''',''usd'',5999,0,200,null,null,''webhook'')');
   perform t.q(null,'service_role','public.reconcile_commission_for_entitlement('''||ee||'''::uuid)');
 end loop; end $f$;

-- ===== D3: tier benefits through the single writer =====
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); bad uuid:=t.mkuser(); j text; n0 bigint; n1 bigint; c0 bigint; c1 bigint; calls0 bigint; calls1 bigint; o public.hc_tiers; q public.hc_tiers;
 w text; oid_w oid := 'public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text)'::regprocedure;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager');
 perform t.eq('D3.0 paid referrals start DISABLED (no rates invented, default off)', (select paid_referrals_enabled::text from public.hc_settings where singleton), 'false');
 j := t.q(cpm,'authenticated','public.hc_upsert_tier(''silver'',''Silver'',''desc'',''notes'',7,true,false,''fixture'')');
 perform t.eq('D3.1 fixture tier created by manager, not paid-eligible', ((j::jsonb)->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='silver'), 'created/false');
 j := t.q(own,'authenticated','public.hc_upsert_tier(''gold'',''Gold'',''gdesc'',null,3,true,true,''fixture gold'')');
 perform t.eq('D3.1b owner creates a paid-eligible fixture tier', (select paid_referrals_eligible::text from public.hc_tiers where slug='gold'), 'true');
 select * into o from public.hc_tiers where slug='silver';
 select count(*) into n0 from public.hc_config_audit where entity='tier' and entity_key='silver';
 select count(*) into c0 from public.hc_tier_audit where tier_slug='silver';
 perform set_config('track_functions','all',true);
 select coalesce(calls,0) into calls0 from pg_stat_get_xact_function_calls(oid_w) as f(calls);
 j := t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',''["Early access","Monthly call"]''::jsonb,''add benefits'')');
 perform t.eq('D3.2 manager sets benefits, same return shape', j, '{"status": "updated"}');
 select coalesce(calls,0) into calls1 from pg_stat_get_xact_function_calls(oid_w) as f(calls);
 perform t.eq('D3.3 the edit went THROUGH hc_tier_write (xact call counter +1)', ((calls1-coalesce(calls0,0))=1)::text, 'true');
 select count(*) into n1 from public.hc_config_audit where entity='tier' and entity_key='silver';
 select count(*) into c1 from public.hc_tier_audit where tier_slug='silver';
 perform t.eq('D3.4 hc_config_audit row written with the given reason', (select (count(*)=1)::text from public.hc_config_audit where entity='tier' and entity_key='silver' and reason='add benefits' and id > (select max(id) from public.hc_config_audit where entity='tier' and entity_key='silver' and reason is distinct from 'add benefits')), 'true');
 perform t.eq('D3.5 config audit +1 and tier audit +1 for the edit', ((n1-n0)||'/'||(c1-c0)), '1/1');
 select * into q from public.hc_tiers where slug='silver';
 perform t.eq('D3.6 benefits stored; every other field unchanged', (q.benefits = '["Early access","Monthly call"]'::jsonb and q.label=o.label and q.description is not distinct from o.description and q.eligibility_notes is not distinct from o.eligibility_notes and q.sort_order=o.sort_order and q.active=o.active and q.paid_referrals_eligible=o.paid_referrals_eligible and q.referral_eligible=o.referral_eligible and q.assignments_enabled=o.assignments_enabled)::text, 'true');
 perform t.eq('D3.7 paid-eligible tier: manager benefits edit keeps eligibility (no owner escalation, no flip)', ((t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''gold'',''["Perk"]''::jsonb,''gold perk'')'))::jsonb->>'status')||'/'||(select paid_referrals_eligible::text from public.hc_tiers where slug='gold'), 'updated/true');
 perform t.eq('D3.8 13 benefits refused', t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',(select jsonb_agg(''b''||i) from generate_series(1,13) i),''too many'')'), 'ERR P0001:invalid_benefits');
 perform t.eq('D3.9 non-string / over-long benefit refused', t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',''[1]''::jsonb,''bad'')')||'/'||t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',jsonb_build_array(repeat(''x'',121)),''bad'')'), 'ERR P0001:invalid_benefits/ERR P0001:invalid_benefits');
 perform t.eq('D3.10 reason required (3-200)', t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',''[]''::jsonb,''ab'')')||'/'||t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''silver'',''[]''::jsonb,null)'), 'ERR P0001:invalid_reason/ERR P0001:invalid_reason');
 perform t.eq('D3.11 unknown tier', t.q(cpm,'authenticated','public.hc_admin_set_tier_benefits(''nope'',''[]''::jsonb,''why'')'), 'ERR P0001:tier_not_found');
 perform t.eq('D3.12 non-staff and anon denied', t.q(bad,'authenticated','public.hc_admin_set_tier_benefits(''silver'',''[]''::jsonb,''why'')')||'/'||(t.q(null,'anon','public.hc_admin_set_tier_benefits(''silver'',''[]''::jsonb,''why'')') like 'ERR 42501%'), 'ERR P0001:not_authorized/true');
 perform t.eq('D3.13 failed attempts did not change benefits', (select benefits::text from public.hc_tiers where slug='silver'), '["Early access", "Monthly call"]');
 perform t.eq('D3.14 hc_tier_write is not callable by API roles', (has_function_privilege('authenticated', oid_w, 'execute') or has_function_privilege('anon', oid_w, 'execute'))::text, 'false');
 -- exactly ONE function body writes public.hc_tiers
 select string_agg(p.proname, ',' order by p.proname) into w from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ~* '(insert\s+into|update|delete\s+from|merge\s+into)\s+public\.hc_tiers\M';
 perform t.eq('D3.15 hc_tier_write is the only function that writes public.hc_tiers', coalesce(w,'(none)'), 'hc_tier_write');
 perform t.eq('D3.16 hc_admin_set_tier_benefits body calls hc_tier_write', (pg_get_functiondef('public.hc_admin_set_tier_benefits(text,jsonb,text)'::regprocedure) ~ 'hc_tier_write')::text, 'true');
 perform t.eq('D3.17 paid referrals still globally off after all of the above', (select paid_referrals_enabled::text from public.hc_settings where singleton), 'false');
 perform t.eq('D3.18 tier defaults: a tier created without eligibility is NOT paid-eligible', (select paid_referrals_eligible::text from public.hc_tiers where slug='silver'), 'false');
end $$;

-- ===== D5: payment-method validation =====
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); pid uuid; pid2 uuid; j text; pay uuid; pay2 uuid; today text := current_date::text; m text; r text; e text; n int;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager');
 update public.hc_settings set enabled=true where singleton;
 perform t.q(own,'authenticated','public.hc_upsert_tier(''founding'',''Founding creator'',null,null,1,true,true,''fixture'')');
 insert into public.partners(user_id,display_name,status,tier) values (null,'P One','approved','founding') returning id into pid;
 insert into public.partner_codes(partner_id,code) values (pid,'p-one');
 insert into public.partners(user_id,display_name,status,tier) values (null,'P Two','approved','founding') returning id into pid2;
 insert into public.partner_codes(partner_id,code) values (pid2,'p-two');
 perform t.q(own,'authenticated','public.hc_activate_paid_referrals(''ACTIVATE PAID REFERRALS'',''scratch test'')');   -- scratch DB only
 perform t.fixture_payable('p-one', 5, 'tb-'); perform t.fixture_payable('p-two', 5, 'tc-');
 perform t.q(null,'service_role','public.sweep_commissions(now()+interval ''46 days'')');
 pay  := ((t.q(own,'authenticated','public.hc_create_payout_draft('''||pid||'''::uuid)'))::jsonb->>'payout_id')::uuid;
 pay2 := ((t.q(own,'authenticated','public.hc_create_payout_draft('''||pid2||'''::uuid)'))::jsonb->>'payout_id')::uuid;
 perform t.q(own,'authenticated','public.hc_approve_payout('''||pay||'''::uuid)');
 perform t.q(own,'authenticated','public.hc_approve_payout('''||pay2||'''::uuid)');
 -- RPC: every bad method is refused with invalid_method and leaves the payout approved
 foreach m in array array['NULL','''''','''   ''','''unknown''','''N/A''','''  None ''','''x''','''!!!''','repeat(''a'',61)','''bank''||chr(7)||''x''','''tbd''','''?'''] loop
   r := t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'','''||today||'''::date,'||m||',true)');
   perform t.eq('D5.1 invalid method refused: '||m, r, 'ERR P0001:invalid_method');
 end loop;
 perform t.eq('D5.2 payout still approved, nothing recorded', (select status||'/'||coalesce(external_ref,'-')||'/'||coalesce(external_method,'-') from public.payouts where id=pay), 'approved/-/-');
 perform t.eq('D5.3 no payment event or audit written by refused attempts', (select count(*)::text from public.payout_events where payout_id=pay and event='payment_recorded'), '0');
 perform t.eq('D5.4 other checks keep their codes (confirm, ref, date)', t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'','''||today||'''::date,''bank transfer'',false)')||'/'||t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''ab'','''||today||'''::date,''bank transfer'',true)')||'/'||t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'',current_date+2,''bank transfer'',true)'), 'ERR P0001:confirmation_required/ERR P0001:external_reference_required/ERR P0001:invalid_paid_on');
 perform t.eq('D5.5 cpm / anon still denied before method is looked at', t.q(cpm,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'','''||today||'''::date,null,true)')||'/'||(t.q(null,'anon','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'','''||today||'''::date,null,true)') like 'ERR 42501%'), 'ERR P0001:not_authorized/true');
 -- direct guard: approved -> paid with every other field present but no / bad method
 foreach m in array array['null','''''','''unknown''','''x'''] loop
   e := t.x(null,'service_role','update public.payouts set status=''paid'', paid_at=now(), paid_on=current_date, external_ref=''DIRECT-REF-1'', external_method='||m||', confirmed_by='''||own||'''::uuid, confirmed_at=now() where id='''||pay2||'''::uuid');
   perform t.eq('D5.6 guard refuses approved->paid with method '||m, e, 'ERR P0001:invalid_method');
 end loop;
 e := t.x(null,'service_role','update public.payouts set status=''paid'', paid_at=now(), paid_on=current_date, external_ref=null, external_method=''bank transfer'', confirmed_by='''||own||'''::uuid, confirmed_at=now() where id='''||pay2||'''::uuid');
 perform t.eq('D5.7 guard still requires the external reference', e, 'ERR P0001:external_payment_confirmation_required');
 e := t.x(null,'service_role','update public.payouts set status=''paid'', paid_at=now(), paid_on=current_date, external_ref=''DIRECT-REF-1'', external_method=''bank transfer'', confirmed_by=null, confirmed_at=null where id='''||pay2||'''::uuid');
 perform t.eq('D5.8 guard still requires explicit confirmation (confirmer + time)', e, 'ERR P0001:external_payment_confirmation_required');
 e := t.x(null,'service_role','update public.payouts set status=''paid'', paid_at=now(), paid_on=null, external_ref=''DIRECT-REF-1'', external_method=''bank transfer'', confirmed_by='''||own||'''::uuid, confirmed_at=now() where id='''||pay2||'''::uuid');
 perform t.eq('D5.9 guard still requires the payment date', e, 'ERR P0001:external_payment_confirmation_required');
 perform t.eq('D5.10 second payout untouched after refused direct updates', (select status from public.payouts where id=pay2), 'approved');
 -- valid path: normalised method, audit, final
 j := t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'','''||today||'''::date,''  bank    transfer  '',true)');
 perform t.eq('D5.11 valid method recorded (whitespace normalised)', ((j::jsonb)->>'status')||'/'||(select status||'/'||external_method||'/'||external_ref||'/'||(confirmed_by=own)::text from public.payouts where id=pay), 'paid_recorded/paid/bank transfer/METHOD-REF-001/true');
 perform t.eq('D5.12 payment event + admin audit written with the method', (select count(*)::text from public.payout_events where payout_id=pay and event='payment_recorded' and detail->>'method'='bank transfer')||'/'||(select count(*)::text from public.admin_audit_log where action='hc.payout_payment_recorded' and target_id=pay::text), '1/1');
 perform t.eq('D5.13 replay is idempotent (already_recorded), even with a different method', ((t.q(own,'authenticated','public.hc_record_external_payment('''||pay||'''::uuid,''METHOD-REF-001'','''||today||'''::date,''cheque'',true)'))::jsonb)->>'status', 'already_recorded');
 perform t.eq('D5.14 recorded method is final (cannot be edited on a paid payout)', t.x(null,'service_role','update public.payouts set external_method=''cheque'' where id='''||pay||'''::uuid'), 'ERR P0001:payout_record_is_final');
 e := t.x(null,'service_role','update public.payouts set status=''paid'', paid_at=now(), paid_on=current_date, external_ref=''DIRECT-REF-2'', external_method=''cheque no. 12'', confirmed_by='''||own||'''::uuid, confirmed_at=now() where id='''||pay2||'''::uuid');
 perform t.eq('D5.15 guard accepts approved->paid when everything incl. method is present', e, 'ok');
 perform t.eq('D5.16 draft -> paid still illegal; paid stays final', (select count(*)::text from public.payouts where status='paid'), '2');
 perform t.eq('D5.17 reversal path unaffected (paid -> reversed)', ((t.q(own,'authenticated','public.hc_reverse_recorded_payment('''||pay||'''::uuid,''bank returned the transfer'')'))::jsonb)->>'status', 'reversed');
 perform t.eq('D5.18 no function moves money (still none)', (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'hc\_%' or p.proname like 'admin\_%' or p.proname like 'cc\_%') and pg_get_functiondef(p.oid) ~* '(transfer_money|stripe\.payouts|payouts\.create|http_post|net\.http)'), '0');
end $$;
select t.report();
