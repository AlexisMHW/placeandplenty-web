#!/usr/bin/env bash
# usage: run_tf.sh <db_with_full_chain> <out> [test.sql]   (scratch cluster 54414). Clones the DB, adapts auth stubs, runs harness + test.
SRC=$1; OUT=$2; T=${3:-$(dirname $0)/tf217200.sql}; D=${SRC}_t; P="psql -h /tmp -p 54414 -U postgres -X -q"
$P -d postgres -c "drop database if exists $D" -c "create database $D template $SRC" >/dev/null
$P -d $D -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','') $$;
alter table auth.users add column if not exists is_anonymous boolean default false, add column if not exists deleted_at timestamptz, add column if not exists last_sign_in_at timestamptz, add column if not exists raw_app_meta_data jsonb default '{}';
SQL
cat /home/claude/pp-work/CCHC/scripts/harness.sql $T | $P -d $D -tA 2>/tmp/f_tf_err > $OUT; [ -s /tmp/f_tf_err ] && echo "stderr: $(head -5 /tmp/f_tf_err)" >> $OUT
echo "TOTAL pass=$(grep -c '^PASS' $OUT) fail=$(grep -c '^FAIL' $OUT)" >> $OUT
$P -d postgres -c "drop database if exists $D" >/dev/null
