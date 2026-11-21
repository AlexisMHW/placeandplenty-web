import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAVE_COPY, canLeave, parseLeaveResult, parseMembershipOverview, parseReapplyForm } from "../lib/hc/membership.ts";
import { memberStatusCopy } from "../lib/hc/lifecycle.ts";
import { EVENT_LABELS } from "../lib/hc/events.ts";

const fd = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const ID = "9920e9ac-d809-4288-9e49-8686a941d1a9";

test("leave dialog uses the founder's exact English wording and has Spanish", () => {
  assert.equal(LEAVE_COPY.en.title, "Leave the Hosting Collective?");
  assert.equal(LEAVE_COPY.en.body[0], "We're sorry to see you go! You can leave the Hosting Collective whenever you'd like.");
  assert.equal(LEAVE_COPY.en.body[1], "Leaving will end your community membership and access to member-only features. Your Place & Plenty account and gatherings will not be affected.");
  assert.equal(LEAVE_COPY.en.body[2], "If you're a Hosting Partner, any outstanding commissions will remain subject to the program's payout and eligibility terms.");
  assert.equal(LEAVE_COPY.en.keep, "Keep My Membership");
  assert.equal(LEAVE_COPY.en.leave, "Leave the Collective");
  assert.ok(LEAVE_COPY.es.title.length > 5 && LEAVE_COPY.es.body.length === 3);
});
test("only approved or paused members can leave", () => {
  assert.ok(canLeave("approved") && canLeave("suspended"));
  for (const s of ["applied", "declined", "left", null, undefined]) assert.ok(!canLeave(s as any));
});
test("leave result parsing is strict", () => {
  assert.deepEqual(parseLeaveResult({ status: "left", outstanding_commissions: true }), { status: "left", already: false, outstandingCommissions: true });
  assert.equal(parseLeaveResult({ status: "nope" }), null);
  assert.equal(parseLeaveResult(null), null);
});
test("left status has copy and events are labelled", () => {
  assert.equal(memberStatusCopy("left")?.title, "You have left the Hosting Collective");
  assert.ok("member_left" in EVENT_LABELS && "application_draft_expiring" in EVENT_LABELS);
});
test("membership overview parsing drops malformed rows and defaults the rules", () => {
  const o = parseMembershipOverview({ left_members: [{ partner_id: "p1", display_name: "A", outstanding_commissions: true }, { nope: 1 }], drafts: [], declined: [{ application_id: "a1", full_name: "B", override: "weird" }], settings: {} });
  assert.equal(o?.leftMembers.length, 1);
  assert.equal(o?.declined[0].override, null);
  assert.deepEqual(o?.settings, { reapplyWaitDays: 90, draftExpiryDays: 30, draftNoticeDays: 7 });
  assert.equal(parseMembershipOverview({}), null);
});
test("reapply form needs a valid id, mode and reason", () => {
  assert.ok(parseReapplyForm(fd({ application_id: ID, mode: "allowed", reason: "ok to retry" })).ok);
  assert.ok(!parseReapplyForm(fd({ application_id: "x", mode: "allowed", reason: "ok" })).ok);
  assert.ok(!parseReapplyForm(fd({ application_id: ID, mode: "bad", reason: "okay" })).ok);
  assert.ok(!parseReapplyForm(fd({ application_id: ID, mode: "blocked", reason: "" })).ok);
});
