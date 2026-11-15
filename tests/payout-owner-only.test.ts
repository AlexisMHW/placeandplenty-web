import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { canActOnPayouts, canViewPayouts } from "../lib/admin/payout-access.ts";
import { decideAccess, type StaffContext } from "../lib/admin/access.ts";
import { hcCapabilities } from "../lib/admin/hc.ts";
import { navFor } from "../lib/admin/nav.ts";
import { visibleAlerts } from "../lib/admin/cc.ts";
import { makeFakeSupabase } from "./helpers/fake-supabase.ts";

register("./helpers/alias-loader.mjs", import.meta.url);

// FOUNDER DECISION A: payout history is read-only for the owner and for authorized financial staff (hc.payout); a manager with only hc.read
// sees nothing; only the OWNER can approve, record an external payment, draft, void, reverse or settle. Payments happen outside the app.
const OWNER: StaffContext = { role: "owner", permissions: ["hc.read", "hc.manage", "hc.payout"] };
const FINANCE: StaffContext = { role: "business_admin", permissions: ["hc.read", "hc.payout"] };
const MANAGER: StaffContext = { role: "creator_program_manager", permissions: ["hc.read", "hc.manage", "hc.applications.review"] };
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const DIR = "app/(command-center)/command-center/hosting-collective/payouts";

describe("pure access decisions", () => {
  test("view = hc.payout; act = owner AND hc.payout", () => {
    assert.deepEqual([canViewPayouts(OWNER), canActOnPayouts(OWNER)], [true, true]);
    assert.deepEqual([canViewPayouts(FINANCE), canActOnPayouts(FINANCE)], [true, false]);
    assert.deepEqual([canViewPayouts(MANAGER), canActOnPayouts(MANAGER)], [false, false]);
    assert.equal(canActOnPayouts({ role: "owner", permissions: ["hc.read"] }), false);
  });
  test("the payouts page is NOT_FOUND for a manager with only hc.read, allowed for financial staff and owner", () => {
    const d = (ctx: StaffContext) => decideAccess({ signedIn: true, rawContext: ctx }, "hc.payout").kind;
    assert.equal(d(MANAGER), "not_found"); assert.equal(d(FINANCE), "allow"); assert.equal(d(OWNER), "allow");
  });
  test("capabilities, nav and dashboard alerts follow the same split", () => {
    assert.equal(hcCapabilities(FINANCE).canSeePayoutActions, false);
    assert.equal(hcCapabilities(FINANCE).canViewPayouts, true);
    assert.equal(hcCapabilities(MANAGER).canViewPayouts, false);
    assert.ok(!navFor(MANAGER).some((l) => l.label === "Payouts"));
    assert.ok(navFor(FINANCE).some((l) => l.label === "Payouts"));
    const alert = { key: "k", severity: "action" as const, count: 1, text: "t", href: "/command-center/hosting-collective/payouts" };
    assert.equal(visibleAlerts([alert], MANAGER.permissions).length, 0);
    assert.equal(visibleAlerts([alert], FINANCE.permissions).length, 1);
  });
});

describe("the REAL payout server actions enforce owner-only before any write", () => {
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  const id = "11111111-1111-4111-8111-111111111111";
  const calls: [string, string, FormData][] = [
    ["approve", "payoutAction", form({ kind: "approve", payout_id: id })],
    ["draft", "payoutAction", form({ kind: "draft", partner_id: id })],
    ["record payment", "payoutAction", form({ kind: "paid", payout_id: id, external_ref: "BANK-1234", method: "bank", paid_on: "2026-01-01", confirm: "yes" })],
    ["void", "payoutAction", form({ kind: "void", payout_id: id, reason: "mistake" })],
    ["reverse", "payoutAction", form({ kind: "reverse", payout_id: id, reason: "returned", confirm: "yes" })],
    ["settle clawback", "settleClawback", form({ commission_id: id, resolution: "waived", note: "ok then", confirm: "yes" })],
    ["terms", "addTermsVersion", form({ validation_days: "45", min_payout_cents: "5000", effective_from: "2099-01-01T00:00", confirm: "yes" })],
    ["paid referrals switch", "paidReferralsSwitch", form({ mode: "deactivate", reason: "test reason" })],
  ];
  const isNotFound = (e: unknown) => /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404/.test(String((e as any)?.digest ?? (e as Error)?.message ?? ""));
  for (const [who, ctx] of [["manager with only hc.read", MANAGER], ["financial staff with hc.payout who is not the owner", FINANCE]] as const) {
    test(`${who}: every payout action is NOT_FOUND and nothing is written`, async () => {
      const m: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
      const wrappers: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/payout-form-actions.ts");
      for (const [label, fn, fd] of calls) {
        const fake = makeFakeSupabase({ status: "active", userId: "u-1", staffContext: ctx });
        (globalThis as any).__fakeSupabase = fake;
        let threw: unknown = null;
        try { await m[fn](fd); } catch (e) { threw = e; }
        assert.ok(isNotFound(threw), `${label}: expected NOT_FOUND, got ${String(threw)}`);
        assert.deepEqual(fake.calls.filter((c: any) => c.kind === "write"), [], label);
      }
      for (const [fn, fd] of [["payoutForm", calls[0][2]], ["termsForm", calls[6][2]]] as const) {
        const fake = makeFakeSupabase({ status: "active", userId: "u-1", staffContext: ctx });
        (globalThis as any).__fakeSupabase = fake;
        let threw: unknown = null;
        try { await wrappers[fn](null, fd); } catch (e) { threw = e; }
        assert.ok(isNotFound(threw), fn);
        assert.deepEqual(fake.calls.filter((c: any) => c.kind === "write"), [], fn);
      }
    });
  }
  test("the owner reaches the database function (control: the refusals above are about the role, not a broken harness)", async () => {
    const m: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
    const fake = makeFakeSupabase({ status: "active", userId: "u-owner", staffContext: OWNER });
    (globalThis as any).__fakeSupabase = fake;
    await m.payoutAction(calls[0][2]);
    assert.ok(fake.calls.some((c: any) => c.name === "rpc:hc_approve_payout"));
  });
  test("tier eligibility (paid-referral switch of a tier) is owner-only as well", async () => {
    const m: any = await import("../app/(command-center)/command-center/hosting-collective/tiers/actions.ts");
    const fake = makeFakeSupabase({ status: "active", userId: "u-1", staffContext: FINANCE });
    (globalThis as any).__fakeSupabase = fake;
    let threw: unknown = null;
    try { await m.setTierEligibility(form({ slug: "gold", eligible: "yes", reason: "why", confirm: "yes" })); } catch (e) { threw = e; }
    assert.ok(isNotFound(threw));
  });
});

describe("static: pages and wording", () => {
  test("the payouts page needs hc.payout and renders EVERY form only behind caps.canSeePayoutActions", () => {
    const page = read(`${DIR}/page.tsx`);
    assert.match(page, /requireStaff\("hc\.payout"/);
    assert.ok(!/requireStaff\("hc\.read"/.test(page));
    const parts = page.split("<ActionForm").slice(1);
    assert.ok(parts.length >= 8, `${parts.length} forms`);
    const before = page.split("<ActionForm");
    for (let i = 0; i < parts.length; i++) assert.match(before[i].slice(-700), /caps\.canSeePayoutActions/, `form #${i + 1} is not behind the owner capability`);
    assert.match(page, /Read only\. You can view the payout history and ledger\. Only the owner can/);
    assert.match(page, /Payments happen outside the app/);
  });
  test("no automated money movement and no money-moving provider anywhere in the payout code", () => {
    for (const f of ["page.tsx", "actions.ts", "payout-form-actions.ts"]) assert.doesNotMatch(read(`${DIR}/${f}`).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"), /stripe|paypal|transfer\(|payouts\.create|sendMoney|send_money/i, f);
  });
  test("finance, HC overview and HC inbox do not leak payout data to hc.read-only staff", () => {
    assert.match(read("app/(command-center)/command-center/finance/page.tsx"), /showPayoutData \? \(f\.commissionStates/);
    assert.match(read("app/(command-center)/command-center/finance/page.tsx"), /showPayoutData \? \(f\.payoutStatuses/);
    assert.match(read("app/(command-center)/command-center/hosting-collective/page.tsx"), /caps\.canViewPayouts \? \[\["payouts"/);
    assert.match(read("app/(command-center)/command-center/hosting-collective/inbox/page.tsx"), /caps\.canViewPayouts \|\| e\.refType !== "payout"/);
  });
  test("requirePayoutOwner = hc.payout gate plus owner check, 404 otherwise", () => {
    const src = read("lib/admin/server.ts");
    assert.match(src, /requireStaff\("hc\.payout", nextPath\)[\s\S]*canActOnPayouts\(r\.context\)\) notFound\(\)/);
  });
});
