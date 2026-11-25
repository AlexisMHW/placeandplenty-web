import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REJOIN_COPY, canLeave, canRejoin, parseRejoinResult, parseMembershipOverview } from "../lib/hc/membership.ts";
import { composeMessage, EVENT_LABELS, type ClaimedDelivery } from "../lib/hc/events.ts";
import { applicationReceiptMessage, memberLeftMessage, memberRejoinedMessage, applicationDraftExpiringMessage } from "../lib/hc/notifications.ts";
import { feedbackMessage, codeFrom } from "../lib/hc/lifecycle.ts";

const SITE = "https://qa.example.test";
const del = (kind: string, channel: ClaimedDelivery["channel"] = "applicant_email"): ClaimedDelivery =>
  ({ id: 1, event_id: 1, channel, destination_id: null, attempts: 0, kind, ref_type: "partner", ref_id: "x", severity: "info" } as ClaimedDelivery);
const HIDDEN_GROUP_ID = "1471379654953632";

test("rejoin is offered only to a member who left; leave only to approved or paused", () => {
  for (const s of ["approved", "suspended", "applied", "declined", null, undefined]) assert.equal(canRejoin(s), false, String(s));
  assert.equal(canRejoin("left"), true);
  assert.equal(canLeave("left"), false);
  assert.equal(canLeave("approved") && canLeave("suspended"), true);
});

test("rejoin result parsing is strict", () => {
  assert.deepEqual(parseRejoinResult({ status: "approved", rejoined: true, tier: "collective_member" }), { status: "approved", already: false, rejoined: true, tier: "collective_member" });
  assert.equal(parseRejoinResult({ status: "approved", already: true })?.already, true);
  for (const bad of [null, "x", {}, { status: "left" }, { status: "applied" }]) assert.equal(parseRejoinResult(bad), null);
});

test("rejoin copy exists in English and Spanish and never promises instant return or money", () => {
  for (const l of ["en", "es"] as const) { assert.ok(REJOIN_COPY[l].title && REJOIN_COPY[l].body && REJOIN_COPY[l].button); assert.doesNotMatch(REJOIN_COPY[l].body, /\$|comision|commission/i); }
  assert.match(REJOIN_COPY.en.body, /review/);
});

test("feedback codes for rejoin have safe copy and map from database errors", () => {
  assert.match(feedbackMessage("rejoined"), /Welcome back/);
  assert.match(feedbackMessage("requires_staff_review"), /review/);
  assert.equal(codeFrom("requires_staff_review"), "requires_staff_review");
  assert.equal(codeFrom("not_left"), "not_left");
  assert.equal(codeFrom("some database detail"), "failed");
});

test("lifecycle emails compose for every queued applicant kind and unknown kinds send nothing", () => {
  const r = { email: "a@example.test", display_name: "Ada", kind: "" };
  for (const k of ["application_receipt", "member_left", "member_rejoined", "application_draft_expiring"]) {
    const m = composeMessage(del(k), { ...r, kind: k }, SITE);
    assert.ok(m && m.subject && m.text, k);
  }
  assert.equal(composeMessage(del("payout_needs_approval"), r, SITE), null);
  assert.equal(composeMessage(del("member_suspended"), r, SITE), null);   // suspension is staff-only: the member gets no automatic email
});

test("lifecycle emails contain no money terms, no social links and no private-group invitation", () => {
  const all = [applicationReceiptMessage("Ada"), memberLeftMessage("Ada", `${SITE}/creator`), memberRejoinedMessage("Ada", `${SITE}/creator`), applicationDraftExpiringMessage(`${SITE}/creator`, 7)];
  for (const m of all) {
    const t = m.subject + "\n" + m.text;
    assert.doesNotMatch(t, /\$\s?\d|\d+\s?%|commission|payout|referral link/i, m.subject);
    assert.doesNotMatch(t, /facebook|fb\.com|instagram|group/i, m.subject);
    assert.ok(!t.includes(HIDDEN_GROUP_ID));
    assert.doesNotMatch(t, /https?:\/\/(?!qa\.example\.test)/, "only the site's own portal link");
  }
});

test("staff emails for the new kinds are minimal (no names, no address) and labelled", () => {
  for (const k of ["member_rejoined", "application_receipt"]) {
    assert.ok(EVENT_LABELS[k]);
    const m = composeMessage(del(k, "staff_email"), { email: "s@example.test", kind: k }, SITE)!;
    assert.doesNotMatch(m.text, /Ada|@/);
  }
});

test("staff overview tolerates a database without rejoined_members and parses it when present", () => {
  const base = { left_members: [], drafts: [], declined: [], settings: { reapply_wait_days: 90, draft_expiry_days: 30, draft_notice_days: 7 } };
  assert.deepEqual(parseMembershipOverview(base)!.rejoinedMembers, []);
  const o = parseMembershipOverview({ ...base, rejoined_members: [{ partner_id: "p1", display_name: "Cy", tier: "collective_member", rejoined_at: "2026-11-25T10:00:00Z" }, { nope: 1 }] })!;
  assert.equal(o.rejoinedMembers.length, 1);
  assert.equal(o.rejoinedMembers[0].displayName, "Cy");
});

// ---------- permissions matrix: who can call what (source-level, deterministic) ----------
const read = (p: string) => readFileSync(p, "utf8");
test("permissions: the rejoin action is signed-in only, uses one RPC with the user's own session, and never the service role", () => {
  const a = read("app/(creator)/creator/actions.ts");
  const body = a.slice(a.indexOf("export async function rejoinCollective"), a.indexOf("export async function respondToAssignment"));
  assert.match(body, /authed\(\)/);
  assert.match(body, /rpc\("creator_rejoin_collective"\)/);
  assert.doesNotMatch(body, /service|SERVICE_ROLE|createAdmin/i);
  assert.doesNotMatch(body, /partner_id|p_tier|p_status/, "the member never supplies a tier or a status");
});

test("permissions: the rejoin button renders only for the left state", () => {
  const page = read("app/(creator)/creator/page.tsx");
  assert.match(page, /canRejoin\(program\.member\?\.status\)/);
  assert.equal((page.match(/<RejoinCollective/g) ?? []).length, 1);
});

// ---------- the hidden Hosting Partners group link must never reach a public page ----------
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "tests", "test-results", "playwright-report"].includes(n)) continue;
    const p = join(dir, n); const s = statSync(p);
    if (s.isDirectory()) walk(p, out); else if (/\.(tsx?|jsx?|json|md|mdx|html|txt|xml)$/.test(n)) out.push(p);
  }
  return out;
}
test("the hidden Hosting Partners Facebook group id appears in no public route, component, lib file or static asset", () => {
  const hits = [...walk("app"), ...walk("components"), ...walk("lib"), ...walk("public")].filter((f) => read(f).includes(HIDDEN_GROUP_ID));
  assert.deepEqual(hits, []);
});

test("public marketing routes link only to the PUBLIC Collective group, and never to any other Facebook group", () => {
  const PUBLIC_GROUP_ID = "1613918510052135";
  const files = walk("app/(marketing)").concat(walk("components/hc-landing"), ["lib/hc/community.ts"]);
  for (const f of files) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");   // comments are not shipped to visitors
    for (const m of code.matchAll(/facebook\.com\/groups\/([^/"'\s?)]+)/gi)) assert.equal(m[1], PUBLIC_GROUP_ID, `${f}: ${m[0]}`);
    assert.doesNotMatch(code, /hosting[- ]partners? (facebook )?group/i, f);
  }
});
