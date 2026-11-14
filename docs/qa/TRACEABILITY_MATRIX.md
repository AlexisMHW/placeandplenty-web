# Traceability (status: impl / local-test / QA-deployed / QA-verified / prod-ready; last three = NO for everything today)
| Feature | Tests | Status |
|---|---|---|
| D1 serving calc pinned | native regression (pending A6 worked example) | NOT STARTED |
| D2 read-only | d2_readonly (web), DB scan pending | web: 3/5 pass, candidates open |
| D3 manual payouts | d3_payout (7/7 pass), d3_sql_static (1 gap) | impl+local-test partial |
| D4 tiers/terms/referrals off | d4_tiers (6/7 pass) | impl+local-test partial |
| D5 notifications | d5 (2 pass, 1 fail, 3 todo) | not implemented |
| Offline build | run_build.sh | local-test PASS 106/106 |
