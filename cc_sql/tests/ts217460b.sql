-- Agent S2 audit suite for 217460, part B: the PROPOSED-ONLY SMS function files (209001..209006, not in ORDER.json) applied on top of the full chain in a scratch DB.
-- usage: bash tests/s2_sql/scripts/run_tf.sh s2_smsaudit out.txt cc_sql/tests/ts217460b.sql    (s2_smsaudit = full chain + 209001,209002,209003,209004,209005,209005_v2,209006)
-- Helpers below are the same as ts217460.sql (the runner clones the DB per file).
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
create or replace function t.sms_live() returns void language sql as $f$ select t.sms_on(); select t.sms_fn('return false;') $f$;
create or replace function t.smsupd(p_to text) returns text language plpgsql as $f$ declare n int; begin update public.sms_messages set status=p_to; get diagnostics n = row_count; return n::text; end $f$;
do $$ declare g uuid := gen_random_uuid(); u uuid := gen_random_uuid(); begin
 perform t.eq('Y0.1 proposed SMS functions present in the audit DB (sms_claim_message, sms_due_messages, sms_queue_prepared)', (to_regprocedure('public.sms_claim_message(uuid)') is not null and to_regprocedure('public.sms_due_messages(integer)') is not null)::text, 'true');
 -- sms_is_suppressed now exists in this DB (209001) and is the real one
 perform t.eq('Y1.1 real sms_is_suppressed present: is_contact_suppressed(sms, unknown hash) = false', t.scen(null,$q$public.is_contact_suppressed('sms','h-unknown')$q$), 'false');
 perform t.eq('Y1.2 opted-out hash => true', t.scen($s$insert into public.sms_suppressions(phone_hash,state) values ('h-out','opted_out')$s$,$q$public.is_contact_suppressed('sms','h-out')$q$), 'true');
 -- sms_cfg_bool defaults
 perform t.eq('Y2.1 sms_cfg_bool defaults fail-closed with rows deleted: enabled=false, kill_switch=true', t.scen('delete from public.sms_config',$q$public.sms_cfg_bool('sms_enabled',false)::text||'/'||public.sms_cfg_bool('kill_switch',true)::text$q$), 'false/true');
 -- queue
 perform t.eq('Y3.1 (d) sms_queue_prepared with defaults: sms_unavailable', t.scen(null, format($q$public.sms_queue_prepared(%L,%L,'invitation','[]'::jsonb)$q$,u,g)), 'ERR P0001:sms_unavailable');
 perform t.eq('Y3.2 (d) sms_queue_prepared with sms_config rows deleted: sms_unavailable', t.scen('delete from public.sms_config', format($q$public.sms_queue_prepared(%L,%L,'invitation','[]'::jsonb)$q$,u,g)), 'ERR P0001:sms_unavailable');
 perform t.eq('Y3.3 sms_queue_prepared with sms_config table missing: error, never queues', left(t.scen('alter table public.sms_config rename to sms_config_x', format($q$public.sms_queue_prepared(%L,%L,'invitation','[]'::jsonb)$q$,u,g)),3), 'ERR');
 -- worker: claim / due / dispatch
 perform t.eq('Y4.1 (d) sms_claim_message after config rows deleted: refused (no row returned as work)', t.scen($s$select t.sms_live(); select t.smsins('queued'); delete from public.sms_config$s$, $q$(select count(*) from public.sms_claim_message((select id from public.sms_messages limit 1)))$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Y4.2 sms_claim_message with defaults (a queued row cannot even exist): row stays unclaimed', (select count(*) from public.sms_messages where status in ('queued','sending'))::text, '0');
 perform t.eq('Y4.3 sms_claim_message after kill switch ON: refused', t.scen($s$select t.sms_live(); select t.smsins('queued'); update public.sms_config set value='true'::jsonb where key='kill_switch'$s$, $q$(select count(*) from public.sms_claim_message((select id from public.sms_messages limit 1)))$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Y4.4 positive control (rolled back): enabled + healthy suppression => claim returns 1 row', t.scen($s$select t.sms_live(); select t.smsins('queued')$s$, $q$(select count(*) from public.sms_claim_message((select id from public.sms_messages limit 1)))$q$), '1');
 perform t.eq('Y4.5 FINDING (informational): sms_due_messages is not config-gated and lists queued ids even when OFF; harmless because claim is refused', t.scen($s$select t.sms_live(); select t.smsins('queued'); update public.sms_config set value='true'::jsonb where key='kill_switch'$s$, $q$(select count(*) from public.sms_due_messages(10))$q$), '1');
 perform t.eq('Y5.1 sms_dispatch_context flags with config rows deleted read dbEnabled=false, killSwitchOn=true', t.scen($s$select t.sms_live(); select t.smsins('queued'); delete from public.sms_config$s$, $q$(public.sms_dispatch_context((select id from public.sms_messages limit 1))->'flags'->>'dbEnabled')||'/'||(public.sms_dispatch_context((select id from public.sms_messages limit 1))->'flags'->>'killSwitchOn')$q$), 'false/true');
 perform t.eq('Y6.1 get_sms_usage_summary reports unavailable with defaults and with rows deleted', t.scen(null, format($q$public.get_sms_usage_summary(%L)$q$,g),'authenticated'), 'ERR P0001:not_authorized');
 perform t.eq('Y7.1 INSERT of deliverable row with rows deleted AND the suppression function dropped: refused', t.scen($s$delete from public.sms_config; drop function public.sms_is_suppressed(text) cascade$s$, $q$t.smsins('queued')$q$), 'ERR P0001:sms_unavailable');
 perform t.eq('Y8.1 (e) defaults: zero deliverable rows, sms_config untouched', (select count(*) from public.sms_messages where status in ('queued','sending'))::text||'/'||(select string_agg(key||'='||(value#>>'{}'),',' order by key) from public.sms_config where key in ('sms_enabled','kill_switch')), '0/kill_switch=true,sms_enabled=false');
end $$;
select t.report();
