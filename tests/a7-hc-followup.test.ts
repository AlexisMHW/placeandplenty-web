import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parsePartialRefundHolds, parseResolveHoldForm, resolvePartialRefundHoldWith } from "../lib/hc/partial-refund-hold.ts";
import { countClick, parseFunnel, shouldCountClick, signupsPer100 } from "../lib/hc/click-capture.ts";
import { csvCell, historyCsv, ledgerCsv, toCsv } from "../lib/admin/csv-export.ts";
import { parseHistory, parseLedger } from "../lib/admin/payout-ledger.ts";
import { knownCode, messageFor } from "../lib/admin/messages.ts";

const root = new URL("../", import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const ID = "11111111-2222-3333-4444-555555555555";
const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

describe("partial-refund hold resolution (owner-only, records a decision, moves no money)", () => {
  test("form needs a valid id, release|reverse, a note and the confirmation", () => {
    assert.equal(parseResolveHoldForm(form({ commission_id: "x", resolution: "release", note: "ok ok", confirm: "yes" })).ok, false);
    assert.deepEqual(parseResolveHoldForm(form({ commission_id: ID, resolution: "pay", note: "ok ok", confirm: "yes" })), { ok: false, error: "invalid_resolution" });
    assert.deepEqual(parseResolveHoldForm(form({ commission_id: ID, resolution: "release", note: "no", confirm: "yes" })), { ok: false, error: "invalid_reason" });
    assert.deepEqual(parseResolveHoldForm(form({ commission_id: ID, resolution: "release", note: "<b>x</b>", confirm: "yes" })), { ok: false, error: "invalid_reason" });
    assert.deepEqual(parseResolveHoldForm(form({ commission_id: ID, resolution: "release", note: "reviewed", confirm: "" })), { ok: false, error: "confirmation_required" });
    assert.equal(parseResolveHoldForm(form({ commission_id: ID, resolution: "reverse", note: "reviewed refund", confirm: "yes" })).ok, true);
  });
  test("calls only the owner-only database function, always with confirm true; never forwards database text", async () => {
    const calls: { fn: string; args: any }[] = [];
    const mk = (res: any) => ({ rpc: async (fn: string, args: any) => { calls.push({ fn, args }); return res; } });
    const f = form({ commission_id: ID, resolution: "release", note: "reviewed", confirm: "yes" });
    assert.deepEqual(await resolvePartialRefundHoldWith(mk({ data: { status: "released" }, error: null }), f), { ok: true, code: "saved" });
    assert.deepEqual(calls[0], { fn: "hc_resolve_partial_refund_hold", args: { p_commission_id: ID, p_resolution: "release", p_note: "reviewed", p_confirm: true } });
    assert.deepEqual(await resolvePartialRefundHoldWith(mk({ data: { status: "already_resolved" }, error: null }), f), { ok: true, code: "saved" });
    assert.deepEqual(await resolvePartialRefundHoldWith(mk({ data: null, error: { message: "P0001 owner_required secret table x" } }), f), { ok: false, code: "owner_required" });
    assert.deepEqual(await resolvePartialRefundHoldWith(mk({ data: null, error: { message: "relation hc_foo does not exist" } }), f), { ok: false, code: "failed" });
    assert.deepEqual(await resolvePartialRefundHoldWith(mk({ data: { status: "dispute_open" }, error: null }), f), { ok: false, code: "dispute_open" });
    assert.equal(calls.every((c) => c.fn === "hc_resolve_partial_refund_hold"), true);
    for (const c of ["owner_required", "dispute_open", "dispute_lost", "fully_refunded", "entitlement_not_valid", "commission_in_payout", "already_resolved_differently", "not_held_for_partial_refund"]) assert.notEqual(messageFor(c), messageFor("failed"), c);
    assert.equal(knownCode("P0001 dispute_lost"), "dispute_lost");
  });
  test("list parser tolerates junk and keeps release blockers", () => {
    assert.equal(parsePartialRefundHolds(null), null);
    const p = parsePartialRefundHolds({ holds: [{ commission_id: ID, display_name: "Ann", commission_cents: 1200, base_amount_cents: 5999, refunded_cents: 500, can_release: false, release_blocker: "dispute_open", payout_id: null }, { nope: 1 }], recent_resolutions: [{ commission_id: ID, resolution: "release", note: "n" }] });
    assert.equal(p?.holds.length, 1); assert.equal(p?.holds[0].canRelease, false); assert.equal(p?.holds[0].releaseBlocker, "dispute_open"); assert.equal(p?.recent.length, 1);
  });
  test("wiring: action is owner-gated, page shows the form only for owner capability, no service-role key", () => {
    const act = read("app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
    const fn = act.slice(act.indexOf("export async function resolvePartialRefundHold"));
    assert.match(fn, /requirePayoutOwner\(PATH\)/);
    const page = read("app/(command-center)/command-center/hosting-collective/payouts/page.tsx");
    const sec = page.slice(page.indexOf('aria-labelledby="prh"'), page.indexOf('aria-labelledby="claw"'));
    assert.match(sec, /caps\.canSeePayoutActions/);
    assert.ok(!/SERVICE_ROLE/.test(act + page));
  });
});

describe("referral click counting is OFF by default, anonymous and never blocks the redirect", () => {
  const ON = { NEXT_PUBLIC_HC_REFERRALS: "true", HC_CLICK_COUNTING_ENABLED: "true" };
  test("defaults off; needs both flags exactly; GPC suppresses; junk codes ignored", () => {
    assert.equal(shouldCountClick({}, null, "ann-code"), false);
    assert.equal(shouldCountClick({ NEXT_PUBLIC_HC_REFERRALS: "true" }, null, "ann-code"), false);
    assert.equal(shouldCountClick({ HC_CLICK_COUNTING_ENABLED: "true" }, null, "ann-code"), false);
    assert.equal(shouldCountClick({ NEXT_PUBLIC_HC_REFERRALS: "TRUE", HC_CLICK_COUNTING_ENABLED: "1" }, null, "ann-code"), false);
    assert.equal(shouldCountClick(ON, "1", "ann-code"), false);
    assert.equal(shouldCountClick(ON, null, "a"), false);
    assert.equal(shouldCountClick(ON, null, "x'; drop"), false);
    assert.equal(shouldCountClick(ON, null, "Ann-Code"), true);
  });
  test("sends only the lower-case public code; swallows every failure", async () => {
    const seen: any[] = [];
    assert.equal(await countClick(() => ({ rpc: async (fn, args) => { seen.push([fn, args]); return { data: { status: "counted" }, error: null }; } }), " Ann-Code "), "counted");
    assert.deepEqual(seen, [["hc_record_referral_click", { p_code: "ann-code" }]]);
    assert.equal(await countClick(() => null, "ann-code"), "skipped");
    assert.equal(await countClick(() => ({ rpc: async () => ({ data: { status: "ignored" }, error: null }) }), "ann-code"), "skipped");
    assert.equal(await countClick(() => ({ rpc: async () => ({ error: { message: "function not found" } }) }), "ann-code"), "error");
    assert.equal(await countClick(() => ({ rpc: async () => { throw new Error("boom"); } }), "ann-code"), "error");
    assert.equal(await countClick(() => ({ rpc: () => new Promise(() => {}) }), "ann-code", 20), "error");
  });
  test("route: redirect and cookie behaviour unchanged; counting passes only the code, after the GPC and flag checks", () => {
    const src = read("app/r/[code]/route.ts");
    assert.match(src, /process\.env\.NEXT_PUBLIC_HC_REFERRALS !== "true"\) return res/);
    assert.match(src, /sec-gpc"\) === "1"\) return res/);
    const call = src.slice(src.indexOf("shouldCountClick("));
    assert.ok(src.indexOf("shouldCountClick(") > src.indexOf("sec-gpc"));
    assert.ok(!/x-forwarded-for|user-agent|referer|headers\.get\("(?!sec-gpc)/i.test(call), "no visitor headers are read for counting");
    assert.match(src, /new URL\("\/", req\.url\), 302/);
  });
  test("funnel parser and rate never divide by zero or invent a rate", () => {
    assert.equal(parseFunnel({}), null);
    const f = parseFunnel({ days: 30, rows: [{ code: "a-b", display_name: "A", clicks: 0, signups: 2 }, { code: "c-d", display_name: "C", clicks: 40, signups: 3 }, { bad: 1 }], note: "n" });
    assert.equal(f?.rows.length, 2); assert.equal(signupsPer100(f!.rows[0]), null); assert.equal(signupsPer100(f!.rows[1]), 7.5);
  });
});

describe("CSV exports: formula-safe, no personal data, buckets never summed", () => {
  test("cells are quoted and formula prefixes neutralised", () => {
    assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
    for (const s of ["+1", "-1", "@a", "\tx", "\rx"]) assert.ok(csvCell(s).includes("'"), s);
    assert.equal(csvCell("a,b"), '"a,b"'); assert.equal(csvCell(null), ""); assert.equal(csvCell(12), "12");
    assert.equal(toCsv(["a"], [["x"]]), "a\r\nx\r\n");
  });
  const ledger = parseLedger({ totals: { pending_cents: 1, validated_cents: 2, draft_cents: 3, approved_cents: 4, paid_cents: 5 }, partners: [{ partner_id: "p1", display_name: "=Evil", status: "approved", pending_cents: 100, validated_cents: 200, draft_cents: 0, approved_cents: 300, paid_cents: 400, outstanding_clawback_cents: 50 }] })!;
  test("ledger csv keeps five buckets as separate columns and has no total column", () => {
    const out = ledgerCsv(ledger, "2026-11-18T00:00:00Z").split("\r\n");
    assert.match(out[0], /pending_cents,pending_usd,validated_cents,validated_usd,draft_cents,draft_usd,approved_cents,approved_usd,paid_cents,paid_usd,outstanding_clawback_cents/);
    assert.ok(!/total/.test(out[0]));
    assert.ok(out[1].includes("'=Evil") && out[1].includes("100,1.00,200,2.00"));
  });
  test("history csv states approved is not paid, and carries no email or user id column", () => {
    const h = parseHistory([{ payout_id: "x1", partner_id: "p1", total_cents: 1200, status: "approved", events: [{ event: "approved", at: "2026-11-01T00:00:00Z" }], external_ref: "+REF" }])!;
    const out = historyCsv(h, new Map([["p1", "Ann"]]), "t");
    assert.match(out, /Approved — not paid yet/); assert.ok(out.includes("'+REF"));
    assert.ok(!/email|user_id|tin|ssn/i.test(out.split("\r\n")[0]));
  });
  test("export route needs hc.payout, is read only and uses no service-role key", () => {
    const src = read("app/(command-center)/command-center/hosting-collective/payouts/export/route.ts");
    assert.match(src, /requireStaff\("hc\.payout"/); assert.ok(!/SERVICE_ROLE|\.insert\(|\.update\(|\.upsert\(|\.rpc\("hc_(approve|create|record|void|reverse)/.test(src));
    assert.match(src, /no-store/); assert.match(src, /text\/csv/);
  });
});

// ---- Defaults-off and entitlement-boundary guards (web) ----
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) { if (["node_modules", ".next", ".git", "tina", "public"].includes(n)) continue; const p = join(dir, n); const s = statSync(p); if (s.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(n)) out.push(p); }
  return out;
}
describe("web entitlement and activation boundaries", () => {
  const files = [...walk(join(root, "app")), ...walk(join(root, "lib")), ...walk(join(root, "components"))];
  test("no web code writes entitlement, entitlement-event or purchase-intent tables directly", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\.from\(\s*["'`](gathering_entitlements|entitlement_events|purchase_intents|purchase_payments|commission_purchase_facts|commissions|payouts|hc_settings)["'`]\s*\)\s*\.(insert|update|upsert|delete)\b/g)) assert.fail(`${f} writes ${m[1]} directly`);
    }
  });
  test("no client component or browser module holds a service-role key or calls a grant/ledger/payout-writing RPC", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const client = /^\s*["']use client["']/m.test(src) || /supabase-browser/.test(src);
      if (!client) continue;
      assert.ok(!/SERVICE_ROLE/.test(src), `${f} mentions the service-role key`);
      assert.ok(!/\.rpc\(\s*["'](hc_(approve|create|record|void|reverse|resolve|activate|deactivate|settle|add_terms|clear)|record_purchase|reconcile_commission|grant_|sweep_commissions)/.test(src), `${f} calls a privileged RPC from the browser`);
    }
  });
  test("service-role key is used only by the two reviewed server entry points (+ other pre-existing ones are listed, not widened)", () => {
    const hits = files.filter((f) => /SERVICE_ROLE_KEY/.test(readFileSync(f, "utf8"))).map((f) => f.slice(root.length));
    const allowed = new Set(["app/api/hosting-collective/commission-maintenance/route.ts", "app/r/[code]/route.ts", "lib/hc/dispatch-server.ts"]);
    for (const h of hits) assert.ok(allowed.has(h) || /^lib\/(comms|supabase-server)/.test(h) || /^app\/api\//.test(h) || /^app\/auth\//.test(h), `unexpected service-role use in ${h}`);
    assert.ok(hits.includes("app/r/[code]/route.ts"));
  });
  test("paid referrals, click counting, commission maintenance and ledger wiring are default OFF in code", () => {
    const route = read("app/api/hosting-collective/commission-maintenance/route.ts") + read("lib/hc/commission-maintenance.ts");
    assert.match(route, /HC_COMMISSION_MAINTENANCE_ENABLED/);
    assert.equal(shouldCountClick({}, null, "ann-code"), false);
    assert.match(read("app/r/[code]/route.ts"), /NEXT_PUBLIC_HC_REFERRALS !== "true"/);
    const payouts = read("app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
    assert.ok(!/paid_referrals_enabled\s*[:=]\s*true/.test(payouts));
    assert.match(payouts, /hc_activate_paid_referrals/); // only through the typed-phrase owner action
  });
  test("the web never calls Stripe or a payout/transfer API", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      assert.ok(!/stripe\.(transfers|payouts|payouts)\.create|api\.stripe\.com\/v1\/(transfers|payouts)/.test(src), `${f} could move money`);
    }
  });
});
