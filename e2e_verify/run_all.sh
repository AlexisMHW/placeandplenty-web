#!/usr/bin/env bash
# usage: run_all.sh <outdir> [scenario files...]; resets a fresh clone of the pristine 59-step DB (e_sb) before each scenario. Scratch only.
cd /home/claude/pp-work/EXEC/e3-verify/web; . ./e2e_verify/env.sh
OUTD=$1; shift; OUTD=e2e_verify/$OUTD; mkdir -p $OUTD; export E_DB=e_run E_OUT=$PWD/$OUTD/results.jsonl; : > $E_OUT
for f in "$@"; do
  bash e2e_verify/reset.sh e_run >/dev/null 2>&1
  timeout 900 node --import ./e2e_verify/register.mjs e2e_verify/$f > $OUTD/${f%.mjs}.txt 2>&1; echo "$f exit=$?"
done
