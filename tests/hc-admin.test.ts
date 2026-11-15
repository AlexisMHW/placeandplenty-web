import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { decideAccess } from "../lib/admin/access.ts";
import {
  hcCapabilities, parseApplications, parseCommissionReport, parseMembers, parseNotifications,
  parsePayoutEligibility, parseReviewForm, parseSubmissionReviewForm, parseSubmissions, dollars,
} from "../lib/admin/hc.ts";

// Context shapes mirror get_my_staff_context() after 210000 + 214002. Synthetic data only.
const ctx = (role: string, permissions: string[]) => ({ role, permissions });
const OWNER = ctx("owner", ["overview.read", "hc.read", "hc.manage", "hc.applications.review", "hc.content.review", "hc.payout"]);
const CPM = ctx("creator_program_manager", ["overview.read", "hc.read", "hc.manage", "hc.applications.review", "hc.content.review"]);
const BIZ = ctx("business_admin", ["overview.read", "hc.read"]);
const SUPPORT = ctx("support", ["support.read", "support.manage"]);
const MARKETING = ctx("marketing_pr", ["overview.read", "marketing.read"]);

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
const UUID = "11111111-2222-4333-8444-555555555555";

test("anonymous visitor goes to login for every HC permission", () => {
  for (const p of ["hc.read", "hc.manage", "hc.applications.review", "hc.content.review"] as const)
    assert.deepEqual(decideAccess({ signedIn: false, rawContext: OWNER }, p), { kind: "login" });
});

test("a creator (signed in, not staff) gets not_found for every HC page and action permission", () => {
  for (const p of ["hc.read", "hc.manage", "hc.applications.review", "hc.content.review"] as const)
    assert.deepEqual(decideAccess({ signedIn: true, rawContext: null }, p), { kind: "not_found" });
});

test("a creator cannot invent a staff role or permission by sending one", () => {
  assert.deepEqual(decideAccess({ signedIn: true, rawContext: ctx("creator", ["hc.read"]) }, "hc.read"), { kind: "not_found" });
  assert.deepEqual(decideAccess({ signedIn: true, rawContext: ctx("business_admin", ["hc.applications.review.all"]) }, "hc.applications.review"), { kind: "not_found" });
});

test("support and marketing staff cannot open any HC page", () => {
  for (const c of [SUPPORT, MARKETING]) assert.equal(decideAccess({ signedIn: true, rawContext: c }, "hc.read").kind, "not_found");
});

test("business_admin can read HC but cannot review or manage", () => {
  assert.equal(decideAccess({ signedIn: true, rawContext: BIZ }, "hc.read").kind, "allow");
  for (const p of ["hc.manage", "hc.applications.review", "hc.content.review"] as const)
    assert.equal(decideAccess({ signedIn: true, rawContext: BIZ }, p).kind, "not_found");
});

test("program manager and owner can review; capability flags follow permissions only", () => {
  for (const c of [CPM, OWNER]) {
    assert.equal(decideAccess({ signedIn: true, rawContext: c }, "hc.applications.review").kind, "allow");
    assert.equal(decideAccess({ signedIn: true, rawContext: c }, "hc.content.review").kind, "allow");
  }
  const biz = hcCapabilities({ role: "business_admin", permissions: ["hc.read"] });
  assert.deepEqual(biz, { canView: true, canManage: false, canReviewApplications: false, canReviewContent: false, canViewPayouts: false, canSeePayoutActions: false });
  assert.equal(hcCapabilities({ role: "owner", permissions: ["hc.payout"] }).canSeePayoutActions, true);
  // Decision A: hc.payout without the owner role = read-only payout history; the owner role without hc.payout = nothing.
  const fin = hcCapabilities({ role: "business_admin", permissions: ["hc.read", "hc.payout"] });
  assert.equal(fin.canViewPayouts, true); assert.equal(fin.canSeePayoutActions, false);
  const ownerNoPerm = hcCapabilities({ role: "owner", permissions: ["hc.read"] });
  assert.equal(ownerNoPerm.canViewPayouts, false); assert.equal(ownerNoPerm.canSeePayoutActions, false);
});

test("review form: valid approve, decline, and every rejection path", () => {
  assert.deepEqual(parseReviewForm(form({ id: UUID, decision: "approved", tier: "founding", code: "My-Code", note: " ok " })),
    { ok: true, value: { id: UUID, decision: "approved", tier: "founding", note: "ok", code: "my-code" } });
  assert.equal(parseReviewForm(form({ id: UUID, decision: "declined" })).ok, true);
  const bad = (o: Record<string, string>) => { const r = parseReviewForm(form(o)); return r.ok ? "ok" : r.error; };
  assert.equal(bad({ id: "nope", decision: "approved", tier: "t1" }), "invalid_id");
  assert.equal(bad({ id: UUID, decision: "deleted" }), "invalid_decision");
  // phase 2: no tier is needed; approving without one makes a BASIC member (the database holds commissions for a NULL tier)
  assert.deepEqual(parseReviewForm(form({ id: UUID, decision: "approved" })), { ok: true, value: { id: UUID, decision: "approved", tier: null, note: null, code: null } });
  assert.equal(bad({ id: UUID, decision: "approved", tier: "Bad Tier" }), "invalid_tier");
  assert.equal(bad({ id: UUID, decision: "approved", tier: "founding", code: "a!" }), "invalid_code_format");
  assert.equal(bad({ id: UUID, decision: "declined", note: "x".repeat(1001) }), "note_too_long");
  assert.equal(bad({ decision: "approved", tier: "founding" }), "invalid_id");
});

test("submission review form validates decision and note", () => {
  assert.equal(parseSubmissionReviewForm(form({ id: UUID, decision: "approved" })).ok, true);
  assert.equal(parseSubmissionReviewForm(form({ id: UUID, decision: "paid" })).ok, false);
  assert.equal(parseSubmissionReviewForm(form({ id: UUID, decision: "rejected", note: "x".repeat(1001) })).ok, false);
});

test("application parsing skips unclassifiable rows and flags duplicates; never un-masks email", () => {
  const rows = parseApplications([
    { id: "a", full_name: "A", email: "***@example.test", status: "received", niches: ["budget_hosting"], platforms: [{ platform: "instagram", handle: "@a" }], duplicate_signals: ["handle_overlap"] },
    { id: "b", status: "weird" }, null, 5, { status: "received" },
  ]);
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0].email, "***@example.test");
  assert.equal(rows?.[0].possibleDuplicate, true);
  assert.equal(parseApplications({ not: "array" }), null);
  assert.equal(parseApplications(null), null);
});

test("members, submissions, notifications: malformed rows dropped, missing numbers become null (not zero)", () => {
  const m = parseMembers([{ partner_id: "p", status: "approved", signups: "7" }, { status: "x" }]);
  assert.equal(m?.length, 1); assert.equal(m?.[0].signups, null); assert.equal(m?.[0].accountLinked, false);
  assert.equal(parseSubmissions([{ id: "s", url: "https://example.test/a", active_permissions: ["organic_repost", 4] }])?.[0].activePermissions.length, 1);
  assert.equal(parseNotifications([{ id: 1, kind: "application_received", severity: "action" }, { id: "x" }])?.length, 1);
  assert.equal(parseMembers("x"), null);
});

test("payout eligibility: 'live' comes only from the database; malformed payload is rejected; amounts never invented", () => {
  assert.equal(parsePayoutEligibility({ program_enabled: true, rate_configured: true, partners: [] })?.live, false);
  const p = parsePayoutEligibility({ program_enabled: false, rate_configured: false, live: false, min_payout_cents: 5000,
    partners: [{ partner_id: "p", display_name: "P", pending_cents: 100, eligible: true }] });
  assert.equal(p?.partners[0].validatedCents, null);
  assert.equal(p?.partners[0].eligible, true);
  assert.equal(parsePayoutEligibility({ program_enabled: "yes" }), null);
  assert.equal(dollars(null), "n/a"); assert.equal(dollars(188), "$1.88");
});

test("commission report parsing keeps only well-formed state buckets", () => {
  const r = parseCommissionReport({ enabled: false, rate_configured: false, held_count: 0,
    partners: [{ partner_id: "p", display_name: "P", status: "approved", signups: 2, by_state: { pending: { n: 1, cents: 188 }, bad: { n: "x" } } }] });
  assert.deepEqual(r?.partners[0].byState, { pending: { n: 1, cents: 188 } });
  assert.equal(r?.enabled, false);
  assert.equal(parseCommissionReport({}), null);
});

// ---- source-level guards: the same style of check the Command Center suite uses ----
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const HC_DIR = "app/(command-center)/command-center/hosting-collective";

test("every HC page requires hc.read and every server action requires its own permission BEFORE any rpc", () => {
  const pages = walk(HC_DIR).filter((f) => f.endsWith("page.tsx"));
  assert.equal(pages.length, 8); // applications, content, members, overview, payouts, campaigns, tiers, inbox
  for (const f of pages) assert.match(readFileSync(f, "utf8"), /payouts[\\/]page\.tsx$/.test(f) ? /requireStaff\("hc\.payout"/ : /requireStaff\("hc\.read"/, f); // payouts needs hc.payout (decision A)
  const actions = readFileSync(join(HC_DIR, "actions.ts"), "utf8");
  const fns = actions.split(/export async function /).slice(1);
  assert.equal(fns.length, 3);
  for (const fn of fns) assert.ok(fn.indexOf("requireStaff(") > -1 && fn.indexOf("requireStaff(") < Math.min(...[".rpc(", "submitApplicationReview("].map((t) => fn.indexOf(t) < 0 ? Infinity : fn.indexOf(t))), fn.slice(0, 40)); // reviewApplication reaches its single rpc through lib/hc/review-flow.ts
  assert.match(actions, /requireStaff\("hc\.applications\.review"/);
  assert.match(actions, /requireStaff\("hc\.content\.review"/);
  assert.match(actions, /requireStaff\("hc\.manage"/);
});

test("HC module never uses a service-role key, a direct table write, or forwards database error text", () => {
  for (const f of [...walk(HC_DIR), "lib/admin/hc.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /service_role|SERVICE_ROLE|supabaseAdmin|createAdminClient/i, f);
    assert.doesNotMatch(src, /\.from\(["'`]/, `${f} must use RPCs only`);
    assert.doesNotMatch(src, /error\.message\s*[,)}]\s*$/m, f);
  }
  assert.doesNotMatch(readFileSync(join(HC_DIR, "actions.ts"), "utf8"), /code:\s*error\.message/);
});

test("no HC file sends email; payout controls exist ONLY in the payouts page/actions and only behind hc.payout", () => {
  for (const f of walk(HC_DIR)) assert.doesNotMatch(readFileSync(f, "utf8"), /send[_ ]email|sendEmail/i, f);
  for (const f of walk(HC_DIR).filter((x) => !/[\\/]payouts[\\/](page\.tsx|actions\.ts)$/.test(x))) assert.doesNotMatch(readFileSync(f, "utf8"), /mark[_ ]paid|mark_payout_paid|approve[_ ]payout|hc_approve_payout/i, f);
  const payoutsPage = readFileSync(join(HC_DIR, "payouts", "page.tsx"), "utf8");
  assert.match(payoutsPage, /caps\.canSeePayoutActions/);
  assert.doesNotMatch(payoutsPage, /sendEmail|stripe/i);
});
