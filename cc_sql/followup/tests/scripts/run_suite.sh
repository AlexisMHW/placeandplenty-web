#!/usr/bin/env bash
# usage: run_suite.sh <db> <out> <test.sql> [port=54414]  Clones <db>, sets the clone's timezone to UTC (production sessions are UTC), adapts the auth stubs, runs harness + test. Scratch only.
SRC=$1; OUT=$2; T=$3; PORT=${4:-54414}; D=${SRC}_t; H=$(dirname "$0")/harness.sql; P="psql -h /tmp -p $PORT -U postgres -X -q"
$P -d postgres -c "drop database if exists $D" -c "create database $D template $SRC" >/dev/null
$P -d postgres -c "alter database $D set timezone to 'UTC'" >/dev/null
$P -d $D -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','') $$;
alter table auth.users add column if not exists is_anonymous boolean default false, add column if not exists deleted_at timestamptz, add column if not exists last_sign_in_at timestamptz, add column if not exists raw_app_meta_data jsonb default '{}';
SQL
cat $H $T | $P -d $D -tA 2>/tmp/fu_tf_err > $OUT; [ -s /tmp/fu_tf_err ] && echo "stderr: $(head -5 /tmp/fu_tf_err)" >> $OUT; echo "ABORTED_BLOCKS=$(grep -c "^ERROR:" /tmp/fu_tf_err)" >> $OUT
echo "TOTAL pass=$(grep -c '^PASS' $OUT) fail=$(grep -c '^FAIL' $OUT)" >> $OUT
$P -d postgres -c "drop database if exists $D" >/dev/null
