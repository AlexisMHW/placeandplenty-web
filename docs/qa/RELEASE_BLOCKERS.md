# Release blockers (reproduced by an executable test unless marked)
| ID | Finding | Evidence | Owner |
|---|---|---|---|
| F-PREVIEW | No code guard stops a preview build using prod Supabase | audit_findings F-PREVIEW fails | A5 |
| F-HC-EMAIL | HC approve/decline sends no creator email | F-HC-EMAIL fails | A2/A4 |
| F-FEEDBACK | 12 staff forms discard server-action results | F-FEEDBACK fails | A3 |
| F-CREATOR | Creator portal is a skeleton | F-CREATOR fails | A2 |
| D2-UI | 5 lib files call mutating RPCs with no read-only awareness (shopping, recipe-source, share-by-text, multi-day move, gather_again). Heuristic: callers/DB may guard; DB test NOT RUN | d2 test 8 | A5/A1 |
| D3-DB | hc_mark_payout_paid accepts null/empty reference (UI-only enforcement) | d3_sql_static fails | A1/A7 |
| D4-AUDIT | No audited tier-reassignment function after approval | d4 test fails | A2/A1 |
| D5-HARDCODE | lib/checklist-delivery.ts hardcodes a founder address (pre-existing; channel B must be config) | d5 test fails | A4 |
| D5-NOTIF | Founder inbox table and producers not implemented (todo tests) | d5 todo | A3/A4 |
| P0-SQL | HC/CC/COMMS/COHOST SQL not durable on GitHub; 47 client RPCs missing in QA, 51 in prod | contract_check_result.json | A1 |
| NOT RUN | All authenticated QA journeys, payments/RevenueCat, email/SMS delivery, native device flows | - | needs QA gate |
