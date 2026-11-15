#!/usr/bin/env bash
# Builds a scratch DB from the repo's baseline migrations (supabase/migrations, excluding the QA-package files),
# using local Supabase stubs (roles, auth, storage, pg_cron shim). Scratch only; never points at Supabase.
# usage: build_chain_db.sh <dbname>
set -u
DB=$1; PGH="-h /tmp/a8pg -p 54488 -U postgres -X -q"
M=/home/claude/pp-work/a8/native/supabase/migrations
psql $PGH -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null 2>&1
psql $PGH -d $DB -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
 if not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions; create schema if not exists cron; create schema if not exists net;
create extension if not exists pgcrypto schema extensions; create extension if not exists "uuid-ossp" schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.role',true),''),'service_role') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
SQL
ok=0; fails=0; : > /tmp/a8_${DB}_base_fail.txt
for f in $(cd $M; ls *.sql | awk -F_ '{v=substr($1,1,14)} v<"20261110000000" || v ~ /^2026111020(0[0-3]00|0400|0401|0402|0403|0404)$/ || v=="20261110206000" || v=="20261110206001" || v=="20261113201000" || v=="20261113201001" {print}' | grep -v -E "PROPOSED|MANIFEST|_r1\.sql"); do
  if timeout 60 psql $PGH -d $DB -v ON_ERROR_STOP=1 -1 -f $M/$f >/tmp/a8_${DB}_o.txt 2>&1; then ok=$((ok+1)); else fails=$((fails+1)); echo "$f: $(grep -m1 -i error /tmp/a8_${DB}_o.txt | cut -c1-150)" >> /tmp/a8_${DB}_base_fail.txt; fi
done
echo "baseline ok=$ok fails=$fails (failures in /tmp/a8_${DB}_base_fail.txt)"
