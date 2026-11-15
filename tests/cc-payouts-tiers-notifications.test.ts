// A3: manual payout screens (D3), tier/terms/status screens (D4), founder inbox + email settings (D5), D2 read-only guard, no hardcoded address.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parsePayoutActionForm, parsePayouts } from "../lib/admin/cc.ts";
import { BUCKET_LABEL, LEDGER_BUCKETS, eventLabel, parseHistory, parseLedger, payoutStatusLabel } from "../lib/admin/payout-ledger.ts";
import { parseAssignTierForm, parseConfigAudit, parsePaidSwitchForm, parseStatusForm, parseTermsHistory, parseTierForm, parseTiers } from "../lib/admin/tiers.ts";
import { categoryLabel, deliveryLabel, parseCounts, parseDeliveries, parseDestinationForm, parseEmailToggleForm, parseInbox, parseRetryForm, parseSettings, parseStateForm, parseThresholdsForm, parseVerifyForm } from "../lib/admin/notifications.ts";
import { knownCode, messageFor } from "../lib/admin/messages.ts";

const root = process.cwd();
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return n === "node_modules" || n === ".next" ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
const fd = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
const UUID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = new Date("2026-11-14T12:00:00Z");

test("payout form 'paid': needs reference (4+), method, a real non-future date within a year, and explicit confirmation", () => {
  const base = { kind: "paid", payout_id: UUID, external_ref: "BANK-REF-1", method: "bank transfer", paid_on: "2026-11-10", confirm: "yes" };
  const r = (o: Record<string, string>) => { const x = parsePayoutActionForm(fd({ ...base, ...o }), NOW); return x.ok ? "ok" : x.error; };
  assert.equal(r({}), "ok");
  assert.equal(r({ paid_on: "2026-11-15" }), "invalid_paid_on");          // future
  assert.equal(r({ paid_on: "2025-11-13" }), "invalid_paid_on");          // older than a year
  assert.equal(r({ paid_on: "2026-02-30" }), "invalid_paid_on");          // not a real date
  assert.equal(r({ paid_on: "" }), "invalid_paid_on");
  assert.equal(r({ paid_on: "2026-11-14" }), "ok");                       // today is allowed
  assert.equal(r({ method: "" }), "invalid_method");
  assert.equal(r({ external_ref: "abc" }), "invalid_reference");
  assert.equal(r({ confirm: "" }), "confirmation_required");
  assert.equal(r({ confirm: "on" }), "confirmation_required");
  assert.deepEqual(parsePayoutActionForm(fd({ kind: "reverse", payout_id: UUID, reason: "bank returned it", confirm: "yes" }), NOW), { ok: true, value: { kind: "reverse", payoutId: UUID, reason: "bank returned it" } });
  assert.equal((parsePayoutActionForm(fd({ kind: "reverse", payout_id: UUID, reason: "ab", confirm: "yes" }), NOW) as { error: string }).error, "invalid_reason");
  assert.equal((parsePayoutActionForm(fd({ kind: "reverse", payout_id: UUID, reason: "bank returned it" }), NOW) as { error: string }).error, "confirmation_required");
});

test("payout rows keep reversed/paid distinct; approved is never labelled paid", () => {
  const rows = parsePayouts([{ id: UUID, partner_id: UUID, total_cents: 5000, status: "reversed", reversed_reason: "returned", external_method: "bank" }]);
  assert.equal(rows?.[0].status, "reversed"); assert.equal(rows?.[0].reversalReason, "returned");
  assert.match(payoutStatusLabel("approved"), /not paid/i);
  assert.doesNotMatch(payoutStatusLabel("draft"), /paid\b(?! yet)/i);
  assert.equal(payoutStatusLabel("paid"), "Paid (recorded)");
});

test("ledger keeps five buckets separate and drops malformed partners; totals are never summed here", () => {
  const b = (n: number) => ({ pending_cents: n, validated_cents: n + 1, draft_cents: n + 2, approved_cents: n + 3, paid_cents: n + 4 });
  const l = parseLedger({ totals: { ...b(1), unrated_count: 2, held_count: 3, outstanding_clawback_cents: 0 }, partners: [{ partner_id: UUID, display_name: "A", status: "approved", ...b(10) }, { partner_id: "x", pending_cents: "no" }], note: "n" });
  assert.ok(l); assert.equal(l!.partners.length, 1);
  assert.deepEqual(LEDGER_BUCKETS.map((k) => l!.totals[k]), [1, 2, 3, 4, 5]);
  assert.equal(Object.keys(l!.totals).some((k) => /^total/i.test(k)), false);
  assert.match(BUCKET_LABEL.approved, /not yet paid/i);
  assert.equal(parseLedger({ totals: { pending_cents: 1 }, partners: [] }), null);
  assert.equal(parseLedger(null), null);
});

test("history parser reads the 216100 shape (payout_id, events) and ignores junk", () => {
  const h = parseHistory([{ payout_id: UUID, partner_id: UUID, status: "paid", total_cents: 100, paid_on: "2026-11-10", external_ref: "R-1", external_method: "bank", commissions: 2, events: [{ event: "drafted", at: "2026-11-01T00:00:00Z" }, { event: 5 }] }, { status: "x" }]);
  assert.equal(h?.length, 1); assert.equal(h![0].events.length, 1); assert.equal(h![0].commissionCount, 2);
  assert.equal(eventLabel("approved"), "Approved (not paid)");
  assert.equal(parseHistory("x"), null);
});

test("tier forms: key/name/benefit limits, reasons required, paid eligibility is just a flag the DATABASE gates to the owner", () => {
  const ok = { slug: "founding", label: "Founding", reason: "new tier", benefits: "A\nB", active: "yes" };
  const r = (o: Record<string, string>) => { const x = parseTierForm(fd({ ...ok, ...o })); return x.ok ? "ok" : x.error; };
  assert.equal(r({}), "ok");
  assert.equal(r({ slug: "Bad Key" }), "invalid_slug"); assert.equal(r({ slug: "a" }), "invalid_slug");
  assert.equal(r({ label: "" }), "invalid_label"); assert.equal(r({ reason: "" }), "invalid_reason");
  assert.equal(r({ benefits: Array.from({ length: 13 }, (_, i) => `b${i}`).join("\n") }), "invalid_benefits");
  assert.equal(r({ benefits: "<b>x</b>" }), "invalid_benefits");
  assert.equal(r({ description: "<script>" }), "invalid_text");
  assert.equal(r({ sort_order: "x" }), "invalid_sort");
  const v = parseTierForm(fd({ ...ok, paid_referrals_eligible: "yes" }));
  assert.ok(v.ok && v.value.benefits.length === 2 && !("paidReferralsEligible" in v.value), "tier form never carries eligibility");
  assert.equal(parseAssignTierForm(fd({ partner_id: UUID, tier: "", reason: "welcome" })).ok, true);
  assert.equal((parseAssignTierForm(fd({ partner_id: "x", tier: "", reason: "welcome" })) as { error: string }).error, "invalid_id");
  assert.equal((parseAssignTierForm(fd({ partner_id: UUID, tier: "a b", reason: "welcome" })) as { error: string }).error, "invalid_slug");
  assert.equal((parseAssignTierForm(fd({ partner_id: UUID, tier: "", reason: "" })) as { error: string }).error, "invalid_reason");
  assert.equal(parseStatusForm(fd({ partner_id: UUID, status: "suspended", reason: "policy" })).ok, true);
  assert.equal((parseStatusForm(fd({ partner_id: UUID, status: "declined", reason: "policy" })) as { error: string }).error, "invalid_state");
});

test("paid-referrals switch: activation needs the exact typed phrase and a reason; deactivation needs only a reason", () => {
  assert.equal((parsePaidSwitchForm(fd({ mode: "activate", reason: "go", phrase: "activate paid referrals" })) as { error: string }).error, "invalid_reason");
  assert.equal((parsePaidSwitchForm(fd({ mode: "activate", reason: "launch", phrase: "activate paid referrals" })) as { error: string }).error, "confirmation_required");
  assert.equal(parsePaidSwitchForm(fd({ mode: "activate", reason: "launch", phrase: "ACTIVATE PAID REFERRALS" })).ok, true);
  assert.deepEqual(parsePaidSwitchForm(fd({ mode: "deactivate", reason: "pause it" })), { ok: true, value: { on: false, phrase: "", reason: "pause it" } });
});

test("terms history and config audit parsers: before/after summarised, amounts never invented", () => {
  const t = parseTermsHistory([{ version: 1, validation_days: 45, min_payout_cents: 5000, in_force: true, amounts: { gathering_pass: 50, bad: "x" } }, { nope: 1 }]);
  assert.equal(t?.length, 1); assert.deepEqual(t![0].amounts, { gathering_pass: 50 });
  const c = parseConfigAudit([{ id: 2, at: "2026-11-14T10:00:00Z", entity: "partner", entity_key: UUID, action: "update", before: { tier: null, status: "approved" }, after: { tier: "silver", status: "approved" }, reason: "welcome" }, { id: "bad" }]);
  assert.equal(c?.length, 1); assert.match(c![0].summary, /tier: none → silver/); assert.doesNotMatch(c![0].summary, /status/); assert.equal(c![0].reason, "welcome");
  const tiers = parseTiers([{ slug: "a", label: "A", benefits: ["x", 5], paid_referrals_eligible: true, member_count: 2 }, { slug: 5 }]);
  assert.equal(tiers?.length, 1); assert.deepEqual(tiers![0].benefits, ["x"]); assert.equal(tiers![0].paidReferralsEligible, true);
  assert.equal(parseTiers([{ slug: "a", label: "A" }])![0].paidReferralsEligible, false);   // default OFF when absent
});

test("inbox parsers: only known severities/statuses, links limited to /command-center paths, counts parsed", () => {
  const items = parseInbox([
    { id: 1, category: "hc_application_received", severity: "info", title: "New", status: "open", link: "/command-center/hosting-collective/applications", occurrences: 3 },
    { id: 2, category: "x", severity: "urgent", title: "bad severity", status: "open" },
    { id: 3, category: "system_failure", severity: "critical", title: "Link evil", status: "open", link: "https://evil.example/x" },
    { id: 4, severity: "info", title: "No status" },
  ]);
  assert.equal(items?.length, 2);
  assert.equal(items![0].occurrences, 3); assert.equal(items![1].link, null);
  assert.deepEqual(parseCounts({ open: 2, critical: 1, warning: 1 }), { open: 2, critical: 1, warning: 1 });
  assert.equal(parseCounts({}), null); assert.equal(parseInbox("x"), null);
  assert.equal(categoryLabel("hc_payout_needs_approval"), "Payout needs approval"); assert.equal(categoryLabel("zzz"), "Notification");
});

test("notification settings: masked address passes through unchanged, state parsed strictly", () => {
  const s = parseSettings({ destination: "f***@b***.example", destination_status: "pending_verification", email_enabled: false, email_min_severity: "warning", awaiting_review_hours: 48, payout_approval_hours: 24, can_manage: false, email_pending_count: 1 });
  assert.ok(s); assert.equal(s!.destination, "f***@b***.example"); assert.equal(s!.canManage, false);
  assert.equal(parseSettings({ destination_status: "bogus" }), null);
  assert.equal(parseSettings({ destination: null, destination_status: "unset", email_enabled: false, email_min_severity: "info", awaiting_review_hours: 1, payout_approval_hours: 1 })!.destinationStatus, "unset");
});

test("delivery labels never blur queued / sent / delivered, and match the dispatcher's operator wording", () => {
  const labels = ["queued", "sent", "delivered", "delayed", "failed", "bounced", "suppressed"].map(deliveryLabel);
  assert.equal(new Set(labels).size, labels.length);
  assert.match(deliveryLabel("queued"), /not yet handed/i); assert.match(deliveryLabel("sent"), /not confirmed/i); assert.match(deliveryLabel("delivered"), /^Delivered/);
  const rows = parseDeliveries([{ id: 1, kind: "verification", status: "queued", attempts: 0 }, { id: 2, status: "failed", attempts: 2, last_error: "timeout", retryable: true, title: "T" }, { status: "x" }]);
  assert.equal(rows?.length, 2); assert.equal(rows![1].retryable, true); assert.equal(rows![0].kind, "verification");
  assert.ok(!("payload" in rows![0]) && !("destination" in rows![0]));
});

test("notification forms validate: address, 8-hex code, severity, hours, ids, states", () => {
  assert.equal((parseDestinationForm(fd({ email: "nope" })) as { error: string }).error, "invalid_email");
  assert.deepEqual(parseDestinationForm(fd({ email: " Owner@Biz.Example " })), { ok: true, value: { email: "owner@biz.example" } });
  assert.equal((parseDestinationForm(fd({ email: "a@b.c<script>" })) as { error: string }).error, "invalid_email");
  assert.equal(parseVerifyForm(fd({ code: "ABCDEF12" })).ok, true);
  assert.equal(parseVerifyForm(fd({ code: "xyz" })).ok, false);
  assert.equal(parseEmailToggleForm(fd({ enabled: "yes", min_severity: "critical" })).ok, true);
  assert.equal(parseEmailToggleForm(fd({ enabled: "yes", min_severity: "loud" })).ok, false);
  assert.equal(parseThresholdsForm(fd({ awaiting_review_hours: "48", payout_approval_hours: "24" })).ok, true);
  assert.equal(parseThresholdsForm(fd({ awaiting_review_hours: "0", payout_approval_hours: "24" })).ok, false);
  assert.equal(parseThresholdsForm(fd({ awaiting_review_hours: "721", payout_approval_hours: "24" })).ok, false);
  assert.equal(parseStateForm(fd({ id: "5", state: "resolved" })).ok, true);
  assert.equal(parseStateForm(fd({ id: "5", state: "deleted" })).ok, false);
  assert.equal(parseStateForm(fd({ id: "-1", state: "resolved" })).ok, false);
  assert.equal(parseRetryForm(fd({ id: "7" })).ok, true); assert.equal(parseRetryForm(fd({ id: "x" })).ok, false);
});

test("error text: only mapped codes reach people; unknown database text becomes the generic line; no raw SQL words leak", () => {
  assert.equal(knownCode("ERROR: payout_not_approved"), "payout_not_approved");
  assert.equal(knownCode('permission denied for table payouts "xyz"'), "failed");
  assert.equal(knownCode(null), "failed");
  assert.match(messageFor("payout_not_approved"), /Approved does not mean paid/);
  assert.match(messageFor("something_unmapped"), /did not work/);
  assert.match(messageFor(undefined), /did not work/);
  assert.match(messageFor("paid_referrals_not_active"), /switched off/);
});

test("payout_contains_reversed_commission (approve / record payment refused after a refund or dispute) has a friendly message", () => {
  const want = "A refund or dispute affects this payout. Void it and draft a new one.";
  assert.equal(messageFor("payout_contains_reversed_commission"), want);
  // as raised by hc_approve_payout / hc_record_external_payment (P0001), with and without database decoration
  assert.equal(knownCode("payout_contains_reversed_commission"), "payout_contains_reversed_commission");
  assert.equal(knownCode("ERROR: payout_contains_reversed_commission (SQLSTATE P0001)"), "payout_contains_reversed_commission");
  assert.equal(messageFor(knownCode('{"code":"P0001","message":"payout_contains_reversed_commission"}')), want);
  assert.doesNotMatch(want, /P0001|ERROR|sql/i);
  // it is a refusal, never the generic failure line and never "saved"
  assert.notEqual(messageFor("payout_contains_reversed_commission"), messageFor("failed"));
  assert.notEqual(messageFor("payout_contains_reversed_commission"), messageFor("saved"));
});

test("payouts actions route approve / record-payment database errors through knownCode, so the new code reaches the owner", () => {
  const src = readFileSync(join(root, "app", "(command-center)", "command-center", "hosting-collective", "payouts", "actions.ts"), "utf8");
  assert.match(src, /import \{ knownCode \} from "@\/lib\/admin\/messages"/);
  assert.match(src, /if \(res\.error\) return \{ ok: false, code: knownCode\(res\.error\.message\) \}/);
});

const ccApp = walk(join(root, "app", "(command-center)")).filter((f) => /\.(ts|tsx)$/.test(f));
const ownSources = [...ccApp, ...walk(join(root, "lib", "admin")).filter((f) => f.endsWith(".ts"))];

test("the founder notification address is never hardcoded in source, tests or SQL we ship", () => {
  const files = [...ownSources, ...walk(join(root, "cc_sql")).filter((f) => f.endsWith(".sql") || f.endsWith(".sh"))];
  for (const f of files) assert.ok(!/@placeandplenty\.com/i.test(readFileSync(f, "utf8")), `${f} contains a business address`);
});

test("no Command Center code sends email/SMS, calls a payment provider, or mutates gatherings (D2 read-only; SMS stays off)", () => {
  for (const f of ownSources) {
    const src = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    assert.ok(!/(from|import)\s*\(?\s*"[^"]*(resend|telnyx|twilio|sendgrid|nodemailer|stripe|revenuecat|brevo)[^"]*"|fetch\(\s*["`]https?:/i.test(src), `${f}: provider import or outbound call`);
    assert.ok(!/\.from\(\s*"(gatherings|gathering_[a-z_]+|invitations?|guest_[a-z_]+|menu_[a-z_]+)"\s*\)\s*\.(insert|update|upsert|delete)/.test(src), `${f}: writes a gathering table`);
    for (const m of src.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) assert.ok(!/gathering|invitation|cohost|co_host|menu_|guest_/.test(m[1]), `${f}: gathering-related rpc ${m[1]}`);
  }
});

test("every write action returns a code (never database text) and each form shows its result", () => {
  for (const f of ccApp.filter((x) => /actions\.ts$/.test(x))) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/(code|message|error)\s*:\s*error\.message/.test(src), `${f}: forwards raw error text`);
  }
  for (const f of ccApp.filter((x) => /page\.tsx$/.test(x))) assert.ok(!/"use server"; await/.test(readFileSync(f, "utf8")), `${f}: inline server wrapper discards the result`);
});

test("pages never show a button without an unavailable/empty state: each new page handles null parser results", () => {
  for (const rel of ["inbox/page.tsx", "inbox/settings/page.tsx", "hosting-collective/tiers/page.tsx", "hosting-collective/payouts/page.tsx"]) {
    const src = readFileSync(join(root, "app/(command-center)/command-center", rel), "utf8");
    assert.match(src, /=== null|!e \|\| !r/, `${rel}: no unavailable state`);
    assert.match(src, /role="(alert|status)"/, `${rel}: no accessible status`);
  }
});

test("notification settings page shows the address only as returned (masked by the database unless staff.manage); verification code is never rendered", () => {
  const src = readFileSync(join(root, "app/(command-center)/command-center/inbox/settings/page.tsx"), "utf8");
  assert.ok(!/verification_code|code_hash|payload/.test(src));
  assert.match(src, /requireStaff\("ops\.read"/);
  const act = readFileSync(join(root, "app/(command-center)/command-center/inbox/actions.ts"), "utf8");
  assert.equal((act.match(/requireStaff\("staff\.manage"/g) ?? []).length, 5);
});
