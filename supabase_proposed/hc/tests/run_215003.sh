#!/usr/bin/env bash
# LOCAL scratch DB only (a2_215003, port 54414). Never touches QA/production.
. /home/claude/pp-work/CCHC/scripts/lib.sh; DB=a2_215003; P=$W/out/proposed; H=/home/claude/pp-work/EXEC/a2-hc-web/supabase_proposed/hc
OUT=${OUT:-/home/claude/pp-work/EXEC/reports/RESULT_215003_local.txt}; : > $OUT; log(){ echo "$*"|tee -a $OUT; }
CH="$S/20261111210000_qa_command_center_staff_rbac_and_overview.sql $S/20261111211000_growth_lifecycle_events.sql $P/20261111211001_growth_funnel_summary_r1.sql $S/20261113212000_hc_attribution_schema.sql $S/20261113212001_hc_attribution_functions.sql $S/20261113212002_hc_fixed_amount_terms_schema.sql $S/20261113212003_hc_fixed_amount_functions.sql $S/20261113214000_hc_program_schema.sql $S/20261113214001_hc_program_functions.sql $S/20261113214002_hc_program_permissions.sql $P/20261114214003_hc_hardening_r1.sql $P/20261114215000_cc_ops_staff_rpcs.sql $P/20261114215001_hc_basic_membership.sql $P/20261114215002_hc_campaign_admin_rpcs.sql"
fresh; for f in $CH; do db < $f >/dev/null 2>/tmp/e || { log "FAIL base $(basename $f): $(head -2 /tmp/e)"; exit 1; }; done
echo "create table public.entitlement_events (id uuid primary key default gen_random_uuid(), entitlement_id uuid, user_id uuid, gathering_id uuid, event_type text not null, source text, provider_transaction_id text, actor_user_id uuid, reason text, payload jsonb, created_at timestamptz not null default now());" | db >/dev/null
snap /tmp/a2s0.txt
db < $H/20261114215003_hc_lifecycle_tiers_events.sql >/dev/null 2>/tmp/e && log "PASS apply 215003" || { log "FAIL apply 215003: $(head -3 /tmp/e)"; exit 1; }
snap /tmp/a2s1.txt
db < $H/20261114215003_hc_lifecycle_tiers_events.sql >/dev/null 2>/tmp/e && log "PASS re-run 215003" || log "FAIL re-run: $(head -3 /tmp/e)"
snap /tmp/a2s1b.txt; diff -q /tmp/a2s1.txt /tmp/a2s1b.txt >/dev/null && log "PASS re-run leaves catalog unchanged" || log "FAIL re-run changed catalog: $(diff /tmp/a2s1.txt /tmp/a2s1b.txt | head -4)"
cat $W/scripts/harness.sql $H/tests/t215003.sql | db 2>/tmp/eb | tee -a $OUT; [ -s /tmp/eb ] && log "stderr: $(head -4 /tmp/eb)"
db < $H/ROLLBACK_215003_hc_lifecycle_tiers_events.sql >/dev/null 2>/tmp/e && log "PASS rollback 215003 runs" || log "FAIL rollback: $(head -3 /tmp/e)"
snap /tmp/a2s2.txt; diff /tmp/a2s0.txt /tmp/a2s2.txt > /tmp/a2d.txt && log "PASS after rollback catalog equals pre-215003" || log "FAIL catalog differs after rollback: $(head -8 /tmp/a2d.txt)"
log "TOTAL pass=$(grep -c '^PASS' $OUT) fail=$(grep -c '^FAIL' $OUT)"
