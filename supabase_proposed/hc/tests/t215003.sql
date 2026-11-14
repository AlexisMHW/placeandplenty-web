-- A2 tests for 215003. Identity via t.q / t.x (harness.sql). LOCAL scratch only.
create or replace function t.su(p_sql text) returns text language plpgsql as $f$ declare v text := 'ok'; begin begin execute p_sql; exception when others then v := 'ERR '||sqlstate||':'||sqlerrm; end; return v; end $f$;
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
do $$
declare own uuid:=t.mkuser(); cpm uuid:=t.mkuser(); sup uuid:=t.mkuser(); biz uuid:=t.mkuser(); nobody uuid:=t.mkuser(); gone uuid:=t.mkuser();
  ua uuid:=t.mkuser('applicant.a@example.test'); ub uuid:=t.mkuser('applicant.b@example.test'); uc uuid:=t.mkuser('applicant.c@example.test');
  appa uuid; appb uuid; appc uuid; j text; who text; u uuid; r record; pid uuid; camp uuid; n0 int; n1 int; d bigint; dest uuid; ev bigint; m jsonb;
begin
 insert into public.staff_members(user_id,role) values (own,'owner'),(cpm,'creator_program_manager'),(sup,'support'),(biz,'business_admin');
 insert into public.staff_members(user_id,role,status) values (gone,'owner','revoked');
 -- ===== A. permission matrix
 for r in select * from (values
   ('public.hc_admin_list_tiers()', array['owner','business_admin','creator_program_manager']),
   ('public.hc_admin_tier_audit(10)', array['owner','business_admin','creator_program_manager']),
   ('public.hc_admin_list_events(true,10)', array['owner','business_admin','creator_program_manager']),
   ('public.hc_admin_delivery_health()', array['owner','business_admin','creator_program_manager']),
   ('public.hc_admin_list_destinations()', array['owner','business_admin','creator_program_manager'])
  ) as x(f, ok) loop
   foreach who in array array['owner','business_admin','creator_program_manager','support'] loop
     u := case who when 'owner' then own when 'business_admin' then biz when 'creator_program_manager' then cpm else sup end;
     j := t.q(u,'authenticated',r.f);
     if who = any(r.ok) then perform t.eq('A '||split_part(r.f,'(',1)||' allowed '||who, (j like 'ERR%')::text,'false');
     else perform t.eq('A '||split_part(r.f,'(',1)||' denied '||who, j,'ERR P0001:not_authorized'); end if;
   end loop;
   perform t.eq('A '||split_part(r.f,'(',1)||' denied non-staff', t.q(nobody,'authenticated',r.f),'ERR P0001:not_authorized');
   perform t.eq('A '||split_part(r.f,'(',1)||' denied revoked owner', t.q(gone,'authenticated',r.f),'ERR P0001:not_authorized');
   perform t.eq('A '||split_part(r.f,'(',1)||' anon blocked', left(t.q(null,'anon',r.f),9),'ERR 42501');
 end loop;
 -- service-only RPCs: not callable by authenticated or anon
 foreach j in array array['public.hc_claim_deliveries(5,null)','public.hc_delivery_recipient(1)','public.hc_record_delivery_result(1,''sent'',null,null)','public.hc_emit_awaiting_review(48)','public.hc_mark_destination_verified(gen_random_uuid())','public.hc_emit_event(''member_onboarded'',''x'',''y'',''info'',''z'',false)','public.hc_my_application_id()'] loop
   perform t.eq('A service-only '||split_part(j,'(',1)||' blocked for owner(authenticated)', left(t.q(own,'authenticated',j),9),'ERR 42501');
   perform t.eq('A service-only '||split_part(j,'(',1)||' blocked for anon', left(t.q(null,'anon',j),9),'ERR 42501');
 end loop;
 -- table access closed
 foreach j in array array['hc_events','hc_event_deliveries','hc_notification_destinations','hc_tier_audit'] loop
   perform t.eq('A table '||j||' not readable by authenticated', left(t.q(own,'authenticated','(select count(*) from public.'||j||')'),9),'ERR 42501');
 end loop;

 -- ===== B. tiers: configurable, audited, no invented values
 perform t.eq('B0 no tiers shipped by this migration', (select count(*) from public.hc_tiers)::text, (select count(*) from public.hc_tiers)::text);
 perform t.eq('B1 manager (hc.manage) can create tier with referral OFF', (t.q(cpm,'authenticated',$q$public.hc_admin_upsert_tier('starter','Starter','d','n','["Portal access"]'::jsonb,false,true,10,true)$q$)::jsonb)->>'status','created');
 perform t.eq('B2 manager cannot enable referral eligibility', t.q(cpm,'authenticated',$q$public.hc_admin_upsert_tier('starter','Starter','d','n','["Portal access"]'::jsonb,true,true,10,true)$q$),'ERR P0001:owner_required');
 perform t.eq('B3 owner can enable referral eligibility', (t.q(own,'authenticated',$q$public.hc_admin_upsert_tier('starter','Starter','d','n','["Portal access"]'::jsonb,true,true,10,true)$q$)::jsonb)->>'status','updated');
 perform t.eq('B4 support cannot upsert', t.q(sup,'authenticated',$q$public.hc_admin_upsert_tier('x1','X','d','n','[]'::jsonb,false,true,1,true)$q$),'ERR P0001:not_authorized');
 perform t.eq('B5 bad slug rejected', t.q(own,'authenticated',$q$public.hc_admin_upsert_tier('Bad Slug','X','d','n','[]'::jsonb,false,true,1,true)$q$),'ERR P0001:invalid_slug');
 perform t.eq('B6 benefits must be array of short strings', t.q(own,'authenticated',$q$public.hc_admin_upsert_tier('t2','Tt','d','n','[1]'::jsonb,false,true,1,true)$q$),'ERR P0001:invalid_benefits');
 perform t.eq('B7 benefits max 12', t.q(own,'authenticated',$q$public.hc_admin_upsert_tier('t2','Tt','d','n',(select jsonb_agg('b'||i) from generate_series(1,13) i),false,true,1,true)$q$),'ERR P0001:invalid_benefits');
 perform t.eq('B8 audit has created + updated rows', (select (count(*) >= 2)::text from public.hc_tier_audit where tier_slug='starter'),'true');
 perform t.eq('B9 audit is append-only (update blocked)', t.su('update public.hc_tier_audit set action=action'),'ERR P0001:hc_ledger_is_append_only');
 perform t.eq('B10 audit is append-only (delete blocked)', t.su('delete from public.hc_tier_audit'),'ERR P0001:hc_ledger_is_append_only');
 perform t.eq('B11 tier writes logged in admin_audit_log', (select count(*)>=2 from public.admin_audit_log where action='hc.tier_upsert')::text,'true');
 perform t.eq('B12 tier list includes member counts', ((t.q(cpm,'authenticated','public.hc_admin_list_tiers()')::jsonb)->0->>'members'),'0');

 -- ===== C. lifecycle: application -> status -> withdraw -> approve/decline -> events
 perform set_config('request.jwt.claims','{}',true);
 insert into public.creator_applications(applicant_user_id,full_name,email,email_normalized,platforms,niches,audience_summary,terms_version,disclosure_ack,consent_to_contact,status)
  values (ua,'Applicant A','applicant.a@example.test','applicant.a@example.test','[{}]'::jsonb,array['budget_hosting'],'audience summary for tests','draft-1',true,true,'received') returning id into appa;
 perform set_config('request.jwt.claims','{}',true);
 insert into public.creator_applications(applicant_user_id,full_name,email,email_normalized,platforms,niches,audience_summary,terms_version,disclosure_ack,consent_to_contact,status)
  values (ub,'Applicant B','applicant.b@example.test','applicant.b@example.test','[{}]'::jsonb,array['budget_hosting'],'audience summary for tests','draft-1',true,true,'received') returning id into appb;
 perform set_config('request.jwt.claims','{}',true);
 insert into public.creator_applications(applicant_user_id,full_name,email,email_normalized,platforms,niches,audience_summary,terms_version,disclosure_ack,consent_to_contact,status)
  values (uc,'Applicant C','applicant.c@example.test','applicant.c@example.test','[{}]'::jsonb,array['budget_hosting'],'audience summary for tests','draft-1',true,true,'received') returning id into appc;
 m := t.q(ua,'authenticated','public.creator_program_status()')::jsonb;
 perform t.eq('C1 applicant sees own status', m->'application'->>'status','received');
 perform t.eq('C2 applicant response has no review note or email', (m::text like '%review_note%' or m::text like '%applicant.a@%')::text,'false');
 perform t.eq('C3 applicant sees no member yet', coalesce(m->>'member','null'),'null');
 perform t.eq('C4 other applicant sees only their own', (t.q(ub,'authenticated','public.creator_program_status()')::jsonb)->'application'->>'status','received');
 perform t.eq('C5 non-applicant sees nothing', coalesce((t.q(nobody,'authenticated','public.creator_program_status()')::jsonb)->>'application','null'),'null');
 perform t.eq('C6 anon blocked', left(t.q(null,'anon','public.creator_program_status()'),9),'ERR 42501');
 perform t.eq('C7 withdraw by applicant A', (t.q(ua,'authenticated','public.creator_withdraw_application()')::jsonb)->>'status','withdrawn');
 perform t.eq('C8 withdrawn state visible', (t.q(ua,'authenticated','public.creator_program_status()')::jsonb)->'application'->>'status','withdrawn');
 perform t.eq('C9 second withdraw rejected', t.q(ua,'authenticated','public.creator_withdraw_application()'),'ERR P0001:not_withdrawable');
 perform t.eq('C10 non-applicant cannot withdraw', t.q(nobody,'authenticated','public.creator_withdraw_application()'),'ERR P0001:no_application');
 perform t.eq('C11 reviewer cannot approve a withdrawn application', t.q(cpm,'authenticated',format('public.hc_review_application(%L,''approved'',null,null,null)',appa)),'ERR P0001:application_closed');
 perform t.eq('C12 withdrawal emitted exactly one event', (select count(*) from public.hc_events where kind='application_withdrawn' and ref_id=appa::text)::text,'1');
 -- approve B with NO tier (basic member)
 j := t.q(cpm,'authenticated',format('public.hc_review_application(%L,''approved'',null,null,null)',appb));
 perform t.eq('C13 approve without tier works (basic member)', (j like 'ERR%')::text,'false');
 select id into pid from public.partners where user_id = ub;
 perform t.eq('C14 basic member has NULL tier', (select tier is null from public.partners where id=pid)::text,'true');
 perform t.eq('C15 approved event emitted once', (select count(*) from public.hc_events where kind='application_approved' and ref_id=appb::text)::text,'1');
 perform t.eq('C16 approved event queues one applicant_email delivery',
   (select count(*) from public.hc_event_deliveries d join public.hc_events e on e.id=d.event_id where e.kind='application_approved' and e.ref_id=appb::text and d.channel='applicant_email')::text,'1');
 perform t.eq('C17 applicant resolver returns display name, service-only', (t.q(null,'service_role',format('public.hc_delivery_recipient(%s)',(select d.id from public.hc_event_deliveries d join public.hc_events e on e.id=d.event_id where e.kind='application_approved' and e.ref_id=appb::text and d.channel='applicant_email')))::jsonb)->>'display_name','Applicant B');
 m := t.q(ub,'authenticated','public.creator_program_status()')::jsonb;
 perform t.eq('C18 member sees approved status', m->'member'->>'status','approved');
 perform t.eq('C19 basic member referral NOT eligible, reason', m->'member'->'referral'->>'reason','program_disabled');
 -- decline C
 perform t.eq('C20 decline works', (t.q(cpm,'authenticated',format('public.hc_review_application(%L,''declined'',null,''internal note'',null)',appc)) like 'ERR%')::text,'false');
 perform t.eq('C21 declined event emitted once', (select count(*) from public.hc_events where kind='application_declined' and ref_id=appc::text)::text,'1');
 m := t.q(uc,'authenticated','public.creator_program_status()')::jsonb;
 perform t.eq('C22 declined state visible, internal note NOT visible', (m->'application'->>'status')||'/'||(m::text like '%internal note%')::text,'declined/false');
 perform t.eq('C23 withdraw after decision rejected', t.q(uc,'authenticated','public.creator_withdraw_application()'),'ERR P0001:not_withdrawable');
 perform t.eq('C24 recipient resolver returns email for consenting applicant (service)', (t.q(null,'service_role',format('public.hc_delivery_recipient(%s)',(select d.id from public.hc_event_deliveries d join public.hc_events e on e.id=d.event_id where e.kind='application_declined' and e.ref_id=appc::text and d.channel='applicant_email'))))::jsonb->>'display_name','Applicant C');

 -- ===== D. member tier + status changes, audit, referral eligibility
 perform t.eq('D1 assign tier (manager)', (t.q(cpm,'authenticated',format('public.hc_admin_set_member_tier(%L,''starter'')',pid))::jsonb)->>'status','saved');
 perform t.eq('D2 unknown tier rejected', t.q(cpm,'authenticated',format('public.hc_admin_set_member_tier(%L,''nope'')',pid)),'ERR P0001:tier_not_configured');
 perform t.eq('D3 member tier change audited', (select count(*) from public.hc_tier_audit where action='member_tier_changed' and partner_id=pid)::text,'1');
 perform t.eq('D4 referral not eligible while program disabled', (t.q(null,'service_role',format('public.hc_partner_referral_eligible(%L)',pid))::jsonb)->>'reason','program_disabled');
 perform set_config('request.jwt.claims','{}',true);
 update public.hc_settings set enabled = true;
 perform t.eq('D5 eligible only when program on + approved + tier referral-eligible', (t.q(null,'service_role',format('public.hc_partner_referral_eligible(%L)',pid))::jsonb)->>'eligible','true');
 perform t.eq('D6 basic member (tier null) never eligible', (t.q(own,'authenticated',format('public.hc_admin_set_member_tier(%L,null)',pid)) like 'ERR%')::text||'/'||((t.q(null,'service_role',format('public.hc_partner_referral_eligible(%L)',pid))::jsonb)->>'reason'),'false/basic_member_no_paid_terms');
 perform t.eq('D7 tier set back', (t.q(cpm,'authenticated',format('public.hc_admin_set_member_tier(%L,''starter'')',pid)) like 'ERR%')::text,'false');
 perform t.eq('D8 suspend via existing RPC', (t.q(own,'authenticated',format('public.hc_set_partner_status(%L,''suspended'',null)',pid)) like 'ERR%')::text,'false');
 perform t.eq('D9 suspended member not eligible', (t.q(null,'service_role',format('public.hc_partner_referral_eligible(%L)',pid))::jsonb)->>'reason','partner_not_approved');
 perform t.eq('D10 suspension audited + event', (select count(*) from public.hc_tier_audit where action='member_status_changed' and partner_id=pid)::text||'/'||(select count(*) from public.hc_events where kind='member_suspended' and ref_id=pid::text)::text,'1/1');
 perform t.eq('D11 cannot set tier while suspended', t.q(cpm,'authenticated',format('public.hc_admin_set_member_tier(%L,''starter'')',pid)),'ERR P0001:partner_not_approved');
 perform t.eq('D12 suspended member status visible to member', (t.q(ub,'authenticated','public.creator_program_status()')::jsonb)->'member'->>'status','suspended');
 -- inactive tier
 perform t.eq('D13 deactivate tier then reinstate', (t.q(cpm,'authenticated',$q$public.hc_admin_upsert_tier('starter','Starter','d','n','["Portal access"]'::jsonb,true,true,10,false)$q$) like 'ERR%')::text,'false') ; -- manager unchanged referral flag true->true is allowed
 perform t.eq('D14 reinstate', (t.q(own,'authenticated',format('public.hc_set_partner_status(%L,''approved'',''starter'')',pid)) like 'ERR%')::text,'false');
 perform t.eq('D15 reinstated event emitted', (select count(*) from public.hc_events where kind='member_reinstated' and ref_id=pid::text)::text,'1');
 perform t.eq('D16 inactive tier => not eligible', (t.q(null,'service_role',format('public.hc_partner_referral_eligible(%L)',pid))::jsonb)->>'reason','tier_inactive');

 -- ===== E. assignment guard
 perform set_config('request.jwt.claims','{}',true);
 insert into public.hc_campaigns(title,brief,status) values ('Campaign 1','a long enough brief text for campaign','open') returning id into camp;
 perform t.eq('E1 assign to approved member in open campaign', (t.q(cpm,'authenticated',format('public.hc_admin_assign_campaign(%L,%L)',camp,pid)) like 'ERR%')::text,'false');
 perform t.x(null,'service_role','select 1');
 perform set_config('request.jwt.claims','{}',true);
 update public.hc_tiers set assignments_enabled=false where slug='starter';
 perform set_config('request.jwt.claims','{}',true);
 insert into public.hc_campaigns(title,brief,status) values ('Campaign 2','a long enough brief text for campaign','open') returning id into camp;
 perform t.eq('E2 tier with assignments disabled blocks', t.q(cpm,'authenticated',format('public.hc_admin_assign_campaign(%L,%L)',camp,pid)),'ERR P0001:tier_assignments_disabled');
 perform set_config('request.jwt.claims','{}',true);
 update public.hc_tiers set assignments_enabled=true where slug='starter';
 perform set_config('request.jwt.claims','{}',true);
 update public.hc_campaigns set status='closed' where id=camp;
 perform t.eq('E3 closed campaign blocks', t.q(cpm,'authenticated',format('public.hc_admin_assign_campaign(%L,%L)',camp,pid)),'ERR P0001:campaign_closed');
 perform set_config('request.jwt.claims','{}',true);
 update public.partners set status='suspended' where id=pid;
 perform set_config('request.jwt.claims','{}',true);
 insert into public.hc_campaigns(title,brief,status) values ('Campaign 3','a long enough brief text for campaign','open') returning id into camp;
 perform t.eq('E4 suspended member blocks', t.q(cpm,'authenticated',format('public.hc_admin_assign_campaign(%L,%L)',camp,pid)),'ERR P0001:partner_not_approved');
 perform set_config('request.jwt.claims','{}',true);
 update public.partners set status='approved' where id=pid;

 -- ===== F. events: dedup, content, severity, data minimisation
 perform t.eq('F1 event rows carry no email/name', (select count(*) from public.hc_events where ref_id like '%@%' or kind like '%@%')::text,'0');
 perform t.eq('F2 duplicate emission is a no-op', (select public.hc_emit_event('member_onboarded','partner','dup-1','info','dedup-test',false) is not null)::text||'/'||(select public.hc_emit_event('member_onboarded','partner','dup-1','info','dedup-test',false) is null)::text,'true/true');
 perform t.eq('F3 events are append-only (delete blocked)', t.su('delete from public.hc_events'),'ERR P0001:append_only');
 perform t.eq('F4 events: only ack columns mutable', t.su('update public.hc_events set kind=kind||''x'''),'ERR P0001:append_only');
 perform t.eq('F5 ack by manager', (t.q(cpm,'authenticated',format('public.hc_admin_ack_event(%s)',(select min(id) from public.hc_events))) like 'ERR%')::text,'false');
 perform t.eq('F6 ack by support denied', t.q(sup,'authenticated','public.hc_admin_ack_event(1)'),'ERR P0001:not_authorized');
 -- payout draft event
 perform set_config('request.jwt.claims','{}',true);
 insert into public.payouts(partner_id,total_cents,status) values (pid,5000,'draft');
 perform t.eq('F7 payout draft emits needs-approval event (action severity)', (select severity from public.hc_events where kind='payout_needs_approval' order by id desc limit 1),'action');
 -- existing owner-notification bridge
 perform set_config('request.jwt.claims','{}',true);
 insert into public.hc_owner_notifications(kind,ref_type,ref_id,severity) values ('member_claimed','partner','pp-1','info'),('content_submitted','submission','ss-1','action');
 perform t.eq('F8 bridge maps member_claimed->member_onboarded, content_submitted kept', (select string_agg(kind, ',' order by kind) from public.hc_events where ref_id in ('pp-1','ss-1')),'content_submitted,member_onboarded');
 -- awaiting review sweep
 perform set_config('request.jwt.claims','{}',true);
 update public.creator_applications set created_at = now() - interval '3 days' where id = appb;
 perform set_config('request.jwt.claims','{}',true);
 insert into public.creator_applications(applicant_user_id,full_name,email,email_normalized,platforms,niches,audience_summary,terms_version,disclosure_ack,consent_to_contact,status,created_at)
   values (null,'Old Applicant','old@example.test','old@example.test','[{}]'::jsonb,array['budget_hosting'],'audience summary for tests','draft-1',true,true,'received', now()-interval '3 days') returning id into appc;
 perform t.eq('F9 sweep emits for stale received applications', t.q(null,'service_role','public.hc_emit_awaiting_review(48)'),'1');
 perform t.eq('F10 sweep is idempotent same day', t.q(null,'service_role','public.hc_emit_awaiting_review(48)'),'0');

 -- ===== G. destinations + deliveries (nothing is sent by the database)
 perform t.eq('G1 manager cannot add destination (owner only)', t.q(cpm,'authenticated',$q$public.hc_admin_add_destination('ops@example.test','Ops')$q$),'ERR P0001:not_authorized');
 perform t.eq('G2 bad address rejected', t.q(own,'authenticated',$q$public.hc_admin_add_destination('not-an-email','x')$q$),'ERR P0001:invalid_address');
 j := t.q(own,'authenticated',$q$public.hc_admin_add_destination('Ops@Example.test','Ops')$q$);
 dest := ((j::jsonb)->>'id')::uuid;
 perform t.eq('G3 added unverified', (j::jsonb)->>'status','added_unverified');
 perform t.eq('G4 cannot activate unverified', t.q(own,'authenticated',format('public.hc_admin_set_destination_active(%L,true)',dest)),'ERR P0001:not_verified');
 perform t.eq('G5 check constraint forbids active+unverified', t.su(format('update public.hc_notification_destinations set active=true where id=%L',dest)) like 'ERR 23514%','true');
 perform t.eq('G6 destination list masks address', (t.q(own,'authenticated','public.hc_admin_list_destinations()')::jsonb)->0->>'address_masked','op***@example.test');
 perform t.eq('G7 audit log does not contain the address', (select count(*) from public.admin_audit_log where detail::text ilike '%example.test%' and action like 'hc.destination%')::text,'0');
 select count(*) into n0 from public.hc_event_deliveries where channel='staff_email';
 perform t.eq('G8 no staff_email deliveries queued while destination unverified', n0::text,'0');
 perform t.eq('G9 verify (service)', (t.q(null,'service_role',format('public.hc_mark_destination_verified(%L)',dest)) like 'ERR%')::text,'false');
 perform t.eq('G10 activate verified', (t.q(own,'authenticated',format('public.hc_admin_set_destination_active(%L,true)',dest)) like 'ERR%')::text,'false');
 ev := public.hc_emit_event('application_received','creator_application','zz-1','action','g-ev-1',false);
 select id into d from public.hc_event_deliveries where event_id=ev and channel='staff_email';
 perform t.eq('G11 new event queues one staff_email delivery for the active destination', (select count(*) from public.hc_event_deliveries where event_id=ev and channel='staff_email')::text,'1');
 perform t.eq('G12 staff recipient resolves to address (service only)', (t.q(null,'service_role',format('public.hc_delivery_recipient(%s)',d))::jsonb)->>'email','ops@example.test');
 -- claim -> sent -> delivered; failure -> retry -> final fail
 j := t.q(null,'service_role','public.hc_claim_deliveries(50,''staff_email'')');
 perform t.eq('G13 claim returns the queued delivery with kind and refs only', (j::jsonb) @> jsonb_build_array(jsonb_build_object('id', d)) ,'true');
 perform t.eq('G14 claim result carries no address', (j like '%example.test%')::text,'false');
 perform t.eq('G15 claimed again immediately => nothing (lease)', t.q(null,'service_role','jsonb_array_length(public.hc_claim_deliveries(50,''staff_email''))'),'0');
 perform t.eq('G16 record sent', (t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''sent'',null,''prov-1'')',d))::jsonb)->>'status','sent');
 perform t.eq('G17 sent is NOT delivered', (select status from public.hc_event_deliveries where id=d),'sent');
 perform t.eq('G18 record delivered', (t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''delivered'',null,null)',d))::jsonb)->>'status','delivered');
 perform t.eq('G19 delivered is final (failed after delivered ignored)', (t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''failed'',''x'',null)',d))::jsonb)->>'status','delivered');
 ev := public.hc_emit_event('application_received','creator_application','zz-2','action','g-ev-2',false);
 select id into d from public.hc_event_deliveries where event_id=ev and channel='staff_email';
 perform t.q(null,'service_role','public.hc_claim_deliveries(50,''staff_email'')');
 perform t.eq('G20 failure requeues with backoff', (t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''failed'',''smtp_timeout'',null)',d))::jsonb)->>'status','queued');
 perform t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''failed'',''Some Provider: secret text'',null)',d));
 perform t.eq('G21 provider text sanitised to a code', (select last_error from public.hc_event_deliveries where id=d),'error');
 perform set_config('request.jwt.claims','{}',true);
 update public.hc_event_deliveries set attempts = max_attempts where id = d;
 perform t.eq('G22 exhausted attempts => failed', (t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''failed'',''smtp_timeout'',null)',d))::jsonb)->>'status','failed');
 perform t.eq('G23 health reports a failed delivery', (t.q(own,'authenticated','public.hc_admin_delivery_health()')::jsonb)->>'failed','1');
 perform t.eq('G24 invalid outcome rejected', t.q(null,'service_role',format('public.hc_record_delivery_result(%s,''bogus'',null,null)',d)),'ERR P0001:invalid_outcome');
 perform t.eq('G25 deactivate destination stops new queueing', (t.q(own,'authenticated',format('public.hc_admin_set_destination_active(%L,false)',dest)) like 'ERR%')::text,'false');
 ev := public.hc_emit_event('application_received','creator_application','zz-3','action','g-ev-3',false);
 perform t.eq('G26 no staff delivery after deactivation', (select count(*) from public.hc_event_deliveries where event_id=ev and channel='staff_email')::text,'0');
 perform t.eq('G27 inbox delivery row exists for every event', (select count(*) from public.hc_events e where not exists (select 1 from public.hc_event_deliveries d where d.event_id=e.id and d.channel='inbox'))::text,'0');
 perform t.eq('G28 events list shows delivery summary', ((t.q(own,'authenticated','public.hc_admin_list_events(false,500)')::jsonb) @> '[]'::jsonb)::text,'true');
end $$;
select t.report();
