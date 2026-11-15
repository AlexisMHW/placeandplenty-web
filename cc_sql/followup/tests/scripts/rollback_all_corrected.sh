#!/usr/bin/env bash
# usage: rollback_all_corrected.sh <db> <logfile> [min_first_step=1] [max_first_step=999] [with_followup=1]
# Rolls back the follow-up (reverse FOLLOWUP_ORDER) and then the 61-step package newest-first, using the CORRECTED replacement (ROLLBACK_REPLACEMENTS.tsv) wherever one exists.
# USE_SHIPPED=1 ignores the replacements (negative control: reproduces the shipped defects). Connection: PGHOST / PGPORT / PGUSER (defaults /tmp, 54414, postgres). Scratch Postgres only. Stops at the first failing unit.
DB=$1; LOG=$2; MIN=${3:-1}; MAX=${4:-999}; WF=${5:-1}
F=$(cd "$(dirname "$0")/../.." && pwd); Q=$(cd "$F/.." && pwd)
PS="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54414} -U ${PGUSER:-postgres} -X -q -d $DB"
: > "$LOG"
run() { # <label> <file>
  local flag="-1"; grep -qE '^\s*begin;' "$2" && flag=""
  if out=$($PS $flag -v ON_ERROR_STOP=1 -f "$2" 2>&1); then echo "$1|$(basename $2)|OK" >> "$LOG"; else echo "$1|$(basename $2)|FAIL|$(echo "$out" | grep -m3 -E 'ERROR|DETAIL|HINT|EXCEPTION' | tr '\n' ' ')" >> "$LOG"; return 1; fi
}
if [ "$WF" = 1 ]; then
  for r in $(tail -n +2 "$F/FOLLOWUP_ORDER.tsv" | awk -F'\t' '$5 ~ /^ROLLBACK/ {print $5}' | tac); do run F "$F/rollback/$r" || exit 1; done
fi
tail -n +2 "$Q/APPLY_ORDER.tsv" | awk -F'\t' '$5 ~ /^ROLLBACK/ {print $1"\t"$5}' | sort -rn | while IFS=$'\t' read step rb; do
  [ "$step" -gt "$MAX" ] && continue; [ "$step" -lt "$MIN" ] && break
  c=$(awk -F'\t' -v r="$rb" 'NR>1 && $1==r {print $2}' "$F/ROLLBACK_REPLACEMENTS.tsv")
  if [ -n "$c" ] && [ "${USE_SHIPPED:-0}" != 1 ]; then f="$F/rollback/$c"; else f="$Q/rollback/$rb"; fi
  run "$step" "$f" || exit 1
done
