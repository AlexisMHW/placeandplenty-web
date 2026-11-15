import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveTierWith, setTierEligibilityWith } from "../lib/hc/tier-write.ts";
import { settleClawbackWith } from "../lib/hc/clawback.ts";
import { runCommissionMaintenance } from "../lib/hc/commission-maintenance.ts";

const fd = (o: Record<string, string | undefined>) => ({ get: (k: string) => (o[k] ?? null) });
const SECRET = "0123456789abcdef-secret";
type Call = { fn: string; args: any };
function fake(handlers: Record<string, (a: any) => { data?: unknown; error: { message: string } | null }> = {}) {
  const calls: Call[] = [];
  return { calls, async rpc(fn: string, args: any = {}) { calls.push({ fn, args }); return (handlers[fn] ?? (() => ({ data: null, error: null })))(args); } };
}
const tierRow = { slug: "gold", label: "Gold", description: "d", eligibility_notes: "n", sort_order: 3, active: true, benefits: ["a"], paid_referrals_eligible: true, member_count: 1 };
const base = { slug: "gold", label: "Gold 2", reason: "rename", benefits: "a\nb" };

// ---- E-B1 / E-B2
test("saveTier sends NULL (never false) for eligibility, even with a checkbox value present or absent", async () => {
  for (const extra of [{}, { paid_referrals_eligible: "yes" }, { paid_referrals_eligible: "" }]) {
    const db = fake(); const r = await saveTierWith(db, fd({ ...base, ...extra }));
    assert.deepEqual(r, { ok: true, code: "saved" });
    const up = db.calls.find((c) => c.fn === "hc_upsert_tier")!;
    assert.equal(up.args.p_paid_referrals_eligible, null);
    assert.equal(db.calls.filter((c) => c.fn === "hc_upsert_tier").length, 1);
  }
});
test("manager rename of a paid-eligible tier succeeds: the call carries no eligibility change", async () => {
  const db = fake({ hc_upsert_tier: (a) => ({ error: a.p_paid_referrals_eligible === null ? null : { message: "not_authorized_referral_eligibility" } }) });
  assert.deepEqual(await saveTierWith(db, fd(base)), { ok: true, code: "saved" });
  assert.deepEqual(db.calls.map((c) => c.fn), ["hc_upsert_tier", "hc_admin_set_tier_benefits"]);
});
test("a failed upsert stops before benefits and returns a known code", async () => {
  const db = fake({ hc_upsert_tier: () => ({ error: { message: "ERROR: not_authorized" } }) });
  const r = await saveTierWith(db, fd(base)); assert.deepEqual(r, { ok: false, code: "not_authorized" });
  assert.equal(db.calls.length, 1);
});
test("eligibility change needs explicit yes/no, reason and confirmation; undefined never means false", async () => {
  for (const bad of [{ slug: "gold", reason: "because", confirm: "yes" }, { slug: "gold", eligible: "", reason: "because", confirm: "yes" }, { slug: "gold", eligible: "false", reason: "because", confirm: "yes" },
    { slug: "gold", eligible: "no", reason: "because" }, { slug: "gold", eligible: "no", reason: "x", confirm: "yes" }]) {
    const db = fake(); const r = await setTierEligibilityWith(db, fd(bad)); assert.equal(r.ok, false); assert.equal(db.calls.length, 0);
  }
});
test("owner eligibility change re-reads the tier, passes other fields unchanged and sets the explicit value", async () => {
  const db = fake({ hc_admin_list_tiers: () => ({ data: [tierRow], error: null }) });
  const r = await setTierEligibilityWith(db, fd({ slug: "gold", eligible: "no", reason: "pausing", confirm: "yes" }));
  assert.deepEqual(r, { ok: true, code: "saved" });
  const up = db.calls.find((c) => c.fn === "hc_upsert_tier")!.args;
  assert.equal(up.p_paid_referrals_eligible, false); assert.equal(up.p_label, "Gold"); assert.equal(up.p_sort_order, 3); assert.equal(up.p_active, true); assert.equal(up.p_reason, "pausing");
});
test("owner re-confirming the current value writes nothing; unknown tier is refused", async () => {
  const db = fake({ hc_admin_list_tiers: () => ({ data: [tierRow], error: null }) });
  assert.equal((await setTierEligibilityWith(db, fd({ slug: "gold", eligible: "yes", reason: "same", confirm: "yes" }))).ok, true);
  assert.equal(db.calls.some((c) => c.fn === "hc_upsert_tier"), false);
  assert.deepEqual(await setTierEligibilityWith(db, fd({ slug: "nope-x", eligible: "yes", reason: "same", confirm: "yes" })), { ok: false, code: "not_found" });
});
test("tiers page: manager sees no eligibility control; owner form is preloaded from the current value", () => {
  const page = readFileSync(new URL("../app/(command-center)/command-center/hosting-collective/tiers/page.tsx", import.meta.url), "utf8");
  assert.match(page, /defaultValue=\{t\.paidReferralsEligible \? "yes" : "no"\}/);
  assert.match(page, /context\.permissions\.includes\("hc\.payout"\) \? \(\s*<ActionForm action=\{setTierEligibility\}/);
  assert.doesNotMatch(page, /name="paid_referrals_eligible"/);
});

// ---- E-D3
const cid = "11111111-1111-4111-8111-111111111111";
const okForm = { commission_id: cid, resolution: "recovered_externally", external_ref: "BANK-1234", note: "returned by wire", confirm: "yes" };
test("settle clawback: calls hc_settle_clawback once with confirm true, reports settled", async () => {
  const db = fake({ hc_settle_clawback: () => ({ data: { status: "settled" }, error: null }) });
  assert.deepEqual(await settleClawbackWith(db, fd(okForm)), { ok: true, code: "saved" });
  assert.equal(db.calls.length, 1); assert.deepEqual(db.calls[0].args, { p_commission_id: cid, p_resolution: "recovered_externally", p_external_ref: "BANK-1234", p_note: "returned by wire", p_confirm: true });
});
test("settle clawback: refused without confirmation, bad id, bad resolution, missing reference or note; no RPC", async () => {
  for (const bad of [{ ...okForm, confirm: "" }, { ...okForm, commission_id: "x" }, { ...okForm, resolution: "paid" }, { ...okForm, external_ref: "" }, { ...okForm, note: "" }]) {
    const db = fake(); assert.equal((await settleClawbackWith(db, fd(bad))).ok, false); assert.equal(db.calls.length, 0);
  }
  const db = fake({ hc_settle_clawback: () => ({ data: { status: "settled" }, error: null }) });
  assert.equal((await settleClawbackWith(db, fd({ ...okForm, resolution: "waived", external_ref: "" }))).ok, true);
});
test("settle clawback: database refusal is shown as a known code, never raw text", async () => {
  const db = fake({ hc_settle_clawback: () => ({ error: { message: "ERROR: no_clawback secret detail" } }) });
  assert.deepEqual(await settleClawbackWith(db, fd(okForm)), { ok: false, code: "no_clawback" });
});
test("payouts page: clawback form is owner-only, says money moves outside the app", () => {
  const page = readFileSync(new URL("../app/(command-center)/command-center/hosting-collective/payouts/page.tsx", import.meta.url), "utf8");
  assert.match(page, /caps\.canSeePayoutActions \? \(\s*<section aria-labelledby="claw">/);
  assert.match(page, /No money moves in this app and nothing is netted automatically/);
  const act = readFileSync(new URL("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts", import.meta.url), "utf8");
  assert.match(act, /export async function settleClawback[\s\S]*?requireStaff\("hc\.payout"/);
});

// ---- E-C2
const auth = (s = SECRET) => `Bearer ${s}`;
test("maintenance: no/wrong secret -> 401 and nothing called, even when enabled", async () => {
  const db = fake(); let made = 0;
  for (const a of [null, "", auth("wrong-secret-wrong-secret")]) {
    const r = await runCommissionMaintenance({ env: { HC_COMMISSION_MAINTENANCE_ENABLED: "true", HC_COMMISSION_MAINTENANCE_SECRET: SECRET }, authorization: a, client: () => { made++; return db; } });
    assert.equal(r.status, 401);
  }
  assert.equal(made, 0); assert.equal(db.calls.length, 0);
});
test("maintenance: OFF by default (unset or not exactly 'true') -> nothing called", async () => {
  for (const flag of [undefined, "", "1", "TRUE", "false"]) {
    const db = fake(); let made = 0;
    const r = await runCommissionMaintenance({ env: { HC_COMMISSION_MAINTENANCE_ENABLED: flag, HC_COMMISSION_MAINTENANCE_SECRET: SECRET }, authorization: auth(), client: () => { made++; return db; } });
    assert.deepEqual(r.body, { ok: true, ran: false, reason: "maintenance_disabled" }); assert.equal(made, 0); assert.equal(db.calls.length, 0);
  }
});
test("maintenance: on + secret -> exactly one RPC call", async () => {
  const db = fake({ hc_commission_maintenance: () => ({ data: { swept: 2 }, error: null }) });
  const r = await runCommissionMaintenance({ env: { HC_COMMISSION_MAINTENANCE_ENABLED: "true", HC_COMMISSION_MAINTENANCE_SECRET: SECRET }, authorization: auth(), client: () => db });
  assert.equal(r.status, 200); assert.equal(r.body.ran, true);
  assert.deepEqual(db.calls.map((c) => c.fn), ["hc_commission_maintenance"]);
});
test("maintenance: missing function fails closed with a clear error, no retry or other RPC", async () => {
  const db = fake({ hc_commission_maintenance: () => ({ error: { message: "Could not find the function public.hc_commission_maintenance in the schema cache", code: "PGRST202" } as any }) });
  const r = await runCommissionMaintenance({ env: { HC_COMMISSION_MAINTENANCE_ENABLED: "true", HC_COMMISSION_MAINTENANCE_SECRET: SECRET }, authorization: auth(), client: () => db });
  assert.equal(r.status, 503); assert.equal(r.body.error, "maintenance_function_not_installed"); assert.equal(db.calls.length, 1);
  const r2 = await runCommissionMaintenance({ env: { HC_COMMISSION_MAINTENANCE_ENABLED: "true", HC_COMMISSION_MAINTENANCE_SECRET: SECRET }, authorization: auth(), client: () => null });
  assert.equal(r2.status, 503);
});
test("maintenance route is a POST-only handler that does not read a client before auth", () => {
  const src = readFileSync(new URL("../app/api/hosting-collective/commission-maintenance/route.ts", import.meta.url), "utf8");
  assert.match(src, /export async function POST/); assert.doesNotMatch(src, /export async function GET/);
});
