#!/usr/bin/env bash
# usage: prove_rollback_roundtrip.sh <template_db> <workdir>
# <template_db> = a scratch database holding the pre-apply QA-faithful baseline (never QA itself). For each scenario a fresh database is cloned from it (timezone UTC).
# Scenarios: (1) apply 61 + follow-up, roll everything back with the CORRECTED files, compare with the baseline; (2) partial rollback of steps >= 40 + follow-up compared with a database that only applied steps 1..39, then re-apply 40..61 + follow-up and compare with the full apply;
# (3) partial rollback of steps >= 2 (everything except unit 1), then re-apply 2..61 + follow-up. Comparison = catalog fingerprint, non-function catalog fingerprint, per-table md5, and exact function md5s (all functions incl. the 24 the package changes).
T=$1; W=$2; mkdir -p "$W"; S=$(cd "$(dirname "$0")" && pwd); F=$(cd "$S/../.." && pwd)
PA="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54414} -U ${PGUSER:-postgres} -X -q -d postgres"
pass=0; fail=0
cmpk() { # label a b [strict-tbl: 1 = byte-identical table md5s (the pre-existing 58 tables always are); 0 = compare the masked variant (timestamps / uuids of package-seeded config rows differ between two applies)]
  local ST=${4:-1}
  if [ "$ST" = 0 ]; then
    # pre-existing tables (those of the baseline) must still be strictly identical
    if diff <(grep -F -f <(cut -f1 $W/base_tbl.txt | sed 's/$/\t/') $W/$2_tbl.txt) <(grep -F -f <(cut -f1 $W/base_tbl.txt | sed 's/$/\t/') $W/$3_tbl.txt) >/dev/null; then pass=$((pass+1)); echo "PASS $1 [tbl, the 58 pre-existing tables, strict] identical"; else fail=$((fail+1)); echo "FAIL $1 [tbl strict, pre-existing tables] differ"; fi
  fi
  for k in fp nonfn $( [ "$ST" = 1 ] && echo tbl || echo tblx ) fn; do if cmp -s "$W/$2_$k.txt" "$W/$3_$k.txt"; then pass=$((pass+1)); echo "PASS $1 [$k] identical ($(wc -l < $W/$2_$k.txt) lines)"; else fail=$((fail+1)); echo "FAIL $1 [$k] differ: $(diff $W/$2_$k.txt $W/$3_$k.txt | grep -c '^[<>]') lines"; fi; done; }
mk() { $PA -c "drop database if exists $1" -c "create database $1 template $T" >/dev/null 2>&1; $PA -c "alter database $1 set timezone to 'UTC'" -c "alter database $1 set search_path to \"\$user\", public, extensions" >/dev/null; }
snap() { bash $S/snapshot.sh "$1" "$W/$2"; }
st() { echo "$1: $(grep -c '|OK' $2) ok, $(grep -c '|FAIL' $2) fail"; }
$PA -c "alter database $T set timezone to 'UTC'" >/dev/null 2>&1
snap $T base
# (1) full round trip
mk rt_full; : > $W/a1.log; bash $S/apply_main_range.sh rt_full 1 61 $W/a1.log; st "apply main" $W/a1.log; bash $S/apply_followup.sh rt_full | tail -1
snap rt_full applied
bash $S/rollback_all_corrected.sh rt_full $W/r1.log; echo "rollback units: $(grep -c '|OK' $W/r1.log) ok, $(grep -c '|FAIL' $W/r1.log) fail"; grep FAIL $W/r1.log
snap rt_full rolledback; cmpk "1 full rollback == baseline" base rolledback
# (1c) idempotency of the three corrected single-function rollbacks (run again on the already rolled-back database)
for f in ROLLBACK_20261114145911_CORRECTED ROLLBACK_207000_CORRECTED ROLLBACK_217201_CORRECTED; do
  if psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54414} -U ${PGUSER:-postgres} -X -q -d rt_full -v ON_ERROR_STOP=1 -1 -f $F/rollback/$f.sql >/dev/null 2>&1; then pass=$((pass+1)); echo "PASS 1c $f can be run again"; else fail=$((fail+1)); echo "FAIL 1c $f second run failed"; fi; done
snap rt_full rerun; cmpk "1d second run of the three leaves the baseline untouched" base rerun
# (1e) NEGATIVE CONTROL: the SHIPPED rollbacks on the same applied state must fail where REPORT_r-rehearsal says (ROLLBACK_202000_202004, D1)
mk rt_neg; bash $S/apply_main_range.sh rt_neg 1 61 $W/a0.log; USE_SHIPPED=1 bash $S/rollback_all_corrected.sh rt_neg $W/rneg.log 1 999 0
if grep -q 'ROLLBACK_202000_202004.sql|FAIL.*f41e51f2efb0 <> captured f840f1f4e6b8' $W/rneg.log; then pass=$((pass+1)); echo "PASS 1e negative control: shipped ROLLBACK_202000_202004 fails with the D1 md5 mismatch"; else fail=$((fail+1)); echo "FAIL 1e negative control did not reproduce D1: $(tail -1 $W/rneg.log)"; fi
# re-apply after full rollback
: > $W/a1b.log; bash $S/apply_main_range.sh rt_full 1 61 $W/a1b.log; bash $S/apply_followup.sh rt_full | tail -1; snap rt_full reapplied; cmpk "1b re-apply after full rollback == first apply" applied reapplied 0
# (2) partial rollback >= 40
mk rt_ref39; : > $W/a2.log; bash $S/apply_main_range.sh rt_ref39 1 39 $W/a2.log; snap rt_ref39 ref39
mk rt_p40; bash $S/apply_main_range.sh rt_p40 1 61 $W/a3.log; bash $S/apply_followup.sh rt_p40 | tail -1
bash $S/rollback_all_corrected.sh rt_p40 $W/r2.log 40 999 1; grep FAIL $W/r2.log; snap rt_p40 p40; cmpk "2 rollback of steps >= 40 + follow-up == apply of steps 1..39" ref39 p40 0
: > $W/a4.log; bash $S/apply_main_range.sh rt_p40 40 61 $W/a4.log; bash $S/apply_followup.sh rt_p40 | tail -1; snap rt_p40 p40re; cmpk "2b re-apply 40..61 + follow-up == first full apply" applied p40re 0
# (3) partial rollback >= 2 (all but unit 1)
mk rt_ref1; : > $W/a5.log; bash $S/apply_main_range.sh rt_ref1 1 1 $W/a5.log; snap rt_ref1 ref1
mk rt_p2; bash $S/apply_main_range.sh rt_p2 1 61 $W/a6.log; bash $S/apply_followup.sh rt_p2 | tail -1
bash $S/rollback_all_corrected.sh rt_p2 $W/r3.log 2 999 1; grep FAIL $W/r3.log; snap rt_p2 p2; cmpk "3 rollback of steps >= 2 + follow-up == apply of step 1 only" ref1 p2
: > $W/a7.log; bash $S/apply_main_range.sh rt_p2 2 61 $W/a7.log; bash $S/apply_followup.sh rt_p2 | tail -1; snap rt_p2 p2re; cmpk "3b re-apply 2..61 + follow-up == first full apply" applied p2re 0
echo "ROUNDTRIP pass=$pass fail=$fail"
for d in rt_neg rt_full rt_ref39 rt_p40 rt_ref1 rt_p2; do $PA -c "drop database if exists $d" >/dev/null 2>&1; done
