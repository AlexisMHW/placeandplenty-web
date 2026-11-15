import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  entitlementStatus, growthWindow, parseAlerts, parseComms, parseFinancial, parseGrowthFunnel, parseHealth, parseKindParam, parseLookup,
  parseLookupForm, parsePayoutActionForm, parsePayouts, parsePurchaseEvents, parseTermsForm, pctOfFirst, smsState, visibleAlerts,
} from "../lib/admin/cc.ts";

const fd = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });
const UUID = "11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-11-14T12:00:00Z");

test("alerts: only known Command Center links render, malformed rows are dropped, action sorts first", () => {
  const rows = parseAlerts({ alerts: [
    { key: "a", severity: "review", count: 2, text: "x", href: "/command-center/comms" },
    { key: "b", severity: "action", count: 1, text: "y", href: "/command-center/purchases" },
    { key: "evil", severity: "action", count: 1, text: "z", href: "https://evil.example/phish" },
    { key: "nocount", severity: "action", text: "z", href: "/command-center/purchases" },
    "junk", null,
  ] });
  assert.deepEqual(rows?.map((r) => r.key), ["b", "a"]);
  assert.equal(parseAlerts(null), null);
  assert.equal(parseAlerts({ alerts: "no" }), null);
});

test("alerts: links the staff member cannot open are hidden", () => {
  const rows = parseAlerts({ alerts: [
    { key: "a", severity: "review", count: 1, text: "x", href: "/command-center/purchases" },
    { key: "b", severity: "review", count: 1, text: "y", href: "/command-center/hosting-collective/applications" } ] })!;
  assert.deepEqual(visibleAlerts(rows, ["overview.read", "hc.read"]).map((r) => r.key), ["b"]);
  assert.deepEqual(visibleAlerts(rows, ["overview.read"]).length, 0);
});

test("growth funnel: parses stages, never divides by zero, unknown stays n/a", () => {
  const f = parseGrowthFunnel({ window: { from: "a", to: "b" }, registered: 40, email_confirmed: 30, paid_conversion: 4, notes: ["n1", 5] });
  assert.equal(f?.stages[0].count, 40);
  assert.equal(f?.stages.find((s) => s.key === "rsvp_received")?.count, null);
  assert.deepEqual(f?.notes, ["n1"]);
  assert.equal(pctOfFirst(10, 40), "25%");
  assert.equal(pctOfFirst(10, 0), "n/a");
  assert.equal(pctOfFirst(null, 40), "n/a");
  assert.equal(parseGrowthFunnel({}), null);
  assert.equal(parseGrowthFunnel(null), null);
});

test("growth window: only 7, 30 or 90 days; anything else is 30; window ends now", () => {
  assert.equal(growthWindow("7", NOW).days, 7);
  assert.equal(growthWindow("1000", NOW).days, 30);
  assert.equal(growthWindow(undefined, NOW).days, 30);
  assert.equal(growthWindow(["90", "7"], NOW).days, 90);
  assert.equal(growthWindow("30", NOW).to, NOW.toISOString());
});

test("customer lookup form: accepts an exact email or an id, rejects everything else (no wildcard search)", () => {
  assert.deepEqual(parseLookupForm(fd({ q: " Person@Example.com " })), { ok: true, query: "Person@Example.com" });
  assert.equal(parseLookupForm(fd({ q: UUID })).ok, true);
  for (const bad of ["", "ab", "per", "%", "person@", "@example.com", "a b@example.com", "x".repeat(300) + "@e.co"]) assert.equal(parseLookupForm(fd({ q: bad })).ok, false, bad);
  assert.equal(parseLookupForm(fd({})).ok, false);
});

test("customer lookup result: refund and revocation beat 'active'; expiry is respected", () => {
  const base = { id: "e", product: "plus_annual", provider: "web", environment: "production", active: true, purchasedAt: null, expiresAt: null, refundedAt: null, revokedAt: null };
  assert.equal(entitlementStatus(base, NOW), "active");
  assert.equal(entitlementStatus({ ...base, refundedAt: "2026-11-01" }, NOW), "refunded");
  assert.equal(entitlementStatus({ ...base, revokedAt: "2026-11-01" }, NOW), "revoked");
  assert.equal(entitlementStatus({ ...base, active: false }, NOW), "inactive");
  assert.equal(entitlementStatus({ ...base, expiresAt: "2026-11-01T00:00:00Z" }, NOW), "expired");
  assert.equal(entitlementStatus({ ...base, expiresAt: "2027-11-01T00:00:00Z" }, NOW), "active");
  const r = parseLookup({ found: true, user_id: UUID, email_masked: "cu***@example.test", email_confirmed: true, entitlements: [{ id: "x", canonical_product_id: "gathering_pass", active: true }, { nope: 1 }], events: null });
  assert.ok(r && r.found && r.entitlements.length === 1 && r.events === null);
  assert.deepEqual(parseLookup({ found: false }), { found: false });
  assert.equal(parseLookup({ found: "maybe" }), null);
  assert.equal(parseLookup({ found: true }), null);
});

test("purchase events: unavailable is explicit; bad kinds are never forwarded", () => {
  assert.deepEqual(parsePurchaseEvents({ available: false }), { available: false, rows: [], kinds: [] });
  const e = parsePurchaseEvents({ available: true, rows: [{ id: "1", event_type: "refund", user_id: UUID }, { id: "2" }], kinds: ["refund", "x; drop"] });
  assert.equal(e?.rows.length, 1);
  assert.deepEqual(e?.kinds, ["refund"]);
  assert.equal(parseKindParam("refund"), "refund");
  assert.equal(parseKindParam("Refund;"), null);
  assert.equal(parseKindParam(undefined), null);
  assert.equal(parseKindParam(["duplicate_purchase", "x"]), "duplicate_purchase");
});

test("comms monitor: SMS is 'off' if EITHER the flag is off or the kill switch is on; unknown stays unknown", () => {
  const mk = (flags: unknown, avail = true) => parseComms({ email: { available: false }, sms: { available: avail, flags } })!;
  assert.equal(smsState(mk({ sms_enabled: false, kill_switch: true })), "off");
  assert.equal(smsState(mk({ sms_enabled: true, kill_switch: true })), "off");
  assert.equal(smsState(mk({ sms_enabled: false, kill_switch: false })), "off");
  assert.equal(smsState(mk({ sms_enabled: true, kill_switch: false })), "on");
  assert.equal(smsState(mk({})), "unknown");
  assert.equal(smsState(mk({ sms_enabled: true, kill_switch: false }, false)), "unknown");
  assert.equal(parseComms({ email: {} }), null);
  const c = parseComms({ email: { available: true, provider_events_7d: { "email.bounced": 3, bad: -1, worse: "x" } }, sms: { available: false } });
  assert.deepEqual(c?.emailEvents7d, { "email.bounced": 3 });
});

test("integration health: never claims an external service is healthy; quiet or missing data is unknown, not ok", () => {
  const rows = parseHealth({ payment_ledger: { available: false }, entitlement_events: { available: true, last_web_event_at: null, rejected_24h: 2 } }, NOW)!;
  assert.ok(rows.some((r) => r.label.includes("External dashboards") && r.tone === "unknown"));
  assert.equal(rows.find((r) => r.label.startsWith("Last web"))?.tone, "unknown");
  assert.equal(rows.find((r) => r.label.startsWith("Rejected grants"))?.tone, "watch");
  const ok = parseHealth({ payment_ledger: { available: true, last_stripe_event_at: "2026-11-14T11:30:00Z", last_revenuecat_event_at: null, unusual_outcomes_24h: 0 } }, NOW)!;
  assert.equal(ok.find((r) => r.label.includes("Stripe"))?.value, "less than an hour ago");
  assert.equal(ok.find((r) => r.label.includes("RevenueCat"))?.tone, "unknown");
  assert.equal(parseHealth({ error: "schema_mismatch" }, NOW), null);
  assert.equal(parseHealth(null, NOW), null);
});

test("financial summary: revenue is never invented; absent sections are null", () => {
  const f = parseFinancial({ window_days: 30, purchases_by_product: { plus_annual: { paid: 3, refunded: 1 } }, revenue_amounts: null,
    revenue_amounts_note: "Not stored.", referred_purchases: { available: false }, hosting_collective_liability: { available: true, commissions_by_state: { pending: { n: 2, cents: 2400 } }, payouts_by_status: {} } })!;
  assert.deepEqual(f.products, [{ product: "plus_annual", paid: 3, refunded: 1 }]);
  assert.equal(f.referred, null);
  assert.deepEqual(f.commissionStates, [{ state: "pending", n: 2, cents: 2400 }]);
  assert.equal(f.revenueNote, "Not stored.");
  assert.ok(!("revenue" in f));
  assert.equal(parseFinancial({}), null);
  assert.ok(parseFinancial({ window_days: 7 })!.revenueNote.length > 0);
});

test("payout forms: every action is validated; 'paid' needs a reference AND explicit confirmation; nothing implies money moves", () => {
  assert.deepEqual(parsePayoutActionForm(fd({ kind: "draft", partner_id: UUID })), { ok: true, value: { kind: "draft", partnerId: UUID } });
  assert.deepEqual(parsePayoutActionForm(fd({ kind: "approve", payout_id: UUID })), { ok: true, value: { kind: "approve", payoutId: UUID } });
  const bad = (o: Record<string, string>) => { const r = parsePayoutActionForm(fd(o)); return r.ok ? "ok" : r.error; };
  assert.equal(bad({ kind: "draft", partner_id: "x" }), "invalid_id");
  assert.equal(bad({ kind: "approve" }), "invalid_id");
  assert.equal(bad({ kind: "paid", payout_id: UUID, external_ref: "abc", method: "bank", paid_on: "2026-11-01", confirm: "yes" }), "invalid_reference");
  assert.equal(bad({ kind: "paid", payout_id: UUID, external_ref: "<script>", method: "bank", paid_on: "2026-11-01", confirm: "yes" }), "invalid_reference");
  assert.equal(bad({ kind: "paid", payout_id: UUID, external_ref: "bank-ref-1", method: "bank", paid_on: "2026-11-01" }), "confirmation_required");
  assert.equal(bad({ kind: "paid", payout_id: UUID, external_ref: "bank-ref-1", method: "bank", paid_on: "2026-11-01", confirm: "yes" }), "ok");
  assert.equal(bad({ kind: "void", payout_id: UUID, reason: "" }), "invalid_reason");
  assert.equal(bad({ kind: "void", payout_id: UUID, reason: "disputed order" }), "ok");
  assert.equal(bad({ kind: "refund", payout_id: UUID }), "invalid_kind");
  assert.equal(bad({}), "invalid_kind");
  const rows = parsePayouts([{ id: UUID, partner_id: UUID, total_cents: 6000, status: "draft", display_name: "A" }, { id: UUID, partner_id: UUID, total_cents: 1, status: "weird" }, { id: UUID, partner_id: UUID, total_cents: "1", status: "paid" }]);
  assert.equal(rows?.length, 1);
  assert.equal(parsePayouts("x"), null);
});

test("terms form: needs explicit confirmation, whole-cent amounts for known products only, and a FUTURE effective time", () => {
  const ok = { confirm: "yes", amount_plus_annual: "1500", validation_days: "45", min_payout_cents: "5000", effective_from: "2026-12-01T00:00", note: "n" };
  const r = parseTermsForm(fd(ok), NOW);
  assert.ok(r.ok && r.value.amounts.plus_annual === 1500 && !("gathering_pass" in r.value.amounts));
  const bad = (o: Record<string, string>) => { const x = parseTermsForm(fd({ ...ok, ...o }), NOW); return x.ok ? "ok" : x.error; };
  assert.equal(bad({ confirm: "" }), "confirmation_required");
  assert.equal(bad({ amount_plus_annual: "12.50" }), "invalid_amount");
  assert.equal(bad({ amount_plus_annual: "-5" }), "invalid_amount");
  assert.equal(bad({ amount_plus_annual: "", amount_gathering_pass: "" }), "invalid_amounts");
  assert.equal(bad({ validation_days: "0" }), "invalid_validation_days");
  assert.equal(bad({ validation_days: "181" }), "invalid_validation_days");
  assert.equal(bad({ min_payout_cents: "-1" }), "invalid_min_payout");
  assert.equal(bad({ effective_from: "2026-11-01T00:00" }), "terms_must_be_effective_in_the_future");
  assert.equal(bad({ effective_from: "not a date" }), "terms_must_be_effective_in_the_future");
  assert.equal(bad({ note: "x".repeat(301) }), "note_too_long");
});

// ---- structural guarantees over the source tree ----
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const cc = walk(join(root, "app", "(command-center)")).filter((f) => /\.(ts|tsx)$/.test(f));

test("customer lookup never puts the query in a URL: no searchParams.q anywhere, and the lookup is a server action", () => {
  const purchases = readFileSync(join(root, "app/(command-center)/command-center/purchases/page.tsx"), "utf8");
  assert.ok(!/searchParams\.q\b/.test(purchases));
  assert.match(readFileSync(join(root, "app/(command-center)/command-center/purchases/actions.ts"), "utf8"), /^"use server"/);
  assert.match(readFileSync(join(root, "app/(command-center)/command-center/purchases/lookup-form.tsx"), "utf8"), /<form action=\{action\}/);
});

test("no Command Center file calls a write RPC outside the reviewed list, and money-moving verbs appear nowhere", () => {
  const WRITE_RPCS = new Set(["hc_review_application", "hc_admin_review_submission", "hc_admin_ack_notification", "hc_create_payout_draft", "hc_approve_payout", "hc_record_external_payment", "hc_reverse_recorded_payment", "hc_void_payout", "hc_add_terms_version", "hc_activate_paid_referrals", "hc_deactivate_paid_referrals", "hc_upsert_tier", "hc_admin_set_tier_benefits", "hc_admin_assign_tier", "hc_admin_set_partner_status", "admin_set_notification_state", "admin_set_notification_destination", "admin_verify_notification_destination", "admin_set_notification_email_enabled", "admin_set_notification_thresholds", "admin_retry_notification_delivery", "hc_admin_create_campaign", "hc_admin_assign_campaign", "hc_admin_close_campaign", "admin_grant_staff_role", "admin_revoke_staff_role", "hc_admin_ack_event", "hc_admin_add_destination", "hc_admin_set_destination_active", "hc_admin_set_member_tier", "hc_admin_upsert_tier", "hc_mark_payout_paid", "hc_set_partner_status"]);
  const READ_ONLY_OK = /^(get_my_staff_context|admin_[a-z_]+|hc_admin_[a-z_]+|growth_funnel_summary|creator_portal_summary|claim_my_membership)$/;
  for (const f of cc) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) assert.ok(WRITE_RPCS.has(m[1]) || READ_ONLY_OK.test(m[1]), `${f}: unexpected rpc ${m[1]}`);
    // Staff grant/revoke is allowed ONLY in the staff.manage-gated action file (reviewed, audited in the database, last owner protected).
    if (!/ops[\\/]staff[\\/]actions\.ts$/.test(f)) assert.ok(!/admin_grant_staff_role|admin_revoke_staff_role/.test(src), `${f}: staff grants are only allowed in ops/staff/actions.ts`);
    else assert.match(src, /requireStaff\("staff\.manage"/);
    assert.ok(!/stripe\.(refunds|payouts|transfers)|\/v1\/(refunds|transfers|payouts)/i.test(src), `${f}: must not move money`);
  }
});

test("every RPC the Command Center calls is defined in the migration set shipped with this change", () => {
  const dir = process.env.CC_MIGRATIONS_DIR;
  if (!dir || !existsSync(dir)) { console.log("# CC_MIGRATIONS_DIR not set: contract check skipped"); return; }
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql") && !/ROLLBACK/i.test(f)).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  const defined = new Set([...sql.matchAll(/create (?:or replace )?function public\.([a-z_0-9]+)\(/g)].map((m) => m[1]));
  const used = new Set<string>();
  for (const f of cc) for (const m of readFileSync(f, "utf8").matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) used.add(m[1]);
  for (const name of used) assert.ok(defined.has(name), `rpc ${name} is not defined in ${dir}`);
});

test("payout and terms actions are owner-gated (hc.payout) and the page shows their controls only for hc.payout", () => {
  const act = readFileSync(join(root, "app/(command-center)/command-center/hosting-collective/payouts/actions.ts"), "utf8");
  assert.equal((act.match(/requirePayoutOwner\(PATH\)/g) ?? []).length, 5); // payoutAction, addTermsVersion, paidReferralsSwitch, settleClawback, resolvePartialRefundHold (follow-up J)
  assert.ok(!/hc_mark_payout_paid/.test(act), "the retired entry point must not be called");
  const page = readFileSync(join(root, "app/(command-center)/command-center/hosting-collective/payouts/page.tsx"), "utf8");
  assert.ok((page.match(/caps\.canSeePayoutActions/g) ?? []).length >= 5);
});
