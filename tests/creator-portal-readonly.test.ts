import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignmentActionable, closedAssignmentCopy, earningsView, sessionExpired } from "../lib/creator-portal.ts";

const d = { signups: 3, commissionCents: { pending: 500, validated: 1200, paid: 0 }, conversions: { gathering_pass: 2 }, minPayoutCents: 5000 };

test("earnings view is null (no numbers at all) unless paid referrals are live and the member is eligible", () => {
  assert.equal(earningsView(d, false), null);
});
test("earnings view is read-only rows with honest labels", () => {
  const v = earningsView(d, true)!;
  assert.equal(v.signups, "3");
  assert.deepEqual(v.commissions.map((c) => c.label), ["Pending", "Validated", "Paid (recorded manually)"]);
  assert.equal(v.commissions[1].value, "$12.00"); assert.equal(v.minPayout, "$50.00");
  assert.equal(earningsView({ ...d, signups: null, minPayoutCents: null }, true)!.signups, "n/a");
});
test("expired/closed assignments are read-only: copy shown, no respond/submit action", () => {
  assert.match(closedAssignmentCopy("expired")!, /expired/);
  for (const s of ["expired", "cancelled", "closed", "declined", "completed", "weird"]) assert.equal(assignmentActionable(s), null, s);
  assert.equal(assignmentActionable("offered"), "respond"); assert.equal(assignmentActionable("accepted"), "submit");
  assert.equal(closedAssignmentCopy("offered"), null);
});
test("session expiry detection", () => {
  assert.equal(sessionExpired({ message: "JWT expired" }), true);
  assert.equal(sessionExpired({ status: 401 }), true);
  assert.equal(sessionExpired({ message: "Auth session missing!" }), true);
  assert.equal(sessionExpired(null), false);
});
test("creator page wires the expired states and the read-only view; no new RPC, no mutation in the results section", () => {
  const src = readFileSync(new URL("../app/(creator)/creator/page.tsx", import.meta.url), "utf8");
  assert.match(src, /sessionExpired\(authError\)/); assert.match(src, /earningsView\(d, paidLive\)/); assert.match(src, /closedAssignmentCopy\(a\.status\)/);
  const rpcs = [...src.matchAll(/rpc\("(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(rpcs)], ["claim_my_membership", "creator_portal_summary", "creator_program_status"]);
  const res = src.slice(src.indexOf('aria-labelledby="res"'), src.indexOf('aria-labelledby="onb"'));
  assert.ok(!/ActionForm|<form|<button/.test(res));
});
