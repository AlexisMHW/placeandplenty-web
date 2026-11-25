import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAVE_COPY, canLeave, parseLeaveResult, parseMembershipOverview, parseReapplyForm, parseReinstateForm, reinstateNeeds } from "../lib/hc/membership.ts";
import { feedbackMessage } from "../lib/hc/lifecycle.ts";
import { readFileSync } from "node:fs";
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

test("reinstate form needs a valid id, the confirm box and a 3-500 character reason; acknowledgements are optional here (the database enforces them)", () => {
  const base = { partner_id: ID, confirm: "yes", reason: "reviewed by staff" };
  const ok = parseReinstateForm(fd(base)); assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.value, { partnerId: ID, reason: "reviewed by staff", ackSuspension: false, ackTerms: false });
  const both = parseReinstateForm(fd({ ...base, ack_suspension: "yes", ack_terms: "yes" })); assert.ok(both.ok && both.value.ackSuspension && both.value.ackTerms);
  assert.ok(!parseReinstateForm(fd({ ...base, partner_id: "x" })).ok);
  assert.ok(!parseReinstateForm(fd({ ...base, confirm: "" })).ok);
  assert.deepEqual(parseReinstateForm(fd({ ...base, reason: "ab" })), { ok: false, error: "reason_required" });
  assert.deepEqual(parseReinstateForm(fd({ ...base, reason: "x".repeat(501) })), { ok: false, error: "reason_required" });
});

test("reinstate form shows the suspension and terms acknowledgements only where they apply", () => {
  assert.deepEqual(reinstateNeeds({ leftFromStatus: "suspended", tier: "collective_member" }, ["hosting_partner"]), { suspension: true, terms: false });
  assert.deepEqual(reinstateNeeds({ leftFromStatus: "approved", tier: "hosting_partner" }, ["hosting_partner"]), { suspension: false, terms: true });
  assert.deepEqual(reinstateNeeds({ leftFromStatus: "approved", tier: null }, ["hosting_partner"]), { suspension: false, terms: false });
});

test("reinstatement error codes have safe staff text", () => {
  for (const c of ["suspension_ack_required", "terms_ack_required", "no_current_terms", "tier_inactive", "use_reinstatement", "not_left", "reason_required"]) assert.notEqual(feedbackMessage(c), feedbackMessage("failed"), c);
});

test("the staff reinstatement action and screen are gated and only call the reviewed function", () => {
  const act = readFileSync(new URL("../app/(command-center)/command-center/hosting-collective/form-actions.ts", import.meta.url), "utf8");
  const fn = act.slice(act.indexOf("export async function reinstateLeftMemberForm"), act.indexOf("export async function sweepDraftsForm"));
  assert.match(fn, /requireStaff\("hc\.manage"/);
  assert.match(fn, /rpc\("hc_admin_reinstate_left_member"/);
  assert.doesNotMatch(fn, /paid_referrals|hc_activate|hc_set_partner_status|hc_admin_assign_tier|commission|service_role/i);
  const page = readFileSync(new URL("../app/(command-center)/command-center/hosting-collective/members/page.tsx", import.meta.url), "utf8");
  assert.match(page, /caps\.canManage \? \(\(\) => \{ const need = reinstateNeeds/);
  assert.match(page, /name="confirm" value="yes" required/);
});
