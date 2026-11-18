import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSmsReport, maskedPhone, estimatePlanCosts, formatMicroUsd, formatRate, parseDaysParam } from "../lib/admin/sms.ts";
import { navFor } from "../lib/admin/nav.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = {
  window_days: 30, flags: { sms_enabled: false, kill_switch: true },
  totals: { messages: 12, segments_net: 20, est_cost_microusd: 170000 },
  by_status: { queued: 1, provider_accepted: 2, delivered: 6, failed: 2, opted_out: 1 }, blocked_by_reason: { no_consent: 3 }, failures_by_error: { "40008": 1, "40017": 1 },
  delivery: { reached_provider: 9, delivered: 6, failed: 2, delivery_rate: 0.6667 },
  opt_outs: { opt_out_events: 2, suppressed_total: 3, suppressed_by_reason: { recipient_opt_out: 2, provider_suppressed: 1 } },
  per_plan: [{ plan_key: "gathering_pass", segments: 8, messages: 6 }, { plan_key: "plus", segments: 12, messages: 6 }],
  prices: [{ provider: "telnyx", number_type: "10dlc", direction: "outbound", unit_microusd: 4000, carrier_fee_microusd: 4500, effective_from: "2026-11-18", note: "estimate" }],
  recent_failures: [{ message_id: "0f0e0d0c-aaaa-bbbb-cccc-111122223333", kind: "reminder", error_code: "40008", phone_masked: "***-1234", at: "2026-11-20T10:00:00Z" }],
  daily: [{ day: "2026-11-20", messages: 4, delivered: 2 }],
};

test("parses the report; no phone number, hash or text can reach the page model", () => {
  const r = parseSmsReport(SAMPLE)!;
  assert.equal(r.messages, 12); assert.equal(r.deliveryRate, 0.6667); assert.equal(r.killSwitch, true); assert.equal(r.smsEnabled, false);
  assert.equal(r.recentFailures[0].phoneMasked, "***-1234"); assert.equal(r.recentFailures[0].messageId.length, 8);
  const dirty = parseSmsReport({ ...SAMPLE, recent_failures: [{ message_id: "m1234567890", kind: "update", phone_masked: "+12025551234", body: "secret text", phone_hash: "a".repeat(64) }] })!;
  assert.equal(dirty.recentFailures[0].phoneMasked, "***-1234");
  assert.doesNotMatch(JSON.stringify(dirty), /2025551234|secret|a{64}/);
});
test("malformed input is 'not available', never a guess", () => {
  for (const bad of [null, undefined, "x", 5, [], {}, { totals: {} }]) assert.equal(parseSmsReport(bad), null);
  const r = parseSmsReport({ totals: {}, delivery: { delivery_rate: 7 }, opt_outs: {}, by_status: { "bad key!": 1, ok: "x", good: 2 } })!;
  assert.equal(r.deliveryRate, null); assert.deepEqual(r.byStatus, { good: 2 }); assert.equal(r.smsEnabled, null);
});
test("masking: anything phone-like is cut down to the last four digits", () => {
  assert.equal(maskedPhone("***-0099"), "***-0099"); assert.equal(maskedPhone("+1 (202) 555-0123"), "***-0123"); assert.equal(maskedPhone(null), "***-****"); assert.equal(maskedPhone("abc"), "***-****");
});
test("cost estimates come from price ROWS: unit + carrier fee; no price row = null (no hard-coded price)", () => {
  const r = parseSmsReport(SAMPLE)!;
  const c = estimatePlanCosts(r);
  assert.deepEqual(c.map((x) => [x.planKey, x.costMicroUsd]), [["gathering_pass", 8 * 8500], ["plus", 12 * 8500]]);
  assert.deepEqual(estimatePlanCosts({ ...r, prices: [] }).map((x) => x.costMicroUsd), [null, null]);
  const other = estimatePlanCosts({ ...r, prices: [{ ...r.prices[0], unitMicroUsd: 1000, carrierFeeMicroUsd: 0 }] });
  assert.equal(other[0].costMicroUsd, 8000);
  assert.equal(formatMicroUsd(8500), "$0.0085"); assert.equal(formatMicroUsd(170000, 2), "$0.17"); assert.equal(formatRate(0.6667), "66.7%"); assert.equal(formatRate(null), "not enough data");
  assert.match(readFileSync(join(root, "lib/admin/sms.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /^(?![\s\S]*0\.0085)/);
});
test("days parameter is whitelisted", () => { assert.equal(parseDaysParam("7"), 7); assert.equal(parseDaysParam("90"), 90); assert.equal(parseDaysParam("1e9"), 30); assert.equal(parseDaysParam(undefined), 30); assert.equal(parseDaysParam(["7", "x"]), 7); });
test("page is gated by requireStaff('ops.read'), read-only, calls only cc_sms_report, no service-role key, no switch", () => {
  const f = join(root, "app/(command-center)/command-center/sms/page.tsx");
  assert.ok(existsSync(f)); const src = readFileSync(f, "utf8");
  assert.match(src, /requireStaff\(\s*"ops\.read"/); assert.doesNotMatch(src, /SERVICE_ROLE/);
  assert.deepEqual([...src.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]), ["cc_sms_report"]);
  assert.doesNotMatch(src, /<form|<button|onClick|action=/);
});
test("nav has exactly one SMS entry, visible only with ops.read", () => {
  const ctx = (permissions: any) => ({ role: "support", permissions }) as any;
  assert.equal(navFor(ctx(["ops.read"])).filter((l) => l.href === "/command-center/sms").length, 1);
  assert.equal(navFor(ctx(["support.read", "hc.read", "revenue.read"])).filter((l) => l.href === "/command-center/sms").length, 0);
});
test("contract with SQL: the page's RPC exists, is staff-gated and grants authenticated but not anon", () => {
  const sql = join(root, "..", "placeandplenty-native/supabase/qa_package/followup_sms/src/20261118270004_cc_sms_report.sql");
  if (!existsSync(sql)) return; // native repo not next to this one
  const s = readFileSync(sql, "utf8");
  assert.match(s, /function public\.cc_sms_report\(p_days integer/); assert.match(s, /staff_has_permission\('ops\.read'\)/);
  assert.match(s, /revoke execute on function public\.cc_sms_report\(integer\) from public, anon/); assert.match(s, /grant execute on function public\.cc_sms_report\(integer\) to authenticated/);
  for (const k of ["totals", "by_status", "blocked_by_reason", "failures_by_error", "delivery", "opt_outs", "per_plan", "prices", "recent_failures", "daily", "flags"]) assert.ok(s.includes(`'${k}'`), k);
  assert.doesNotMatch(s, /'phone_hash'|'body'/);
});
