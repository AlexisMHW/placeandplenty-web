DB=$1; Q=/home/claude/pp-work/a8/native/supabase/qa_package
P="psql -h /tmp/a8pg -p 54488 -U postgres -X -q -d $DB -v ON_ERROR_STOP=1"
ok=0; fail=0; : > /tmp/a8_$DB.steps
for f in $(python3 -c "import json;print(' '.join(json.load(open('$Q/ORDER.json'))))"); do
  p=$Q/src/$f; [ -f $p ] || p=$Q/migrations/$f; [ -f $p ] || p=$Q/../migrations/$f
  if $P -1 -f $p >/dev/null 2>/tmp/a8_fe; then ok=$((ok+1)); echo "OK   $f" >> /tmp/a8_$DB.steps; else fail=$((fail+1)); echo "FAIL $f :: $(grep -m1 -i error /tmp/a8_fe|cut -c1-200)" >> /tmp/a8_$DB.steps; fi
done
echo "forward: ok=$ok fail=$fail"
