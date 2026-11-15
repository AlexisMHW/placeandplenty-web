-- 01_pre_apply_readonly_CORRECTED.sql (follow-up J; replaces verify/01_pre_apply_readonly.sql). READ-ONLY, every statement is a SELECT. Only section C changed (D6).
-- READ-ONLY. Run against the QA project BEFORE any schema write. Every statement is a SELECT.
-- Expected: section A all 'absent' (or consistent with a partial prior apply), section B all 'present', C captured and archived.
-- A. Objects this package creates (expect absent on QA today)
select 'A' sec, o, case when ok then 'PRESENT' else 'absent' end st from (values
 ('table cohost_level_capabilities', to_regclass('public.cohost_level_capabilities') is not null),
 ('table payment_event_ledger', to_regclass('public.payment_event_ledger') is not null),
 ('table staff_members', to_regclass('public.staff_members') is not null),
 ('table partners', to_regclass('public.partners') is not null),
 ('table hc_tiers', to_regclass('public.hc_tiers') is not null),
 ('table email_provider_events', to_regclass('public.email_provider_events') is not null),
 ('table founder_notifications', to_regclass('public.founder_notifications') is not null),
 ('table lifecycle_read_only_config', to_regclass('public.lifecycle_read_only_config') is not null),
 ('fn has_gathering_capability', to_regprocedure('public.has_gathering_capability(uuid,text)') is not null),
 ('fn enforce_terminal_read_only', exists(select 1 from pg_proc where proname='enforce_terminal_read_only'))
) t(o,ok);
-- B. Baseline objects the package depends on (expect PRESENT)
select 'B' sec, o, case when ok then 'PRESENT' else 'MISSING' end st from (values
 ('fn effective_gathering_status', exists(select 1 from pg_proc where proname='effective_gathering_status')),
 ('fn enforce_archived_read_only', exists(select 1 from pg_proc where proname='enforce_archived_read_only')),
 ('table gathering_entitlements', to_regclass('public.gathering_entitlements') is not null),
 ('table entitlement_events', to_regclass('public.entitlement_events') is not null),
 ('table purchase_intents', to_regclass('public.purchase_intents') is not null),
 ('table gatherings', to_regclass('public.gatherings') is not null),
 ('table gathering_members', to_regclass('public.gathering_members') is not null),
 ('table invitation_parties', to_regclass('public.invitation_parties') is not null)
) t(o,ok);
-- C. (CORRECTED, follow-up J; REPORT_r-rehearsal D6) The shipped section C listed 14 names, of which only 3 exist on QA. Now two parts:
-- C1. Every function the package REPLACES on QA (24 of them: 2 from 207000, 1 from 202001, 16 from 202002, 2 from 205004, 3 from 217201) with QA's expected body fingerprint
--     (first 12 chars of md5(pg_get_functiondef), captured on the QA-faithful replica; the 5 whose text the rollbacks restore are asserted by the CORRECTED rollbacks).
--     status 'match' = the live QA function equals what the corrected rollbacks restore; 'DIFFERENT' = QA changed since the capture (stop and re-capture); 'absent' = not on this database.
select 'C1' sec, e.fn, coalesce(pg_get_function_identity_arguments(p.oid), '-') args, left(md5(pg_get_functiondef(p.oid)),12) body_md5_12, e.expected_md5_12,
       case when p.oid is null then 'absent' when left(md5(pg_get_functiondef(p.oid)),12) = e.expected_md5_12 then 'match' else 'DIFFERENT' end st
from (values
 ('activate_communication_plan', 'adc30fb48bec'),
 ('create_gathering_invitation', 'f840f1f4e6b8'),
 ('create_purchase_intent', '70ee79abce76'),
 ('current_plus_term', 'ec0283e2b58b'),
 ('delete_guest_update', '8a6530729ac5'),
 ('gathering_has_premium_entitlement', 'dd88a977fd78'),
 ('mark_my_paper_order_checkout_pending', '25e144a29b8d'),
 ('mark_my_paper_order_submitted', '82f5ec79559c'),
 ('people_remove_from_gathering', '595a3a16e7d7'),
 ('people_update_gathering_details', '85e2fc8d45af'),
 ('propose_communication_plan', 'efd2cdee699c'),
 ('publish_guest_update', 'c099f49a1906'),
 ('release_my_paper_order_fulfillment', 'bb017df75a77'),
 ('remove_invitation_artwork', '5fbeadd04b24'),
 ('save_invitation_artwork', '52c18c346e1b'),
 ('select_invitation_style', '6943257fb5d7'),
 ('send_gathering_invitation', '11d8693e9dd8'),
 ('send_guest_message', 'e392780accf3'),
 ('set_guest_page_content', '41bfdd2329f2'),
 ('set_guest_page_settings', '9b64d83e9155'),
 ('set_invitation_mode', '026b0a299dae'),
 ('set_invitation_status', '3051c862a5d7'),
 ('set_invitations_published', 'dde35d21456d'),
 ('set_rsvp_controls', '7ba905d688c8')
) e(fn, expected_md5_12)
left join pg_proc p on p.pronamespace='public'::regnamespace and p.proname=e.fn
order by e.fn;
-- C2. INFORMATIONAL ONLY: functions named by the shipped section C that the package CREATES (absent on QA before the apply is the expected result, not a defect).
select 'C2' sec, n.fn, case when exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=n.fn) then 'exists (informational)' else 'absent (expected: created by the package)' end st
from (values ('can_manage_invitations'), ('apply_payment_event'), ('apply_subscription_invoice'), ('guard_cohost_gathering_updates'), ('has_gathering_capability'), ('set_cohost_permission_level'), ('get_my_gathering_capabilities'), ('list_gathering_members_with_permissions'), ('normalize_entitlement_event_source'), ('staff_has_permission'), ('creator_referral_summary'), ('enforce_lock_in_rules'), ('create_gathering_invitation')) n(fn) order by n.fn;
-- D. Policies on tables the co-host/invitation steps rewrite (archive for rollback comparison)
select 'D' sec, schemaname, tablename, policyname, cmd, md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) policy_md5
from pg_policies where (schemaname='public' and tablename in ('gatherings','gathering_members','invitation_parties','invitation_designs','gathering_guests'))
   or (schemaname='storage' and tablename='objects') order by 2,3,4;
-- E. Ledger: row count and newest version (archive)
select 'E' sec, count(*) n, max(version) newest from supabase_migrations.schema_migrations;
-- F. Terminal gatherings that the enforced gate would freeze (user-visible impact count; no row data)
select 'F' sec, public.effective_gathering_status(g.id) st, count(*) n from public.gatherings g group by 2 order by 2;
