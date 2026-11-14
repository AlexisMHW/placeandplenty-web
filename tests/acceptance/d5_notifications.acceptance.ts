// D5 (founder): two channels. (A) Command Center persistent inbox (permission-controlled). (B) configurable founder business email - destination NOT hardcoded,
// send only after destination+delivery verified. Dedup, severity, delivery-status tracking, retry, audit. Minimal sensitive data in email. queued != delivered.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { read, walk } from "./helpers.ts";
import { applicationApprovedMessage, applicationDeclinedMessage } from "../../lib/hc/notifications.ts";

const SQL_DIRS = (process.env.ACCEPT_SQL_DIRS ?? "/home/claude/pp-work/CCHC/src:/home/claude/pp-work/CCHC/out/proposed:/home/claude/pp-work/COMMS/out").split(":").filter((d) => fs.existsSync(d));
const sqlText = () => SQL_DIRS.flatMap((d) => fs.readdirSync(d, { recursive: true } as never) as unknown as string[]).filter((f) => String(f).endsWith(".sql") && !/ROLLBACK/i.test(String(f))).map((f) => { for (const d of SQL_DIRS) { try { return fs.readFileSync(`${d}/${f}`, "utf8"); } catch {} } return ""; }).join("\n");

test("D5 creator messages: minimal data - no money, tax, legal, secrets, or contact data beyond a link", () => {
  const msgs = [applicationApprovedMessage("Sam", "https://example.test/creator"), applicationDeclinedMessage("Sam", "note")];
  for (const m of msgs) { assert.doesNotMatch(m.subject + m.text, /(\$\s?\d|\d\s?%|commission|payout|tax|1099|W-?9|contract|bps)/i); assert.doesNotMatch(m.text, /[\w.+-]+@[\w-]+\.[\w.]+/); }
});
test("D5 channel B: the founder email destination is not hard-coded anywhere in app code", () => {
  const files = [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => !/\.test\.|legal|privacy|terms|support|marketing|content/i.test(f));
  const bad = files.flatMap((f) => (read(f).match(/[A-Za-z0-9._%+-]+@(placeandplenty\.com|yahoo\.com|gmail\.com|arsqd\.com)/g) ?? []).filter((m) => !/^(support|hello|privacy|legal)@/i.test(m)).map((m) => `${f}: ${m}`));
  assert.deepEqual(bad, [], "a literal business/founder address is embedded in code (destination must be configuration, verified before use)");
});
test("D5 channel A: inbox is permission-controlled and acknowledgeable", () => {
  const a = read("app/(command-center)/command-center/hosting-collective/actions.ts");
  assert.match(a, /requireStaff\("hc\.manage"/);
  assert.match(a, /hc_admin_ack_notification/);
});
test("D5 channel A schema: notification rows carry severity, a dedup key and a delivery-status field", { todo: "founder inbox table not implemented yet (A3/A4)" }, () => {
  const s = sqlText();
  const m = /create table (?:if not exists )?public\.(?:hc_)?(?:admin_)?notifications?[\s\S]*?\);/i.exec(s);
  assert.ok(m, "no notifications table definition found in proposed SQL");
  for (const col of [/severity/i, /(dedup|dedupe|dedupe_key|fingerprint)/i, /(delivery_status|email_status|delivered_at|attempts)/i]) assert.match(m![0], col);
});
test("D5 categories: every founder-notification category has an event source", { todo: "producers not implemented yet (A3/A4/A2)" }, () => {
  const s = sqlText().toLowerCase();
  for (const c of ["application_submitted", "application_awaiting", "application_approved", "application_declined", "member_onboarded", "content_submitted", "payout_needs_approval", "comms_failed", "system_failure"]) {
    assert.ok(s.includes(c), `category '${c}' has no producer in the proposed SQL`);
  }
});
test("D5: email channel status vocabulary keeps queued distinct from delivered", { todo: "email founder-notification sender not implemented yet (A3+A4)" }, () => {});
