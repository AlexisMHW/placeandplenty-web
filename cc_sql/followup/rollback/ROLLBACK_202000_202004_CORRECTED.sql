-- ROLLBACK_202000_202004_CORRECTED.sql  (follow-up J; replaces ROLLBACK_202000_202004.sql for a QA-faithful database. PROPOSED, NOT APPLIED; contains DROP)
-- Fixes found by the QA-faithful rehearsal (REPORT_r-rehearsal D1, D2, D4):
--   D1  step 4 (202001) replaces the WHOLE body of create_gathering_invitation (it adds the production read-only guard), so removing one line can never restore QA's own body. This file
--       re-creates QA's captured body verbatim (md5 of pg_get_functiondef, first 12 chars: f840f1f4e6b8) and aborts if the result differs.
--   D2  the final "new-style policies" check also counted QA's own pre-existing policy guest_update_receipts_member_select. Only policies THIS package created are counted now.
--   D4  cohost_gathering_column_capability(text) (created by 202002) was left behind; it is dropped.
-- Everything else is the shipped rollback, unchanged. Same behaviour on a database whose create_gathering_invitation already equals QA's body.
-- Restores the QA pre-state captured READ-ONLY on 2026-11-13 (gpzlytukyvshrrxrmooo, before any of 202000-202004).
-- One atomic DO block: any failed assertion aborts everything and leaves the post-apply state untouched.
-- LOSSY by design: assigned permission levels (planner/manager) and cohost_permission_audit rows are discarded. After rollback every
--   accepted co-host is owner-equivalent again, exactly as before. Do not roll back once real co-hosts have been given restricted levels
--   unless that loss is accepted.
-- Does NOT undo INV-207000 (separate package, separate rollback). If invitation_artwork_cleanup_allowed exists (207000 applied),
--   can_manage_invitations is restored to 207000's member-check body; otherwise it is dropped (it did not exist before).
-- Function-body reversal is programmatic: public.has_gathering_capability(<arg>, '<cap>') -> the member check form captured before
--   (qualified "public.is_accepted_gathering_member(arg)" or unqualified, per function), then the md5 of pg_get_functiondef is compared with
--   the captured pre-state md5. Mismatch = abort.
do $rb$
declare
  r record; v_def text; v_new text; n int; v_cnt int; v_got text; v_207 boolean;
  -- fn, member-check argument, qualified?, captured pre-state md5 (first 12 chars of md5(pg_get_functiondef))
  -- EXPECTED_MD5_BEGIN
  v_fns text[][] := array[
    ['activate_communication_plan','p_gathering_id','u','adc30fb48bec'],
    ['create_purchase_intent','p_gathering_id','q','70ee79abce76'],
    ['delete_guest_update','v_gathering_id','q','8a6530729ac5'],
    ['people_remove_from_gathering','p_gathering_id','q','595a3a16e7d7'],
    ['people_update_gathering_details','p_gathering_id','q','85e2fc8d45af'],
    ['propose_communication_plan','p_gathering_id','u','efd2cdee699c'],
    ['publish_guest_update','p_gathering_id','q','c099f49a1906'],
    ['select_invitation_style','p_gathering_id','u','6943257fb5d7'],
    ['send_gathering_invitation','p_gathering_id','u','11d8693e9dd8'],
    ['send_guest_message','p_gathering_id','u','e392780accf3'],
    ['set_guest_page_content','p_gathering_id','q','41bfdd2329f2'],
    ['set_guest_page_settings','p_gathering_id','u','9b64d83e9155'],
    ['set_invitation_mode','p_gathering_id','u','026b0a299dae'],
    ['set_invitation_status','p_gathering_id','u','3051c862a5d7'],
    ['set_invitations_published','p_gathering_id','q','dde35d21456d'],
    ['set_rsvp_controls','p_gathering_id','q','7ba905d688c8']];
  v_cgi_md5 text := 'f840f1f4e6b8';  -- create_gathering_invitation
  -- EXPECTED_MD5_END
  t text;
begin
  -- 0. refuse to run on a database that is not in the expected post-apply state
  if to_regprocedure('public.has_gathering_capability(uuid,text)') is null then raise exception 'rollback precondition: has_gathering_capability missing (202001 not applied?)'; end if;
  v_207 := to_regprocedure('public.invitation_artwork_cleanup_allowed(uuid,text)') is not null;

  -- 1. storage policies: remove 202004's, restore the four originals exactly as captured
  execute 'drop policy if exists "Authenticated members view invitation artwork" on storage.objects';
  execute 'drop policy if exists "Permitted hosts upload invitation artwork while open" on storage.objects';
  execute 'drop policy if exists "Permitted hosts replace invitation artwork while open" on storage.objects';
  execute 'drop policy if exists "Permitted hosts remove unreferenced invitation artwork while op" on storage.objects';
  execute 'drop policy if exists "Permitted hosts remove unreferenced invitation artwork while open" on storage.objects';
  execute $p$create policy "Owner/accepted co-host can upload invitation artwork" on storage.objects for insert with check (((bucket_id = 'invitation-artwork'::text) AND is_accepted_gathering_member(((storage.foldername(name))[1])::uuid)))$p$;
  execute $p$create policy "Owner/accepted co-host can replace invitation artwork" on storage.objects for update using (((bucket_id = 'invitation-artwork'::text) AND is_accepted_gathering_member(((storage.foldername(name))[1])::uuid)))$p$;
  execute $p$create policy "Owner/accepted co-host can remove invitation artwork" on storage.objects for delete using (((bucket_id = 'invitation-artwork'::text) AND is_accepted_gathering_member(((storage.foldername(name))[1])::uuid)))$p$;
  execute $p$create policy "Owner/accepted co-host can view their own invitation artwork" on storage.objects for select using (((bucket_id = 'invitation-artwork'::text) AND is_accepted_gathering_member(((storage.foldername(name))[1])::uuid)))$p$;

  -- 2. public-table policies (202003) -> originals
  for r in select * from (values
    ('invitation_parties','Members manage invitation parties on gatherings they belong to'),
    ('gathering_expenses','Members manage expenses'),
    ('gathering_expense_receipts','Members manage expense receipts'),
    ('gathering_guest_page','Members manage the guest page on gatherings they belong to'),
    ('gathering_registry_links','Members manage registry links'),
    ('communication_events','Members manage communication events on gatherings they belong t')) as x(tbl,pol)
  loop
    foreach t in array array['_member_select','_cap_insert','_cap_update','_cap_delete'] loop
      execute format('drop policy if exists %I on public.%I', r.tbl||t, r.tbl); end loop;
    execute format('create policy %I on public.%I for all using (is_accepted_gathering_member(gathering_id)) with check (is_accepted_gathering_member(gathering_id))', r.pol, r.tbl);
  end loop;
  foreach t in array array['gathering_guests_member_select','gathering_guests_cap_insert','gathering_guests_cap_update','gathering_guests_cap_delete'] loop
    execute format('drop policy if exists %I on public.gathering_guests', t); end loop;
  execute $p$create policy "Members manage guest assignments on gatherings they belong to" on public.gathering_guests for all using (is_accepted_gathering_member(gathering_id)) with check ((is_accepted_gathering_member(gathering_id) AND guest_belongs_to_gathering_owner(guest_id, gathering_id)))$p$;
  foreach t in array array['gathering_expense_items_member_select','gathering_expense_items_cap_insert','gathering_expense_items_cap_update','gathering_expense_items_cap_delete'] loop
    execute format('drop policy if exists %I on public.gathering_expense_items', t); end loop;
  execute $p$create policy "Members manage expense item links" on public.gathering_expense_items for all
    using ((EXISTS ( SELECT 1 FROM gathering_expenses e WHERE ((e.id = gathering_expense_items.expense_id) AND is_accepted_gathering_member(e.gathering_id)))))
    with check ((EXISTS ( SELECT 1 FROM gathering_expenses e WHERE ((e.id = gathering_expense_items.expense_id) AND is_accepted_gathering_member(e.gathering_id)))))$p$;
  execute 'drop policy if exists guest_updates_member_insert on public.guest_updates';
  execute 'drop policy if exists guest_updates_member_update on public.guest_updates';
  execute 'drop policy if exists guest_updates_member_delete on public.guest_updates';
  execute $p$create policy guest_updates_member_insert on public.guest_updates for insert to authenticated with check ((is_accepted_gathering_member(gathering_id) AND (author_user_id = auth.uid()) AND (effective_gathering_status(gathering_id) <> 'archived'::gathering_status)))$p$;
  execute $p$create policy guest_updates_member_update on public.guest_updates for update to authenticated using (is_accepted_gathering_member(gathering_id)) with check ((is_accepted_gathering_member(gathering_id) AND (effective_gathering_status(gathering_id) <> 'archived'::gathering_status)))$p$;
  execute $p$create policy guest_updates_member_delete on public.guest_updates for delete to authenticated using ((is_accepted_gathering_member(gathering_id) AND (effective_gathering_status(gathering_id) <> 'archived'::gathering_status)))$p$;
  execute 'drop policy if exists guest_update_audience_member_select on public.guest_update_audience_parties';
  execute 'drop policy if exists guest_update_audience_cap_write on public.guest_update_audience_parties';
  execute $p$create policy guest_update_audience_member_all on public.guest_update_audience_parties for all to authenticated
    using ((EXISTS ( SELECT 1 FROM guest_updates u WHERE ((u.id = guest_update_audience_parties.guest_update_id) AND is_accepted_gathering_member(u.gathering_id)))))
    with check ((EXISTS ( SELECT 1 FROM (guest_updates u JOIN invitation_parties p ON ((p.id = guest_update_audience_parties.invitation_party_id))) WHERE ((u.id = guest_update_audience_parties.guest_update_id) AND (p.gathering_id = u.gathering_id) AND is_accepted_gathering_member(u.gathering_id) AND (effective_gathering_status(u.gathering_id) <> 'archived'::gathering_status)))))$p$;

  -- 3. gatherings column guard (202002)
  execute 'drop trigger if exists trg_guard_cohost_gathering_updates on public.gatherings';
  execute 'drop function if exists public.guard_cohost_gathering_updates()';

  -- 4. RPC bodies back to the member check, then verify against captured md5
  for i in 1 .. array_length(v_fns,1) loop
    select p.oid into strict r from pg_proc p where p.pronamespace='public'::regnamespace and p.proname = v_fns[i][1];
    v_def := pg_get_functiondef(r.oid);
    select count(*) into n from regexp_matches(v_def, 'public\.has_gathering_capability\(' || v_fns[i][2] || ', ''[a-z_]+''\)', 'g');
    if n = 0 and position('has_gathering_capability' in v_def) = 0 then null;  -- already pre-state (idempotent)
    elsif n <> 1 then raise exception 'rollback: expected one capability check in %, found %', v_fns[i][1], n;
    else
      v_new := regexp_replace(v_def, 'public\.has_gathering_capability\(' || v_fns[i][2] || ', ''[a-z_]+''\)',
                 case v_fns[i][3] when 'q' then 'public.is_accepted_gathering_member(' else 'is_accepted_gathering_member(' end || v_fns[i][2] || ')');
      execute v_new;
    end if;
    select left(md5(pg_get_functiondef(p.oid)),12) into v_got from pg_proc p where p.pronamespace='public'::regnamespace and p.proname = v_fns[i][1];
    if v_got <> v_fns[i][4] then raise exception 'rollback: % md5 % <> captured pre-state %', v_fns[i][1], v_got, v_fns[i][4]; end if;
  end loop;
  -- create_gathering_invitation: 202001 replaced the whole body, so restore QA's captured body verbatim (CORRECTED, D1), then verify its md5.
  execute $qa_body$CREATE OR REPLACE FUNCTION public.create_gathering_invitation(p_gathering_id uuid, p_invited_email citext)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_raw_token text;
begin
  if not is_gathering_owner(p_gathering_id) then
    raise exception 'not authorized';
  end if;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'base64');

  insert into gathering_members (gathering_id, invited_email, invited_by, status, acceptance_token_hash, acceptance_token_issued_at)
  values (p_gathering_id, p_invited_email, auth.uid(), 'invited', extensions.digest(v_raw_token, 'sha256'), now())
  on conflict (gathering_id, invited_email) do update set
    status = 'invited',
    invited_by = auth.uid(),
    invited_at = now(),
    accepted_at = null,
    removed_at = null,
    user_id = null,
    acceptance_token_hash = extensions.digest(v_raw_token, 'sha256'),
    acceptance_token_issued_at = now();

  return v_raw_token;
end;
$function$
;$qa_body$;
  select left(md5(pg_get_functiondef(p.oid)),12) into v_got from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='create_gathering_invitation';
  if v_got <> v_cgi_md5 then raise exception 'rollback: create_gathering_invitation md5 % <> captured %', v_got, v_cgi_md5; end if;

  -- 5. can_manage_invitations
  if v_207 then
    execute $f$create or replace function public.can_manage_invitations(p_gathering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $b$
  select coalesce(public.is_accepted_gathering_member(p_gathering_id), false);
$b$$f$;
  else
    execute 'drop function if exists public.can_manage_invitations(uuid)';
  end if;

  -- 6. new objects (policies and RPC callers are gone, so no dependants remain)
  execute 'drop function if exists public.list_gathering_members_with_permissions(uuid)';
  execute 'drop function if exists public.get_my_gathering_capabilities(uuid)';
  execute 'drop function if exists public.set_cohost_permission_level(uuid, text)';
  execute 'drop function if exists public.has_gathering_capability(uuid, text)';
  execute 'drop function if exists public.cohost_gathering_column_capability(text)';  -- CORRECTED (D4): created by 202002, was left behind
  execute 'drop trigger if exists trg_log_gathering_member_permission_change on public.gathering_members';
  execute 'drop trigger if exists trg_guard_gathering_member_permission_level on public.gathering_members';
  execute 'drop trigger if exists trg_cohost_permission_audit_immutable on public.cohost_permission_audit';
  execute 'drop function if exists public.log_gathering_member_permission_change()';
  execute 'drop function if exists public.guard_gathering_member_permission_level()';
  execute 'drop function if exists public.cohost_permission_audit_immutable()';
  execute 'drop table if exists public.cohost_permission_audit';
  execute 'alter table public.gathering_members drop column if exists permission_level';
  execute 'drop table if exists public.cohost_level_capabilities';
  execute 'drop table if exists public.cohost_permission_levels';

  -- 7. final assertions
  select count(*) into v_cnt from pg_proc where pronamespace='public'::regnamespace and proname in ('has_gathering_capability','get_my_gathering_capabilities','list_gathering_members_with_permissions','set_cohost_permission_level','guard_cohost_gathering_updates','cohost_gathering_column_capability','guard_gathering_member_permission_level','log_gathering_member_permission_change','cohost_permission_audit_immutable');
  if v_cnt <> 0 then raise exception 'rollback: % new functions remain', v_cnt; end if;
  select count(*) into v_cnt from pg_class where relnamespace='public'::regnamespace and relname like 'cohost\_%';
  if v_cnt <> 0 then raise exception 'rollback: % cohost tables remain', v_cnt; end if;
  select count(*) into v_cnt from information_schema.columns where table_schema='public' and table_name='gathering_members' and column_name='permission_level';
  if v_cnt <> 0 then raise exception 'rollback: permission_level remains'; end if;
  select count(*) into v_cnt from pg_policies where (schemaname='public' and policyname in ('Members manage invitation parties on gatherings they belong to','Members manage expenses','Members manage expense receipts','Members manage the guest page on gatherings they belong to','Members manage registry links','Members manage communication events on gatherings they belong t','Members manage guest assignments on gatherings they belong to','Members manage expense item links','guest_updates_member_insert','guest_updates_member_update','guest_updates_member_delete','guest_update_audience_member_all'))
     or (schemaname='storage' and policyname like 'Owner/accepted co-host can % invitation artwork');
  if v_cnt <> 16 then raise exception 'rollback: expected 16 restored policies, found %', v_cnt; end if;
  -- CORRECTED (D2): only policies this package created are counted; guest_updates_member_select and guest_update_receipts_member_select exist on QA before it.
  select count(*) into v_cnt from pg_policies where (policyname ~ '_(member_select|cap_insert|cap_update|cap_delete)$' and policyname not in ('guest_updates_member_select','guest_update_receipts_member_select')) or policyname ~ '^(Authenticated members view|Permitted hosts)' or policyname in ('guest_update_audience_member_select','guest_update_audience_cap_write');
  if v_cnt <> 0 then raise exception 'rollback: % new-style policies remain', v_cnt; end if;
end $rb$;
