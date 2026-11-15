#!/usr/bin/env bash
# usage: run_suite.sh <test.sql> <out>  -- clones the pristine 59-step DB (e_sb), runs the earlier agents' SQL suite with the shared harness. Scratch only.
. /home/claude/pp-work/EXEC/e4-verify/web/e2e_verify/env.sh
T=$1; OUT=$2; D=e_suite; P="psql -h /tmp -p $PGPORT -U postgres -X -q"
$P -d postgres -c "drop database if exists $D" -c "create database $D template ${TPL:-e_sb}" >/dev/null
$P -d postgres -c "alter database $D set timezone to 'UTC'" >/dev/null
$P -d $D -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','') $$;
alter table auth.users add column if not exists is_anonymous boolean default false, add column if not exists last_sign_in_at timestamptz;
SQL
cat /home/claude/pp-work/CCHC/scripts/harness.sql $T | $P -d $D -tA 2>/tmp/e4_suite_err > $OUT; [ -s /tmp/e4_suite_err ] && echo "stderr: $(head -5 /tmp/e4_suite_err)" >> $OUT
echo "TOTAL pass=$(grep -c '^PASS' $OUT) fail=$(grep -c '^FAIL' $OUT) aborted_blocks=$(grep -c '^ERROR:' /tmp/e4_suite_err)" >> $OUT
$P -d postgres -c "drop database if exists $D" >/dev/null
