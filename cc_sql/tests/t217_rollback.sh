#!/usr/bin/env bash
# Rolls 217110, 217102, 217101, 217100 back (reverse order) on a fresh scratch DB built from the package and checks the A3 objects are gone. LOCAL scratch only.
. /home/claude/pp-work/CCHC/scripts/lib.sh; DB=${DB:-cchc_217rb}; PKG=${PKG:-/home/claude/pp-work/EXEC/a1-db-native/supabase/qa_package}; A=$(cd $(dirname $0)/.. && pwd)
fresh
echo "create table public.entitlement_events (id uuid primary key default gen_random_uuid(), entitlement_id uuid, user_id uuid, gathering_id uuid, event_type text not null, source text, provider_transaction_id text, actor_user_id uuid, reason text, payload jsonb, created_at timestamptz not null default now());" | db >/dev/null
echo "create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid \$\$; create or replace function auth.role() returns text language sql stable as \$\$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','') \$\$;" | db >/dev/null
for f in $(python3 -c "import json;print(' '.join(json.load(open('$PKG/ORDER.json'))))"); do p=$PKG/src/$f; [ -f $p ] || p=$PKG/migrations/$f; [ -f $p ] || p=$PKG/../migrations/$f; db < $p >/dev/null 2>&1; done
for f in 217110 217102 217101 217100; do db < $A/rollback/ROLLBACK_$f.sql >/dev/null 2>/tmp/rbe || { echo "FAIL rollback $f: $(head -2 /tmp/rbe)"; exit 1; }; echo "PASS rollback $f"; done
n=$(echo "select count(*) from pg_proc where proname in ('cc_raise_notification','hc_admin_payout_ledger','hc_admin_assign_tier','hc_tier_write','admin_list_notifications')" | db); [ "$n" = 0 ] && echo "PASS A3/A1b functions removed" || echo "FAIL $n functions remain"
echo "select pg_get_functiondef('public.hc_upsert_tier(text,text,text,text,integer,boolean,boolean,text)'::regprocedure) like '%on conflict (slug)%'" | db | grep -qx t && echo "PASS A7 hc_upsert_tier body restored" || echo "FAIL hc_upsert_tier not restored"
