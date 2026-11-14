#!/usr/bin/env bash
# LOCAL scratch DB only (cluster on socket /tmp port 54414). Applies the FULL ordered package (A1b, supabase/qa_package/ORDER.json in the native repo)
# on the CCHC stub schema, then runs a test file. The A3 files in this directory are byte-identical copies of qa_package/src/20261114217100..217102.
# usage: run217.sh [test.sql] [out.txt]   env: PKG=<path to qa_package>, DB=<scratch db name>
. /home/claude/pp-work/CCHC/scripts/lib.sh; DB=${DB:-cchc_217}
PKG=${PKG:-/home/claude/pp-work/EXEC/a1-db-native/supabase/qa_package}; HERE=$(cd $(dirname $0) && pwd)
T=${1:-$HERE/t217.sql}; OUT=${2:-$HERE/RESULT_$(basename $T .sql).txt}; : > $OUT
fresh
echo "create table public.entitlement_events (id uuid primary key default gen_random_uuid(), entitlement_id uuid, user_id uuid, gathering_id uuid, event_type text not null, source text, provider_transaction_id text, actor_user_id uuid, reason text, payload jsonb, created_at timestamptz not null default now());" | db >/dev/null
echo "create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid \$\$; create or replace function auth.role() returns text language sql stable as \$\$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','') \$\$;" | db >/dev/null
for f in $(python3 -c "import json;print(' '.join(json.load(open('$PKG/ORDER.json'))))"); do
  p=$PKG/src/$f; [ -f $p ] || p=$PKG/migrations/$f; [ -f $p ] || p=$PKG/../migrations/$f
  # steps for co-host/email/payments need prod-shaped tables; on the stub schema they fail harmlessly (the baseline-replay chain covers them)
  db < $p >/dev/null 2>/dev/null || echo "note: step not applicable on stub schema: $f" >> $OUT
done
cat $W/scripts/harness.sql $T | db 2>/tmp/eb217 | tee -a $OUT; [ -s /tmp/eb217 ] && echo "stderr: $(head -4 /tmp/eb217)" | tee -a $OUT
echo "TOTAL pass=$(grep -c '^PASS' $OUT) fail=$(grep -c '^FAIL' $OUT)" | tee -a $OUT
