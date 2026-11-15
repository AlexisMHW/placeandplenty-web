# Follow-up package (agent J) - applies AFTER the reviewed 61-step main package

The main package (`../APPLY_ORDER.tsv`, `../ORDER.json`, `../src`, `../rollback`) is NOT edited. This folder is a separate, ordered, idempotent follow-up with its own checksums.

| step | file | what | rollback |
|---|---|---|---|
| F1 | `src/20261114217490_hc_partial_refund_hold_resolution.sql` | owner-controlled release / reverse of commissions held for a partial refund review; the sweep respects a recorded release | `rollback/ROLLBACK_217490.sql` |
| F2 | `src/20261114217491_hc_payout_draft_owner_only.sql` | `hc_create_payout_draft` becomes owner-only at the database (matches the web) | `rollback/ROLLBACK_217491.sql` |

Order, checksums: `FOLLOWUP_ORDER.tsv` / `FOLLOWUP_ORDER.json` (regenerate / verify with `python3 tests/scripts/update_followup_order.py . [--check]`).
Tests: `tests/ts217490.sql`, `tests/ts217491.sql`. Scratch scripts: `tests/scripts/` (`apply_followup.sh`, `rb_followup.sh`, `run_suite.sh`). Scratch Postgres only.
Web copies are byte-identical under `cc_sql/followup/` in the web repo.

## GATE 8 PREREQUISITE
Paid referrals must NOT be enabled (`hc_activate_paid_referrals`) until the follow-up is applied and verified. Without F1 a commission held for a partial refund has no release path.

## Who can do what (database = web)
| action | database rule | web rule |
|---|---|---|
| view payout list / history / ledger / eligibility | `hc.payout` | `hc.payout` (page 404 otherwise) |
| view partial-refund holds (`hc_admin_list_partial_refund_holds`) | `hc.payout` | `hc.payout` (read-only for non-owner) |
| draft a payout (`hc_create_payout_draft`) | `hc.payout` AND `hc_is_owner()` (F2; was hc.payout only) | owner only (`requirePayoutOwner`), NOT_FOUND otherwise |
| approve / record external payment / void / reverse payment / settle clawback | `hc.payout` AND `hc_is_owner()` (217430) | owner only |
| release / reverse a partial-refund hold (`hc_resolve_partial_refund_hold`) | `hc_is_owner()` (F1), note + confirmation required | owner only |
| switch paid referrals on / off | `hc.payout` (unchanged, see report) | owner only |
| `hc.read`-only manager | denied everywhere above | NOT_FOUND |

`hc_is_owner()` is true only for an ACTIVE staff member with role `owner`. Nothing in this package moves money; "approved" is not "paid".

## Partial-refund hold resolution (F1) in one paragraph
`record_purchase_partial_refund` holds a commission (`held` / `partial_refund_review`). The owner decides: **release** returns it to `pending` (reason `partial_refund_released`) and it follows the normal path, validating only after its original purchase + 45 days and payable only through the normal owner-only draft / approve / record; the sweep and maintenance no longer re-hold it. **reverse** is terminal. Release is refused with an explicit error for an open dispute (`dispute_open`), lost dispute, full refund, invalid entitlement, or a commission already in a payout (`commission_in_payout`: payable / paid; use the payout controls). Replaying a decision is a no-op (`already_resolved`); the opposite decision afterwards is refused (`already_resolved_differently`). A LARGER partial refund than the amount the owner reviewed holds the commission again.

## CORRECTED rollbacks and verify (REPORT_r-rehearsal D1-D6)
The shipped rollbacks stay untouched in `../rollback/`. On a QA-faithful database they fail or leave residue, so use these replacements (map and checksums: `ROLLBACK_REPLACEMENTS.tsv`, rows R1-R5 of `FOLLOWUP_ORDER.tsv`):

| defect | problem on QA | replacement |
|---|---|---|
| D1 | ROLLBACK_202000_202004 aborts: step 4 replaces the whole `create_gathering_invitation` body (production read-only guard), so QA's md5 f840f1f4e6b8 cannot be reached by removing one line | `rollback/ROLLBACK_202000_202004_CORRECTED.sql` re-creates QA's own body verbatim and asserts md5 f840f1f4e6b8 |
| D2 | same rollback: final check counted QA's own policy `guest_update_receipts_member_select` as "new-style" | same file, counts only policies the package created |
| D3 | ROLLBACK_217201 did not restore QA's 3 paper-order function bodies (whitespace) | `rollback/ROLLBACK_217201_CORRECTED.sql` restores them verbatim (md5 asserted) and still drops what 217201 itself created |
| D4 | orphans: `cohost_gathering_column_capability(text)` (202002) and `normalize_entitlement_event_source()` (step 1) | dropped in `ROLLBACK_202000_202004_CORRECTED.sql` and `rollback/ROLLBACK_20261114145911_CORRECTED.sql` (QA only) |
| D5 | ROLLBACK_207000 restored save/remove_invitation_artwork equal only modulo whitespace | `rollback/ROLLBACK_207000_CORRECTED.sql` restores QA's exact text (md5 asserted) |
| D6 | verify/01 section C listed 14 functions, only 3 exist on QA | `verify/01_pre_apply_readonly_CORRECTED.sql`: C1 = the 24 functions the package replaces with QA's expected md5 and match / DIFFERENT / absent; C2 = informational list of functions the package creates |

Run the whole rollback (follow-up first, then the 61 steps newest-first, corrected files substituted): `tests/scripts/rollback_all_corrected.sh <db> <log> [min_step] [max_step] [with_followup]` (`USE_SHIPPED=1` = negative control). The shipped `ROLLBACK_202000_202004.sql` is not idempotent (precondition: step 202001 applied), and neither is its corrected version; the other three corrected files can be run twice.
Proof on a QA-faithful replica: `tests/scripts/prove_rollback_roundtrip.sh <template_db> <workdir>`; recorded result `tests/results/rollback_roundtrip_result.txt`, the 24 changed functions `tests/results/changed_functions_md5.tsv`.
Ledger rows (`supabase_migrations.schema_migrations`) are never deleted by any rollback; after a rollback delete the rows of the rolled-back versions yourself, or the next apply by ledger will skip them.
