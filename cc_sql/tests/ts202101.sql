-- Agent G suite for 20261114202101 (guest_update_receipts read-only trigger fix). Scratch Postgres only; runs after harness.sql on the full chain (all 59 steps, 202101 last).
-- usage: bash tests/s2_sql/scripts/run_tf.sh <full_chain_db> out.txt cc_sql/tests/ts202101.sql
-- Proves: the 202100 defect (42703 on every receipt write) is gone; receipts INSERT/UPDATE work for ACTIVE gatherings and are refused gathering_read_only for completed
-- (window open and closed) and cancelled ones, through every real link (guest_updates / invitation_parties, old and new row); the 30-day photo window exception is for
-- gathering_photos only; kill switch / level / marker honoured; DELETE not blocked; the shared 202100 function is untouched.
create or replace function t.eq(p_label text, p_got boolean, p_want text) returns void language sql as $f$ select t.eq(p_label, p_got::text, p_want) $f$;
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
create or replace function t.mkg(p_owner uuid, p_status text, p_ends_delta interval default interval '0') returns uuid language plpgsql as $f$
declare g uuid := gen_random_uuid(); ts timestamp := (now() at time zone 'UTC') + p_ends_delta - interval '30 days';
begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time, timezone) values (g, p_owner, 'g-'||left(g::text,6), 'dinner', ts::date, ts::time, 'UTC');
  if p_status = 'cancelled' then perform set_config('placeandplenty.lifecycle_transition','cancel',true); end if;   -- canonical transition marker (gatherings status authority trigger)
  update public.gatherings set status = p_status::gathering_status where id = g;
  perform set_config('placeandplenty.lifecycle_transition','',true);
  return g;
end $f$;
create or replace function t.mkga(p_owner uuid) returns uuid language plpgsql as $f$   -- a future, ACTIVE gathering
declare g uuid := gen_random_uuid();
begin
  insert into public.gatherings(id, owner_user_id, name, gathering_type, gathering_date, arrival_time, timezone) values (g, p_owner, 'ga-'||left(g::text,6), 'dinner', current_date+10, '18:00', 'UTC');
  update public.gatherings set status='active' where id=g;
  return g;
end $f$;
create or replace function t.ro(p_res text) returns boolean language sql immutable as $f$ select p_res = 'ERR P0001:gathering_read_only' $f$;


create or replace function t.xdetail(p_sql text) returns text language plpgsql as $f$
declare d text := 'none';
begin
  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  begin execute p_sql; raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm = 'T_ROLLBACK' then d := 'no_error'; else get stacked diagnostics d = pg_exception_detail; end if;
  end;
  perform set_config('request.jwt.claims','',true);
  return d;
end $f$;
do $$
declare o uuid := t.mkuser(); gs jsonb; nm text; res text; i int;
        g uuid; u uuid; p uuid; seedu text; oC29 uuid; oC31 uuid; oX uuid; ow jsonb; ph text := 'insert into public.gathering_photos(gathering_id,storage_path,uploaded_by_user_id,expires_at) values (%L,%L,%L,now()+interval ''1 day'')';
        gA uuid; gC29 uuid; gC31 uuid; gX uuid; ids jsonb := '{}'::jsonb; ups jsonb := '{}'::jsonb; pts jsonb := '{}'::jsonb; pA2 uuid; nmx text;
begin
  oC29 := t.mkuser(); oC31 := t.mkuser(); oX := t.mkuser();   -- one owner per gathering (free-tier open-gathering limit)
  gA := t.mkga(o); gC29 := t.mkg(oC29,'active', interval '1 day'); gC31 := t.mkg(oC31,'active', interval '-1 day'); gX := t.mkg(oX,'cancelled');
  ids := jsonb_build_object('A',gA,'C29',gC29,'C31',gC31,'X',gX); ow := jsonb_build_object('A',o,'C29',oC29,'C31',oC31,'X',oX);
  perform t.eq('G0.1 effective statuses: active / completed (photo window open, event 29d ago) / completed (window closed, event 31d ago) / cancelled',
    public.effective_gathering_status(gA)::text||'/'||public.effective_gathering_status(gC29)::text||'/'||public.effective_gathering_status(gC31)::text||'/'||public.effective_gathering_status(gX)::text, 'active/completed/completed/cancelled');
  perform t.eq('G0.2 202101 objects: the strict trigger on guest_update_receipts uses the dedicated function', (select p.proname from pg_trigger tg join pg_proc p on p.oid=tg.tgfoid where tg.tgrelid='public.guest_update_receipts'::regclass and tg.tgname='trg_terminal_read_only_strict' and not tg.tgisinternal), 'enforce_terminal_read_only_receipts');
  perform t.eq('G0.3 guest_update_receipts has no gathering_id column (the root cause of the 202100 defect) but links to guest_updates and invitation_parties', (select count(*) from information_schema.columns where table_schema='public' and table_name='guest_update_receipts' and column_name='gathering_id')::text||'/'||(select count(*) from pg_constraint where conrelid='public.guest_update_receipts'::regclass and contype='f' and confrelid in ('public.guest_updates'::regclass,'public.invitation_parties'::regclass))::text, '0/2');
  perform t.eq('G0.4 shared 202100 function untouched by 202101 (class photos logic present, no receipts logic)', (select (position('v_class = ''photos''' in pg_get_functiondef('public.enforce_terminal_read_only()'::regprocedure))>0 and pg_get_functiondef('public.enforce_terminal_read_only()'::regprocedure) !~ 'guest_updates')::text), 'true');
  perform t.eq('G0.5 every OTHER 202100 trigger still uses the shared function (only the receipts trigger differs)', (select (count(*) filter (where p.proname='enforce_terminal_read_only') = count(*) - 1 and count(*) filter (where c.relname='guest_update_receipts' and p.proname='enforce_terminal_read_only_receipts') = 1)::text from pg_trigger tg join pg_proc p on p.oid=tg.tgfoid join pg_class c on c.oid=tg.tgrelid where tg.tgname in ('trg_terminal_read_only','trg_terminal_read_only_strict') and not tg.tgisinternal), 'true');
  -- seed: per gathering one guest update + one invitation party (superuser, no claims => auth.uid() null; the non-strict triggers pass); a second party on the active gathering
  for nm in select jsonb_object_keys(ids) loop
    g := (ids->>nm)::uuid;
    insert into public.guest_updates(gathering_id, author_user_id, title, body) values (g, o, 'u-'||nm, 'b') returning id into u;
    insert into public.invitation_parties(gathering_id, party_name) values (g, 'p-'||nm) returning id into p;
    ups := ups || jsonb_build_object(nm,u); pts := pts || jsonb_build_object(nm,p);
  end loop;
  insert into public.invitation_parties(gathering_id, party_name) values (gA,'p-A2') returning id into pA2;
  -- seeded receipt per gathering (terminal ones inserted under the canonical transition marker, as a pre-completion receipt would have been)
  perform set_config('placeandplenty.lifecycle_transition','seed',true);
  for nm in select jsonb_object_keys(ids) loop
    insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values ((ups->>nm)::uuid, (pts->>nm)::uuid);
  end loop;
  perform set_config('placeandplenty.lifecycle_transition','',true);
  perform t.eq('G0.6 seeded: 4 receipts (one per gathering)', (select count(*) from public.guest_update_receipts where guest_update_id in (select (value#>>'{}')::uuid from jsonb_each(ups)))::text, '4');

  -- ===== ACTIVE gathering: writes work (this was 42703 under 202100 alone) =====
  perform t.eq('G1.1 active: service-role (edge function) INSERT of a new receipt (second party) works', t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (%L,%L)', ups->>'A', pA2)), 'OK:1');
  perform t.eq('G1.2 active: service-role UPDATE (acknowledge) works', t.tryn(null,'service_role',format('update public.guest_update_receipts set acknowledged_at=now() where guest_update_id=%L and invitation_party_id=%L', ups->>'A', pts->>'A')), 'OK:1');
  perform t.eq('G1.3 active: guest-update-acknowledge upsert (ON CONFLICT DO UPDATE) works, existing and new row', t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id, seen_at, acknowledged_at) values (%L,%L,now(),now()) on conflict (guest_update_id, invitation_party_id) do update set acknowledged_at=excluded.acknowledged_at', ups->>'A', pts->>'A'))||'/'||t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id, seen_at, acknowledged_at) values (%L,%L,now(),now()) on conflict (guest_update_id, invitation_party_id) do update set acknowledged_at=excluded.acknowledged_at', ups->>'A', pA2)), 'OK:1/OK:1');
  perform t.eq('G1.4 active: guest-living-page-lookup upsert (ON CONFLICT DO NOTHING) works', t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id, seen_at) values (%L,%L,now()) on conflict (guest_update_id, invitation_party_id) do nothing', ups->>'A', pts->>'A')), 'OK:0');
  perform t.eq('G1.5 active: INSERT and UPDATE by a signed-in owner identity (DB level) work', t.tryn(o,null,format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (%L,%L)', ups->>'A', pA2))||'/'||t.tryn(o,null,format('update public.guest_update_receipts set acknowledged_at=now() where guest_update_id=%L', ups->>'A')), 'OK:1/OK:1');
  perform t.eq('G1.6 active: real role switch service_role INSERT/UPDATE (privileges + trigger)', t.tryr(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (%L,%L)', ups->>'A', pA2))||'/'||t.tryr(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L and invitation_party_id=%L', ups->>'A', pts->>'A')), 'OK:1/OK:1');
  perform t.eq('G1.7 random uuids: no 42703 any more - the foreign key answers (23503), not the trigger', left(t.tryn(null,'service_role','insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (gen_random_uuid(), gen_random_uuid())'),9), 'ERR 23503');

  -- ===== COMPLETED (window open and closed) and CANCELLED: INSERT + UPDATE refused for every identity and every link; DELETE is not a write the guard blocks =====
  foreach nm in array array['C29','C31','X'] loop
    g := (ids->>nm)::uuid; u := (ups->>nm)::uuid; p := (pts->>nm)::uuid;
    perform t.eq('G2.'||nm||'.a service-role INSERT (new receipt for a fresh party) refused gathering_read_only', t.ro(t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) select %L, id from public.invitation_parties where gathering_id=%L', u, g)))::text, 'true');
    perform t.eq('G2.'||nm||'.b service-role UPDATE (acknowledge) refused gathering_read_only', t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set acknowledged_at=now() where guest_update_id=%L and invitation_party_id=%L', u, p)))::text, 'true');
    perform t.eq('G2.'||nm||'.c guest-update-acknowledge upsert refused', t.ro(t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id, seen_at, acknowledged_at) values (%L,%L,now(),now()) on conflict (guest_update_id, invitation_party_id) do update set acknowledged_at=excluded.acknowledged_at', u, p)))::text, 'true');
    perform t.eq('G2.'||nm||'.d guest-living-page-lookup ON CONFLICT DO NOTHING upsert refused (the edge function ignores that error: no new seen receipt after completion)', t.ro(t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id, seen_at) values (%L,%L,now()) on conflict (guest_update_id, invitation_party_id) do nothing', u, p)))::text, 'true');
    perform t.eq('G2.'||nm||'.e signed-in owner identity INSERT/UPDATE refused', t.ro(t.tryn((ow->>nm)::uuid,null,format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) select %L, id from public.invitation_parties where gathering_id=%L', u, g)))::text||'/'||t.ro(t.tryn((ow->>nm)::uuid,null,format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', u)))::text, 'true/true');
    perform t.eq('G2.'||nm||'.f real role switch service_role UPDATE refused', t.ro(t.tryr(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', u)))::text, 'true');
    perform t.eq('G2.'||nm||'.h DELETE of a receipt is not blocked (retention purge / account deletion path; guard is insert/update only)', t.tryn(null,'service_role',format('delete from public.guest_update_receipts where guest_update_id=%L', u))||'/'||t.tryn((ow->>nm)::uuid,null,format('delete from public.guest_update_receipts where guest_update_id=%L', u)), 'OK:1/OK:1');
  end loop;
  -- the same refusals carry the right detail
  perform t.eq('G2.9 refusal detail carries the status: completed => completed, cancelled => cancelled', t.xdetail(format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'C31'))||','||t.xdetail(format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'X')), 'completed,cancelled');
  perform t.eq('G2.10 completed inside the 30-day photo window is STILL refused for receipts (the window exception is gathering_photos only)', t.ro(t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (%L,%L) on conflict (guest_update_id, invitation_party_id) do update set seen_at=now()', ups->>'C29', pts->>'C29')))::text||'/'||t.tryn(oC29,null,format(ph, gC29, gC29||'/p.jpg', oC29))||'/'||t.ro(t.tryn(oC31,null,format(ph, gC31, gC31||'/p.jpg', oC31)))::text, 'true/OK:1/true');

  -- ===== cross links: the gathering is derived from BOTH relationships, old and new row =====
  perform t.eq('G3.1 receipt whose update is on an ACTIVE gathering but whose party is on a COMPLETED one: refused', t.ro(t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (%L,%L)', ups->>'A', pts->>'C31')))::text, 'true');
  perform t.eq('G3.2 receipt whose party is on an ACTIVE gathering but whose update is on a CANCELLED one: refused', t.ro(t.tryn(null,'service_role',format('insert into public.guest_update_receipts(guest_update_id, invitation_party_id) values (%L,%L)', ups->>'X', pts->>'A')))::text, 'true');
  perform t.eq('G3.3 UPDATE cannot move an active receipt onto a completed gathering (new row)', t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set invitation_party_id=%L where guest_update_id=%L and invitation_party_id=%L', pts->>'C29', ups->>'A', pts->>'A')))::text, 'true');
  perform t.eq('G3.4 UPDATE cannot move a completed gathering''s receipt back onto an active one (old row)', t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set guest_update_id=%L, invitation_party_id=%L where guest_update_id=%L', ups->>'A', pA2, ups->>'C31')))::text, 'true');

  -- ===== switches (same as 202100): kill switch, level, canonical transition marker =====
  update public.lifecycle_read_only_config set enforcement='off' where id;
  perform t.eq('G4.1 kill switch off: completed and cancelled receipts writable again (prior behaviour)', t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'C31'))||'/'||t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'X')), 'OK:1/OK:1');
  update public.lifecycle_read_only_config set enforcement='cancelled' where id;
  perform t.eq('G4.2 level cancelled: completed allowed, cancelled refused', t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'C31'))||'/'||t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'X')))::text, 'OK:1/true');
  update public.lifecycle_read_only_config set enforcement='terminal' where id;
  perform t.eq('G4.3 level terminal again: both refused', t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'C31')))::text||'/'||t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'X')))::text, 'true/true');
  perform set_config('placeandplenty.lifecycle_transition','complete',true);
  perform t.eq('G4.4 canonical lifecycle-transition marker bypasses (cancel/complete/archive flows)', t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'X')), 'OK:1');
  perform set_config('placeandplenty.lifecycle_transition','',true);
  perform t.eq('G4.5 marker cleared: refused again', t.ro(t.tryn(null,'service_role',format('update public.guest_update_receipts set seen_at=now() where guest_update_id=%L', ups->>'X')))::text, 'true');
  perform t.eq('G4.6 enforcement config restored to the default (terminal)', (select enforcement from public.lifecycle_read_only_config where id), 'terminal');
end $$;

select t.report();
