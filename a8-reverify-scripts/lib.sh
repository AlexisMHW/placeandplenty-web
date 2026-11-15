H=/home/claude/pp-work/a8/h; PKG=/home/claude/pp-work/a8/native/supabase/qa_package; WEB=/home/claude/pp-work/a8/web
PSQL="psql -X -q -h /tmp/a8pg -p 54488 -v ON_ERROR_STOP=1"
db(){ su postgres -c "$PSQL -d $DB -tA"; }
fresh(){ su postgres -c "psql -X -q -h /tmp/a8pg -p 54488 -d postgres -c 'drop database if exists $DB' -c 'create database $DB'" >/dev/null 2>&1
 sed -e 's/^create role anon nologin; create role authenticated nologin; create role service_role nologin;/do $r$ begin if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname=$q$authenticated$q$) then create role authenticated nologin; end if; if not exists (select 1 from pg_roles where rolname=$q$service_role$q$) then create role service_role nologin; end if; end $r$;/' $H/00_stub_schema.sql > /tmp/a8_stub.sql
 su postgres -c "$PSQL -d $DB" < /tmp/a8_stub.sql >/dev/null 2>/tmp/a8_stub.err || { cat /tmp/a8_stub.err; return 9; }
 su postgres -c "$PSQL -d $DB -c 'alter table public.gathering_entitlements add column if not exists revoked_reason text'" >/dev/null; }
stubchain(){ # package ORDER on stub schema
 echo "create table public.entitlement_events (id uuid primary key default gen_random_uuid(), entitlement_id uuid, user_id uuid, gathering_id uuid, event_type text not null, source text, provider_transaction_id text, actor_user_id uuid, reason text, payload jsonb, created_at timestamptz not null default now());" | db >/dev/null
 echo "create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid \$\$; create or replace function auth.role() returns text language sql stable as \$\$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','') \$\$;" | db >/dev/null
 : > /tmp/${DB}_steps.txt
 for f in $(python3 -c "import json;print(' '.join(json.load(open('$PKG/ORDER.json'))))"); do
  p=$PKG/src/$f; [ -f $p ] || p=$PKG/migrations/$f; [ -f $p ] || p=$PKG/../migrations/$f
  if db < $p >/dev/null 2>/tmp/${DB}_e; then echo "OK   $f" >> /tmp/${DB}_steps.txt; else echo "FAIL $f :: $(head -1 /tmp/${DB}_e|cut -c1-140)" >> /tmp/${DB}_steps.txt; fi
 done; echo "stub chain: $(grep -c ^OK /tmp/${DB}_steps.txt) OK / $(grep -c ^FAIL /tmp/${DB}_steps.txt) FAIL"; }
