DB=$1; Q=/home/claude/pp-work/a8/native/supabase/qa_package
P="psql -h /tmp/a8pg -p 54488 -U postgres -X -q -d $DB -v ON_ERROR_STOP=1"; : > /tmp/a8_$DB.rb
for r in $(tail -n +2 $Q/APPLY_ORDER.tsv | awk -F'\t' '$5 !~ /^\(/ {print $5}' | tac | awk '!s[$0]++'); do
  if $P -1 -f $Q/rollback/$r >/dev/null 2>/tmp/a8_re; then echo "OK   $r" >> /tmp/a8_$DB.rb; else echo "FAIL $r :: $(grep -m1 -i error /tmp/a8_re | cut -c1-200)" >> /tmp/a8_$DB.rb; fi
done
echo "rollback groups: ok=$(grep -c '^OK' /tmp/a8_$DB.rb) fail=$(grep -c '^FAIL' /tmp/a8_$DB.rb)"
