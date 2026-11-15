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
