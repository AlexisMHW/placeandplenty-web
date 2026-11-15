#!/usr/bin/env bash
# usage: rb_followup.sh <db> [port]   Rolls back the follow-up in REVERSE FOLLOWUP_ORDER.tsv order (scratch only).
DB=$1; PORT=${2:-54414}; F=$(cd "$(dirname "$0")/../.." && pwd)
P="psql -h /tmp -p $PORT -U postgres -X -q -d $DB -v ON_ERROR_STOP=1"; ok=0; fail=0
for r in $(tail -n +2 $F/FOLLOWUP_ORDER.tsv | awk -F'\t' '{print $5}' | tac); do
  if $P -1 -f $F/rollback/$r >/dev/null 2>/tmp/fu_e; then ok=$((ok+1)); echo "OK   $r"; else fail=$((fail+1)); echo "FAIL $r :: $(grep -m1 -i error /tmp/fu_e | cut -c1-200)"; fi
done; echo "followup rollbacks: ok=$ok fail=$fail"
