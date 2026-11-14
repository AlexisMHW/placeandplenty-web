#!/usr/bin/env bash
# LOCAL scratch DB only (cchc_217, socket /tmp port 54414). Applies the chain + 215002 + 217000..217002 then runs a test file.
. /home/claude/pp-work/CCHC/scripts/lib.sh; DB=cchc_217
A=/home/claude/pp-work/EXEC/a3-cc-web/cc_sql; P=$W/out/proposed; T=${1:-$A/tests/t217.sql}; OUT=${2:-/home/claude/pp-work/EXEC/a3-cc-web/cc_sql/tests/RESULT_$(basename $T .sql).txt}; : > $OUT
log(){ echo "$*"|tee -a $OUT; }
CH="$S/20261111210000_qa_command_center_staff_rbac_and_overview.sql $S/20261111211000_growth_lifecycle_events.sql $P/20261111211001_growth_funnel_summary_r1.sql $S/20261113212000_hc_attribution_schema.sql $S/20261113212001_hc_attribution_functions.sql $S/20261113212002_hc_fixed_amount_terms_schema.sql $S/20261113212003_hc_fixed_amount_functions.sql $S/20261113214000_hc_program_schema.sql $S/20261113214001_hc_program_functions.sql $S/20261113214002_hc_program_permissions.sql $P/20261114214003_hc_hardening_r1.sql $P/20261114215000_cc_ops_staff_rpcs.sql $P/20261114215001_hc_basic_membership.sql $P/20261114215002_hc_campaign_admin_rpcs.sql ${A7_216100:-/home/claude/pp-work/EXEC/a7-payments-native/supabase/proposed_a7/20261114216100_hc_manual_payouts_and_terms_governance.sql} $A/20261114217000_hc_manual_payout_admin.sql $A/20261114217001_hc_tier_admin.sql $A/20261114217002_cc_notifications.sql"
fresh
echo "create table public.entitlement_events (id uuid primary key default gen_random_uuid(), entitlement_id uuid, user_id uuid, gathering_id uuid, event_type text not null, source text, provider_transaction_id text, actor_user_id uuid, reason text, payload jsonb, created_at timestamptz not null default now());" | db >/dev/null
for f in $CH; do db < $f >/dev/null 2>/tmp/e217 || { log "FAIL apply $(basename $f): $(head -3 /tmp/e217)"; exit 1; }; done
log "chain applied OK ($(echo $CH | wc -w) files)"
cat $W/scripts/harness.sql $T | db 2>/tmp/eb217 | tee -a $OUT; [ -s /tmp/eb217 ] && log "stderr: $(head -4 /tmp/eb217)"
log "TOTAL pass=$(grep -c '^PASS' $OUT) fail=$(grep -c '^FAIL' $OUT)"
