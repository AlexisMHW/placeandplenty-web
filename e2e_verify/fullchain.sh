. /home/claude/pp-work/EXEC/e4-verify/web/e2e_verify/env.sh
DB=$1; OUT=$2
bash $E/web/e2e_verify/build_chain_db.sh $DB > $OUT
PS="psql -h /tmp -p $PGPORT -U postgres -X -q -d $DB -v ON_ERROR_STOP=1"
ok=0; fail=0; : > $OUT.steps
for f in $(tail -n +2 $Q/APPLY_ORDER.tsv | cut -f2); do
  p=$Q/$f
  if $PS -1 -f $p >/dev/null 2>/tmp/e_fc_e; then ok=$((ok+1)); echo "OK   $f" >> $OUT.steps; else fail=$((fail+1)); echo "FAIL $f :: $(grep -m1 -i error /tmp/e_fc_e|cut -c1-200)" >> $OUT.steps; fi
done
echo "forward: ok=$ok fail=$fail" >> $OUT
