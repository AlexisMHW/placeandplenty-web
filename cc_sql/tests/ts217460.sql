-- Agent S2 suite for 217460 (SMS fail-closed). Scratch Postgres only; runs after harness.sql on the full chain. SMS is never enabled permanently: every scenario rolls back.
-- usage: bash tests/s2_sql/scripts/run_tf.sh <full_chain_db> out.txt cc_sql/tests/ts217460.sql
-- t.scen(setup, probe): runs setup (any SQL, as superuser), then probe as a service_role call returning text, then ROLLS EVERYTHING BACK; returns the probe text or 'ERR sqlstate:msg'.
create or replace function t.scen(p_setup text, p_probe text, p_role text default 'service_role') returns text language plpgsql as $f$
declare v text;
begin
  begin
    if p_setup is not null then execute p_setup; end if;
    perform set_config('request.jwt.claims', case when p_role is null then '' else json_build_object('role',p_role)::text end, true);
    begin execute 'select ('||p_probe||')::text' into v; exception when others then v := 'ERR '||sqlstate||':'||sqlerrm; end;
    perform set_config('request.jwt.claims','',true);
    raise exception 'T_RB';
  exception when others then
    if sqlerrm <> 'T_RB' then v := 'SETUP_ERR '||sqlstate||':'||sqlerrm; end if;
  end;
  return coalesce(v,'NULL');
end $f$;
-- messages: insert one row with a given status (superuser, claims as service_role) -> 'OK' or ERR
create or replace function t.smsins(p_status text, p_hash text default 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') returns text language plpgsql as $f$
begin
  insert into public.sms_messages(gathering_id,sender_user_id,phone_hash,phone_last4,template_kind,template_version,body,encoding,segments,idempotency_key,status)
  values (gen_random_uuid(),gen_random_uuid(),p_hash,'0000','invitation','v1','x','GSM-7',1,gen_random_uuid()::text,p_status);
  return 'OK';
exception when others then return 'ERR '||sqlstate||':'||sqlerrm;
end $f$;
create or replace function t.smsupd(p_to text) returns text language plpgsql as $f$ declare n int; begin update public.sms_messages set status=p_to; get diagnostics n = row_count; return n::text; end $f$;
create or replace function t.sms_on() returns void language sql as $f$ update public.sms_config set value='true'::jsonb where key='sms_enabled'; update public.sms_config set value='false'::jsonb where key='kill_switch' $f$;
create or replace function t.sms_fn(p_body text) returns void language plpgsql as $f$ begin execute 'create or replace function public.sms_is_suppressed(p_phone_hash text) returns boolean language plpgsql as $b$ begin '||p_body||' end $b$'; end $f$;
do $$ begin perform t.eq('Z0.1 shipped defaults untouched: sms_enabled=false, kill_switch=true', (select string_agg(key||'='||(value#>>'{}'),',' order by key) from public.sms_config where key in ('sms_enabled','kill_switch')), 'kill_switch=true,sms_enabled=false'); end $$;
do $$ begin perform t.eq('Z0.2 in this chain sms_is_suppressed does not exist (SMS functions are proposed-only)', (to_regprocedure('public.sms_is_suppressed(text)') is null)::text, 'true'); end $$;
-- (a) suppression function missing => suppressed
do $$ begin
 perform t.eq('Za.1 (a) sms_is_suppressed missing: is_contact_suppressed(sms) = true (was false = fail-open)', t.scen(null,$q$public.is_contact_suppressed('sms','h1')$q$), 'true');
 perform t.eq('Za.2 (a) after explicit DROP FUNCTION sms_is_suppressed: still true', t.scen($s$select t.sms_fn('return false;'); drop function public.sms_is_suppressed(text)$s$,$q$public.is_contact_suppressed('sms','h1')$q$), 'true');
-- (b) raising / NULL => suppressed; healthy => honest answer
 perform t.eq('Zb.1 (b) sms_is_suppressed raises: true', t.scen($s$select t.sms_fn($b$raise exception 'boom';$b$)$s$,$q$public.is_contact_suppressed('sms','h1')$q$), 'true');
 perform t.eq('Zb.2 (b) sms_is_suppressed returns NULL: true', t.scen($s$select t.sms_fn('return null;')$s$,$q$public.is_contact_suppressed('sms','h1')$q$), 'true');
 perform t.eq('Zb.3 healthy function returning false: false (provably not suppressed)', t.scen($s$select t.sms_fn('return false;')$s$,$q$public.is_contact_suppressed('sms','h1')$q$), 'false');
 perform t.eq('Zb.4 healthy function returning true: true', t.scen($s$select t.sms_fn('return true;')$s$,$q$public.is_contact_suppressed('sms','h1')$q$), 'true');
 perform t.eq('Zb.5 NULL hash: true (unevaluable)', t.scen($s$select t.sms_fn('return false;')$s$,$q$public.is_contact_suppressed('sms',null)$q$), 'true');
-- (c) email unchanged
 perform t.eq('Zc.1 (c) email: unsuppressed hash -> false (same as email_is_suppressed)', t.scen(null,$q$public.is_contact_suppressed('email',repeat('b',64))$q$), 'false');
 perform t.eq('Zc.2 (c) email: suppressed hash -> true', t.scen($s$insert into public.email_suppressions(address_hash,state,reason) values (repeat('c',64),'suppressed','hard_bounce')$s$,$q$public.is_contact_suppressed('email',repeat('c',64))$q$), 'true');
 perform t.eq('Zc.3 (c) email result equals email_is_suppressed for both', t.scen($s$insert into public.email_suppressions(address_hash,state,reason) values (repeat('c',64),'suppressed','hard_bounce')$s$,$q$(public.is_contact_suppressed('email',repeat('c',64)) = public.email_is_suppressed(repeat('c',64)))and(public.is_contact_suppressed('email',repeat('d',64)) = public.email_is_suppressed(repeat('d',64)))$q$), 'true');
 perform t.eq('Zc.4 unknown channel still invalid_channel', t.scen(null,$q$public.is_contact_suppressed('fax','h')$q$), 'ERR P0001:invalid_channel');
 perform t.eq('Zc.5 non service_role still not_authorized', t.scen(null,$q$public.is_contact_suppressed('sms','h')$q$,'authenticated'), 'ERR P0001:not_authorized');
 perform t.eq('Zc.6 helpers are not callable by API roles', (has_function_privilege('authenticated','public.sms_config_allows_delivery()','execute') or has_function_privilege('anon','public.sms_suppressed_failclosed(text)','execute') or has_function_privilege('authenticated','public.sms_messages_fail_closed()','execute'))::text, 'false');
end $$;
-- config gate
do $$ begin
 perform t.eq('Zd.1 defaults => sms_config_allows_delivery false', t.scen(null,'public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.2 enabled=true kill_switch=false => true (only combination that opens it; rolled back)', t.scen('select t.sms_on()','public.sms_config_allows_delivery()'), 'true');
 perform t.eq('Zd.3 enabled=true kill_switch=true => false', t.scen($s$update public.sms_config set value='true'::jsonb where key='sms_enabled'$s$,'public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.4 enabled=false kill_switch=false => false', t.scen($s$update public.sms_config set value='false'::jsonb where key='kill_switch'$s$,'public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.5 (d) sms_config rows deleted => false', t.scen('select t.sms_on(); delete from public.sms_config','public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.6 only kill_switch row deleted (enabled=true) => false (missing kill switch = ON)', t.scen($s$select t.sms_on(); delete from public.sms_config where key='kill_switch'$s$,'public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.7 only sms_enabled row deleted => false', t.scen($s$select t.sms_on(); delete from public.sms_config where key='sms_enabled'$s$,'public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.8 unparseable value => false, no exception', t.scen($s$select t.sms_on(); update public.sms_config set value='"maybe"'::jsonb where key='sms_enabled'$s$,'public.sms_config_allows_delivery()'), 'false');
 perform t.eq('Zd.9 sms_config table dropped => false, no exception', t.scen($s$select t.sms_on(); alter table public.sms_config rename to sms_config_x$s$,'public.sms_config_allows_delivery()'), 'false');
end $$;
-- (d)(e) enqueue / claim guard on sms_messages
do $$ declare ins_q text; begin
 perform t.eq('Ze.1 (e) defaults: INSERT queued refused sms_unavailable', t.scen(null,$q$t.smsins('queued')$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Ze.2 (e) defaults: INSERT sending refused', t.scen(null,$q$t.smsins('sending')$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Ze.3 defaults: blocked_* rows (non-deliverable audit rows) may still be recorded', t.scen(null,$q$t.smsins('blocked_policy')$q$)||'/'||t.scen(null,$q$t.smsins('blocked_opted_out')$q$)||'/'||t.scen(null,$q$t.smsins('blocked_no_consent')$q$), 'OK/OK/OK');
 perform t.eq('Ze.4 (d) sms_config rows deleted: INSERT queued refused', t.scen('delete from public.sms_config',$q$t.smsins('queued')$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Ze.5 (d) enabled but suppression function missing: INSERT queued refused sms_recipient_suppressed', t.scen('select t.sms_on()',$q$t.smsins('queued')$q$), 'ERR P0001:sms_recipient_suppressed');
 perform t.eq('Ze.6 (d) enabled, suppression raises: refused', t.scen($s$select t.sms_on(); select t.sms_fn($b$raise exception 'x';$b$)$s$,$q$t.smsins('queued')$q$), 'ERR P0001:sms_recipient_suppressed');
 perform t.eq('Ze.7 (d) enabled, suppression NULL: refused', t.scen($s$select t.sms_on(); select t.sms_fn('return null;')$s$,$q$t.smsins('queued')$q$), 'ERR P0001:sms_recipient_suppressed');
 perform t.eq('Ze.8 enabled, recipient opted out: refused', t.scen($s$select t.sms_on(); select t.sms_fn('return true;')$s$,$q$t.smsins('queued')$q$), 'ERR P0001:sms_recipient_suppressed');
 perform t.eq('Ze.9 positive control (rolled back): enabled + healthy suppression + not opted out => queued row accepted', t.scen($s$select t.sms_on(); select t.sms_fn('return false;')$s$,$q$t.smsins('queued')$q$), 'OK');
 -- claim: queued -> sending
 perform t.eq('Zf.1 (d) CLAIM after the config rows are deleted: queued -> sending refused (zero deliverable work)',
   t.scen($s$select t.sms_on(); select t.sms_fn('return false;'); select t.smsins('queued'); delete from public.sms_config$s$, $q$t.smsupd('sending')$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Zf.2 CLAIM after kill switch flipped ON: refused', t.scen($s$select t.sms_on(); select t.sms_fn('return false;'); select t.smsins('queued'); update public.sms_config set value='true'::jsonb where key='kill_switch'$s$, $q$t.smsupd('sending')$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Zf.3 CLAIM when suppression function disappears after queueing: refused', t.scen($s$select t.sms_on(); select t.sms_fn('return false;'); select t.smsins('queued'); drop function public.sms_is_suppressed(text)$s$, $q$t.smsupd('sending')$q$), 'ERR P0001:sms_recipient_suppressed');
 perform t.eq('Zf.4 positive control: enabled + healthy: claim works (rolled back)', t.scen($s$select t.sms_on(); select t.sms_fn('return false;'); select t.smsins('queued')$s$, $q$t.smsupd('sending')$q$), '1');
 perform t.eq('Zf.5 provider callbacks / retries of an already-sending message stay possible while OFF (no stuck rows): sending -> submitted/failed and sending -> queued',
   t.scen($s$select t.sms_on(); select t.sms_fn('return false;'); select t.smsins('queued'); update public.sms_messages set status='sending'; update public.sms_config set value='true'::jsonb where key='kill_switch'$s$, $q$t.smsupd('queued')$q$)||'/'||
   t.scen($s$select t.sms_on(); select t.sms_fn('return false;'); select t.smsins('queued'); update public.sms_messages set status='sending'; update public.sms_config set value='true'::jsonb where key='kill_switch'$s$, $q$t.smsupd('failed')$q$), '1/1');
 perform t.eq('Zf.6 INSERT as authenticated/anon has no table privilege anyway (RLS-protected, service-role only)', (has_table_privilege('authenticated','public.sms_messages','insert') or has_table_privilege('anon','public.sms_messages','insert'))::text, 'false');
 -- (e) with defaults the table holds zero deliverable rows and nothing can be created
 perform t.eq('Zg.1 (e) defaults: zero queued/sending rows exist', (select count(*) from public.sms_messages where status in ('queued','sending'))::text, '0');
 perform t.eq('Zg.2 trigger present exactly once on sms_messages', (select count(*) from pg_trigger where tgrelid='public.sms_messages'::regclass and tgname='trg_sms_messages_fail_closed' and not tgisinternal)::text, '1');
 perform t.eq('Zg.3 config unchanged after the whole suite (still disabled, kill switch on)', (select string_agg(key||'='||(value#>>'{}'),',' order by key) from public.sms_config where key in ('sms_enabled','kill_switch')), 'kill_switch=true,sms_enabled=false');
end $$;
select t.report();
