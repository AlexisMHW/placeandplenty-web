#!/usr/bin/env bash
# usage: apply_followup.sh <db> [pg port=54414]   Applies FOLLOWUP_ORDER.json (src/) to a scratch DB that already holds the 61-step main chain. Scratch cluster only (socket /tmp).
DB=$1; PORT=${2:-54414}; F=$(cd "$(dirname "$0")/../.." && pwd)
P="psql -h /tmp -p $PORT -U postgres -X -q -d $DB -v ON_ERROR_STOP=1"; ok=0; fail=0
for f in $(python3 -c "import json;print(' '.join(json.load(open('$F/FOLLOWUP_ORDER.json'))))"); do
  if $P -1 -f $F/src/$f >/dev/null 2>/tmp/fu_e; then ok=$((ok+1)); echo "OK   $f"; else fail=$((fail+1)); echo "FAIL $f :: $(grep -m1 -i error /tmp/fu_e | cut -c1-200)"; fi
done; echo "followup forward: ok=$ok fail=$fail"
