#!/usr/bin/env bash
# usage: apply_main_range.sh <db> <from_step> <to_step> <logfile>   applies APPLY_ORDER steps (one transaction each) + records the ledger row. PGHOST/PGPORT/PGUSER as in rollback_all_corrected.sh. Scratch only.
DB=$1; A=$2; B=$3; LOG=$4; F=$(cd "$(dirname "$0")/../.." && pwd); Q=$(cd "$F/.." && pwd)
PS="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54414} -U ${PGUSER:-postgres} -X -q -d $DB"
tail -n +2 "$Q/APPLY_ORDER.tsv" | while IFS=$'\t' read step file sha phase rb; do
  [ "$step" -lt "$A" ] && continue; [ "$step" -gt "$B" ] && break
  if out=$($PS -1 -v ON_ERROR_STOP=1 -f "$Q/$file" 2>&1); then
    v=$(basename "$file" .sql); $PS -c "insert into supabase_migrations.schema_migrations(version,name,statements) values ('${v%%_*}','${v#*_}','{}') on conflict do nothing" >/dev/null 2>&1
    echo "$step|OK" >> "$LOG"
  else echo "$step|FAIL|$(echo "$out" | grep -m3 -E 'ERROR|DETAIL|HINT' | tr '\n' ' ')" >> "$LOG"; break; fi
done
