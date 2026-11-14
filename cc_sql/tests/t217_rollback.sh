#!/usr/bin/env bash
# Rolls 217002,217001,217000 back on a fresh scratch DB and compares the public function list to the pre-217 state.
. /home/claude/pp-work/CCHC/scripts/lib.sh; DB=cchc_217; A=/home/claude/pp-work/EXEC/a3-cc-web/cc_sql
Q="select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1"
Q2="select table_name||'.'||column_name from information_schema.columns where table_schema='public' order by 1"
bash $A/tests/run217.sh /tmp/empty.sql /tmp/rr.txt >/dev/null
echo "$Q" | db > /tmp/fn_after.txt; echo "$Q2" | db > /tmp/col_after.txt
for f in 217002 217001 217000; do db < $A/rollback/ROLLBACK_$f.sql >/dev/null 2>/tmp/rbe || { echo "FAIL rollback $f: $(head -2 /tmp/rbe)"; exit 1; }; done
echo "$Q" | db > /tmp/fn_rb.txt; echo "$Q2" | db > /tmp/col_rb.txt
# baseline = chain without 217
echo "removed functions:"; diff /tmp/fn_after.txt /tmp/fn_rb.txt | grep '^<' | wc -l; echo "functions still present that were added by 217 (expect 0):"; diff /tmp/fn_after.txt /tmp/fn_rb.txt | grep '^>' | wc -l
echo "new-in-217 leftovers:"; grep -E 'cc_notif|payout_ledger|admin_list_tiers|set_tier_benefits|admin_assign_tier|set_partner_status|admin_terms_history|admin_notification_counts|admin_set_notification|admin_get_notification|cc_sweep|cc_raise|cc_claim' /tmp/fn_rb.txt /tmp/col_rb.txt | wc -l
