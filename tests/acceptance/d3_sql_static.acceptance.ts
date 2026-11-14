// D3 DB-layer static check (runtime proof pending scratch-Postgres run / QA): the DB itself must refuse to record "paid" without an external reference.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const DIR = "/home/claude/pp-work/CCHC/src";
const fn = (name: string) => { const sql = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql") && !/ROLLBACK/i.test(f)).map((f) => fs.readFileSync(`${DIR}/${f}`, "utf8")).join("\n"); const m = new RegExp(`function public\\.${name}\\b[\\s\\S]*?\\$\\$;?[\\s\\S]*?\\$\\$`, "i").exec(sql); return m?.[0] ?? ""; };
test("D3 DB: hc_mark_payout_paid rejects a null/empty external reference itself (not only the UI)", { skip: !fs.existsSync(DIR) }, () => {
  const b = fn("hc_mark_payout_paid"); assert.ok(b, "function not found");
  assert.match(b, /(external_ref|p_external_ref)[\s\S]{0,200}(is null|= ''|length|btrim|trim)[\s\S]{0,200}(raise|exception)/i, "GAP: DB accepts paid without a reference; D3 enforced in UI only");
});
test("D3 DB: hc_mark_payout_paid only transitions approved -> paid (approved != paid, no skipping)", { skip: !fs.existsSync(DIR) }, () => {
  assert.match(fn("hc_mark_payout_paid"), /status\s*=\s*'approved'/i);
});
test("D3 DB: hc_approve_payout only transitions draft -> approved", { skip: !fs.existsSync(DIR) }, () => {
  assert.match(fn("hc_approve_payout"), /status\s*=\s*'draft'/i);
});
