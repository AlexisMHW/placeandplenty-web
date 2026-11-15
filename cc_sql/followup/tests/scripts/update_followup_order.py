#!/usr/bin/env python3
# Regenerates followup/FOLLOWUP_ORDER.tsv (+ FOLLOWUP_ORDER.json) with sha256_12 checksums of every follow-up migration, same columns as the main APPLY_ORDER.tsv.
# usage: update_followup_order.py <followup dir> ; verify mode: update_followup_order.py <followup dir> --check (exit 1 on mismatch)
import sys, os, json, hashlib
D=sys.argv[1]; check='--check' in sys.argv
ROWS=[("20261114217490_hc_partial_refund_hold_resolution.sql","F1 follow-up J (owner-controlled partial-refund hold resolution: release|reverse, sweep respects it; Gate 8 prerequisite)","ROLLBACK_217490.sql"),
      ("20261114217491_hc_payout_draft_owner_only.sql","F2 follow-up J (hc_create_payout_draft owner-only at the database; hc.payout stays view-only)","ROLLBACK_217491.sql")]
def sha(rel): return hashlib.sha256(open(os.path.join(D,rel),'rb').read()).hexdigest()[:12]
lines=["step\tfile\tsha256_12\tphase\trollback"]
for i,(n,ph,rb) in enumerate(ROWS,1):
    assert os.path.exists(os.path.join(D,'rollback',rb)), rb
    lines.append("\t".join([str(i),"src/"+n,sha("src/"+n),ph,rb]))
# CORRECTED replacements for shipped rollbacks / verify (REPORT_r-rehearsal D1-D6). Listed with checksums; step "R<n>", rollback column "-" (they are not forward steps).
REPL=[("rollback/ROLLBACK_20261114145911_CORRECTED.sql","replaces ROLLBACK_20261114145911.sql (D4 orphan normalize_entitlement_event_source)"),
      ("rollback/ROLLBACK_207000_CORRECTED.sql","replaces ROLLBACK_207000.sql (D5 exact QA bodies of save/remove_invitation_artwork)"),
      ("rollback/ROLLBACK_202000_202004_CORRECTED.sql","replaces ROLLBACK_202000_202004.sql (D1 QA create_gathering_invitation body f840f1f4e6b8, D2 policy count, D4 orphan cohost_gathering_column_capability)"),
      ("rollback/ROLLBACK_217201_CORRECTED.sql","replaces ROLLBACK_217201.sql (D3 QA bodies of the paper-order functions)"),
      ("verify/01_pre_apply_readonly_CORRECTED.sql","replaces verify/01_pre_apply_readonly.sql (D6 section C only checks functions that exist on QA)")]
for j,(rel,ph) in enumerate(REPL,1):
    assert os.path.exists(os.path.join(D,rel)), rel
    lines.append("\t".join(["R"+str(j),rel,sha(rel),ph,"-"]))
tsv="\n".join(lines)+"\n"; js=json.dumps([r[0] for r in ROWS],indent=1)+"\n"
if check:
    ok = open(os.path.join(D,'FOLLOWUP_ORDER.tsv')).read()==tsv and open(os.path.join(D,'FOLLOWUP_ORDER.json')).read()==js
    print("FOLLOWUP_ORDER check:", "OK" if ok else "MISMATCH"); sys.exit(0 if ok else 1)
open(os.path.join(D,'FOLLOWUP_ORDER.tsv'),'w').write(tsv); open(os.path.join(D,'FOLLOWUP_ORDER.json'),'w').write(js); print(tsv)
