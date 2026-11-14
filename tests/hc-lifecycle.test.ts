import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applicationCopy, canWithdraw, codeFrom, feedbackMessage, memberStatusCopy, parseProgramStatus, REFERRAL_REASON_COPY } from "../lib/hc/lifecycle.ts";
import { parseAssignmentResponse, parseOnboardingStep, parseSubmissionForm } from "../lib/hc/creator-forms.ts";
import { parseMemberStatusForm, parseMemberTierForm, parseTierForm, parseTiers } from "../lib/hc/tiers.ts";

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
const UUID = "11111111-2222-4333-8444-555555555555";

test("program status: every applicant state has copy; none mentions money, rates or internal notes", () => {
  for (const s of ["received", "in_review", "approved", "declined", "withdrawn"] as const) {
    const c = applicationCopy(s);
    assert.ok(c.title && c.body);
    assert.doesNotMatch(c.title + c.body, /\$|commission|earn|rate|percent|%|payout|note from/i);
  }
});

test("withdraw is offered only while the application is open", () => {
  assert.equal(canWithdraw("received"), true); assert.equal(canWithdraw("in_review"), true);
  for (const s of ["approved", "declined", "withdrawn"] as const) assert.equal(canWithdraw(s), false);
});

test("member states: suspended/applied/declined show copy, approved shows none", () => {
  assert.match(memberStatusCopy("suspended")!.title, /paused/i);
  assert.ok(memberStatusCopy("applied")); assert.ok(memberStatusCopy("declined"));
  assert.equal(memberStatusCopy("approved"), null);
});

test("parseProgramStatus: unknown or malformed input yields no application and no member", () => {
  for (const bad of [null, undefined, 5, "x", [], { application: { status: "bogus" }, member: { status: "root" } }])
    assert.deepEqual(parseProgramStatus(bad), { application: null, member: null });
});

test("parseProgramStatus: member with tier, benefits capped at 12, referral reason carried", () => {
  const p = parseProgramStatus({ application: { status: "approved", submitted_at: "a", decided_at: "b" },
    member: { status: "approved", assignments_enabled: false, tier: { slug: "starter", label: "Starter", description: null, benefits: Array.from({ length: 20 }, (_, i) => `b${i}`).concat([1 as never]) }, referral: { eligible: false, reason: "program_disabled" } } });
  assert.equal(p.application?.status, "approved");
  assert.equal(p.member?.tier?.benefits.length, 12);
  assert.equal(p.member?.assignmentsEnabled, false);
  assert.deepEqual(p.member?.referral, { eligible: false, reason: "program_disabled" });
});

test("basic member (no tier) parses with tier null", () => {
  const p = parseProgramStatus({ application: null, member: { status: "approved", tier: null, assignments_enabled: true, referral: { eligible: false, reason: "basic_member_no_paid_terms" } } });
  assert.equal(p.member?.tier, null);
  assert.match(REFERRAL_REASON_COPY["basic_member_no_paid_terms"], /does not include paid/i);
});

test("feedback: known codes map to text, unknown or database text never leaks", () => {
  assert.match(feedbackMessage("saved"), /saved/i);
  assert.match(feedbackMessage("tier_assignments_disabled"), /tier/i);
  assert.equal(feedbackMessage("ERROR: relation public.partners does not exist"), feedbackMessage("failed"));
  assert.equal(feedbackMessage(undefined), feedbackMessage("failed"));
  assert.equal(codeFrom("P0001: tier_not_configured"), "tier_not_configured");
  assert.equal(codeFrom('relation "x" does not exist'), "failed");
  assert.equal(codeFrom("some thing", /thing/), "thing");
});

test("creator forms: assignment response", () => {
  assert.deepEqual(parseAssignmentResponse(form({ assignment_id: UUID, decision: "accept" })), { ok: true, value: { id: UUID, accept: true } });
  assert.deepEqual(parseAssignmentResponse(form({ assignment_id: UUID, decision: "decline" })), { ok: true, value: { id: UUID, accept: false } });
  assert.equal(parseAssignmentResponse(form({ assignment_id: "x", decision: "accept" })).ok, false);
  assert.equal(parseAssignmentResponse(form({ assignment_id: UUID, decision: "maybe" })).ok, false);
});

test("creator forms: content submission needs https url, known platform, disclosure", () => {
  const base = { assignment_id: UUID, url: "https://example.com/post/1", platform: "instagram", description: "", disclosure: "on" };
  assert.equal(parseSubmissionForm(form(base)).ok, true);
  assert.deepEqual((parseSubmissionForm(form({ ...base, url: "http://example.com/post/1" })) as any).error, "invalid_url");
  assert.deepEqual((parseSubmissionForm(form({ ...base, url: "javascript:alert(1)//aaaa" })) as any).error, "invalid_url");
  assert.deepEqual((parseSubmissionForm(form({ ...base, url: "https://a b.com/xxxx" })) as any).error, "invalid_url");
  assert.deepEqual((parseSubmissionForm(form({ ...base, platform: "myspace" })) as any).error, "invalid_form");
  assert.deepEqual((parseSubmissionForm(form({ ...base, disclosure: "" })) as any).error, "disclosure_required");
  assert.deepEqual((parseSubmissionForm(form({ ...base, description: "x".repeat(1001) })) as any).error, "invalid_form");
});

test("creator forms: onboarding step slug", () => {
  assert.equal(parseOnboardingStep(form({ step: "read-guidelines" })).ok, true);
  assert.equal(parseOnboardingStep(form({ step: "../x" })).ok, false);
});

test("tier form: validation, benefits split and capped, checkboxes", () => {
  const ok = parseTierForm(form({ slug: "starter", label: "Starter", benefits: "A\n\n B \n", referral_eligible: "on", active: "on", sort_order: "5" }));
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.deepEqual(ok.value.benefits, ["A", "B"]); assert.equal(ok.value.referralEligible, true); assert.equal(ok.value.assignmentsEnabled, false); assert.equal(ok.value.sortOrder, 5); }
  assert.deepEqual((parseTierForm(form({ slug: "Bad", label: "Ok" })) as any).error, "invalid_slug");
  assert.deepEqual((parseTierForm(form({ slug: "ab", label: "x" })) as any).error, "invalid_label");
  assert.deepEqual((parseTierForm(form({ slug: "ab", label: "Ok", benefits: Array(13).fill("b").join("\n") })) as any).error, "invalid_benefits");
  assert.deepEqual((parseTierForm(form({ slug: "ab", label: "Ok", sort_order: "-1" })) as any).error, "invalid_form");
});

test("tier form: a new tier defaults to NOT referral-eligible when the box is unchecked (nothing is invented)", () => {
  const r = parseTierForm(form({ slug: "ab", label: "Ok" }));
  assert.equal(r.ok && r.value.referralEligible, false);
});

test("member tier/status forms", () => {
  assert.deepEqual(parseMemberTierForm(form({ partner_id: UUID, tier: "" })), { ok: true, value: { partnerId: UUID, tier: null } });
  assert.equal(parseMemberTierForm(form({ partner_id: UUID, tier: "Bad Tier" })).ok, false);
  assert.equal(parseMemberStatusForm(form({ partner_id: UUID, status: "suspended" })).ok, true);
  assert.equal(parseMemberStatusForm(form({ partner_id: UUID, status: "declined" })).ok, false);
});

test("parseTiers tolerates junk", () => {
  assert.equal(parseTiers("x"), null);
  assert.deepEqual(parseTiers([{ slug: 1 }, null, { slug: "a", label: "A", benefits: ["x", 2], referral_eligible: true, members: 3 }]), [
    { slug: "a", label: "A", description: null, eligibilityNotes: null, benefits: ["x"], referralEligible: true, assignmentsEnabled: true, sortOrder: 0, active: true, members: 3 }]);
});

test("static: HC forms show feedback (no discarded server-action result) and the creator portal makes no commission promise", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const base = "app/(command-center)/command-center/hosting-collective";
  for (const f of ["applications/page.tsx", "payouts/page.tsx", "content/page.tsx", "campaigns/page.tsx", "members/page.tsx", "tiers/page.tsx", "inbox/page.tsx"]) {
    const s = read(`${base}/${f}`);
    assert.doesNotMatch(s, /<form\b/, `${f} must use ActionForm so results are visible`);
    assert.match(s, /ActionForm/);
  }
  const portal = read("app/(creator)/creator/page.tsx");
  assert.doesNotMatch(portal, /\d+\s?%|per sale|per referral|\$\d/, "no rates or amounts in portal copy");
  assert.match(portal, /paidLive/, "money is gated on paid referrals being live");
  // the tier page never offers a commission rate field
  // read-only terms history may show minimum payout; no input may edit a commission rate
  assert.doesNotMatch(read(`${base}/tiers/page.tsx`), /name="(commission|rate)[a-z_]*"|commission_rate|rate_percent/i);
});
