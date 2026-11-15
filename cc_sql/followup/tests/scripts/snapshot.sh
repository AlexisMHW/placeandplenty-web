#!/usr/bin/env bash
# usage: snapshot.sh <db> <outprefix>   catalog fingerprint (core + non-function), per-table row count + md5, exact function md5s (md5 of pg_get_functiondef and of prosrc). Session timezone is forced to UTC.
DB=$1; X=$2; T=$(cd "$(dirname "$0")/../fingerprint" && pwd)
export PGOPTIONS='-c timezone=UTC -c search_path="$user",public,extensions'
P="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54414} -U ${PGUSER:-postgres} -X -q -At -d $DB"
$P -f $T/fp_core.sql | sort > ${X}_fp.txt
$P -f $T/fp_nonfn.sql | sort > ${X}_nonfn.txt
$P -f $T/tbl_md5.sql | grep -v '^DO' > ${X}_tbl.txt
$P -f $T/tbl_md5_masked.sql | grep -v '^DO' > ${X}_tblx.txt
$P -c "select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'||'|'||md5(pg_get_functiondef(p.oid))||'|'||md5(p.prosrc) from pg_proc p where pronamespace='public'::regnamespace and prokind in ('f','p') and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1" > ${X}_fn.txt
