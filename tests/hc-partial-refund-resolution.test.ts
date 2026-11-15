import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { type StaffContext } from "../lib/admin/access.ts";
import { knownCode, messageFor } from "../lib/admin/messages.ts";
import { parseResolveHoldForm, parseHolds, resolvePartialRefundHoldWith, BLOCKER_TEXT } from "../lib/hc/partial-refund.ts";
import { makeFakeSupabase } from "./helpers/fake-supabase.ts";

register("./helpers/alias-loader.mjs", import.meta.url);

// FOLLOW-UP 217490 / 217491. Partial-refund hold resolution is OWNER ONLY (web: NOT_FOUND for everyone else, like the other payout actions; database: owner_required).
// Payout drafting is owner-only at the web AND (217491) at the database. hc.payout alone is VIEW-only.
const OWNER: StaffContext = { role: "owner", permissions: ["hc.read", "hc.manage", "hc.payout"] };
const FINANCE: StaffContext = { role: "business_admin", permissions: ["hc.read", "hc.payout"] };
const MANAGER: StaffContext = { role: "creator_program_manager", permissions: ["hc.read", "hc.manage", "hc.applications.review"] };
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const DIR = "app/(command-center)/command-center/hosting-collective/payouts";
const id = "22222222-2222-4222-8222-222222222222";
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const isNotFound = (e: unknown) => /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404/.test(String((e as any)?.digest ?? (e as Error)?.message ?? ""));
const releaseForm = () => form({ commission_id: id, resolution: "release", note: "reviewed, goodwill amount", confirm: "yes" });

describe("form parsing (pure)", () => {
  test("accepts release and reverse with a note and the confirmation", () => {
    assert.deepEqual(parseResolveHoldForm(releaseForm()), { ok: true, value: { commissionId: id, resolution: "release", note: "reviewed, goodwill amount" } });
    const r = parseResolveHoldForm(form({ commission_id: id, resolution: "reverse", note: "full service refunded", confirm: "yes" }));
    assert.equal(r.ok && r.value.resolution, "reverse");
  });
  test("refuses a bad id, a bad resolution, a short or markup note, and a missing confirmation (negative controls)", () => {
    const base = { commission_id: id, resolution: "release", note: "reviewed ok", confirm: "yes" };
    const err = (o: Record<string, string>) => { const r = parseResolveHoldForm(form({ ...base, ...o })); return r.ok ? "ok" : r.error; };
    assert.equal(err({}), "ok");
    assert.equal(err({ commission_id: "nope" }), "invalid_id");
    assert.equal(err({ resolution: "approve" }), "invalid_resolution_hold");
    assert.equal(err({ resolution: "" }), "invalid_resolution_hold");
    assert.equal(err({ note: "ab" }), "invalid_reason");
    assert.equal(err({ note: "<b>x</b>" }), "invalid_reason");
    assert.equal(err({ note: "x".repeat(301) }), "invalid_reason");
    assert.equal(err({ confirm: "" }), "confirmation_required");
    assert.equal(err({ confirm: "no" }), "confirmation_required");
  });
  test("parseHolds reads the database list and ignores malformed rows", () => {
    const raw = { holds: [{ commission_id: id, partner_id: "p", display_name: "A", canonical_product_id: "plus_annual", commission_cents: 1200, refunded_cents: 300, release_blocker: "dispute_open", can_release: false }, { nope: 1 }],
      recent_resolutions: [{ commission_id: id, resolution: "release", note: "n ok", resolved_at: "2026-11-14T10:00:00Z", refunded_cents_at_resolution: 300 }, { commission_id: id, resolution: "bogus" }] };
    const p = parseHolds(raw)!;
    assert.equal(p.holds.length, 1); assert.equal(p.holds[0].canRelease, false); assert.equal(p.holds[0].releaseBlocker, "dispute_open"); assert.equal(p.recent.length, 1);
    assert.equal(parseHolds(null), null); assert.equal(parseHolds({ holds: "x" }), null);
    for (const k of ["dispute_open", "dispute_lost", "fully_refunded", "entitlement_not_valid"]) assert.ok(BLOCKER_TEXT[k]);
  });
});

describe("the RPC wrapper maps database outcomes to short known codes (never the database text)", () => {
  const run = async (data: unknown, error: string | null, fd = releaseForm()) => {
    const calls: [string, Record<string, unknown>][] = [];
    const client: any = { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push([fn, args]); return { data, error: error ? { message: error } : null }; } };
    return { r: await resolvePartialRefundHoldWith(client, fd), calls };
  };
  test("release: released and already_resolved are success; arguments are exactly the four the function takes, confirm is true", async () => {
    const a = await run({ status: "released" }, null);
    assert.deepEqual(a.r, { ok: true, code: "saved" });
    assert.deepEqual(a.calls, [["hc_resolve_partial_refund_hold", { p_commission_id: id, p_resolution: "release", p_note: "reviewed, goodwill amount", p_confirm: true }]]);
    assert.deepEqual((await run({ status: "already_resolved" }, null)).r, { ok: true, code: "saved" });
  });
  test("reverse: reversed is success but a 'released' status is NOT (never reports the wrong decision)", async () => {
    const f = form({ commission_id: id, resolution: "reverse", note: "final decision", confirm: "yes" });
    assert.deepEqual((await run({ status: "reversed" }, null, f)).r, { ok: true, code: "saved" });
    assert.equal((await run({ status: "released" }, null, f)).r.ok, false);
  });
  test("database refusals become known codes", async () => {
    for (const code of ["owner_required", "commission_in_payout", "dispute_open", "dispute_lost", "fully_refunded", "entitlement_not_valid", "not_held_for_partial_refund", "already_resolved_differently", "note_required", "confirmation_required", "commission_not_found"]) {
      const x = await run(null, `P0001: ${code}`);
      assert.deepEqual(x.r, { ok: false, code }, code);
      assert.notEqual(messageFor(code), messageFor("failed"), `${code} has its own text`);
    }
    assert.equal(knownCode("something with secrets at 10.0.0.1"), "failed");
    assert.deepEqual((await run(null, "secret internal detail")).r, { ok: false, code: "failed" });
  });
  test("an invalid form never reaches the database", async () => {
    const x = await run({ status: "released" }, null, form({ commission_id: id, resolution: "release", note: "ok then", confirm: "" }));
    assert.deepEqual(x.r, { ok: false, code: "confirmation_required" }); assert.equal(x.calls.length, 0);
  });
});

describe("the REAL server actions: owner only (NOT_FOUND for everyone else, nothing written)", () => {
  for (const [who, ctx] of [["manager with only hc.read", MANAGER], ["financial staff holding hc.payout who is not the owner", FINANCE]] as const) {
    test(`${who}: resolve action and the form wrapper are NOT_FOUND and write nothing`, async () => {
      const m: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
      const w: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/payout-form-actions.ts");
      for (const [label, call] of [["resolvePartialRefundHold", () => m.resolvePartialRefundHold(releaseForm())], ["partialRefundForm", () => w.partialRefundForm(null, releaseForm())]] as const) {
        const fake = makeFakeSupabase({ status: "active", userId: "u-1", staffContext: ctx });
        (globalThis as any).__fakeSupabase = fake;
        let threw: unknown = null;
        try { await call(); } catch (e) { threw = e; }
        assert.ok(isNotFound(threw), `${label}: expected NOT_FOUND, got ${String(threw)}`);
        assert.deepEqual(fake.calls.filter((c: any) => c.kind === "write"), [], label);
      }
    });
  }
  test("the owner reaches the database function (control: the refusals above are about the role)", async () => {
    const m: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
    const fake = makeFakeSupabase({ status: "active", userId: "u-owner", staffContext: OWNER });
    (globalThis as any).__fakeSupabase = fake;
    const orig = fake.rpc;
    fake.rpc = async (fn: string, args: unknown) => (fn === "hc_resolve_partial_refund_hold" ? (fake.calls.push({ kind: "write", name: `rpc:${fn}`, args }), { data: { status: "released" }, error: null }) : orig(fn, args));
    const r = await m.resolvePartialRefundHold(releaseForm());
    assert.deepEqual(r, { ok: true, code: "saved" });
    assert.ok(fake.calls.some((c: any) => c.name === "rpc:hc_resolve_partial_refund_hold"));
  });
  test("owner action cannot reach any other writer (only the one function is called)", async () => {
    const m: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
    const fake = makeFakeSupabase({ status: "active", userId: "u-owner", staffContext: OWNER });
    (globalThis as any).__fakeSupabase = fake;
    await m.resolvePartialRefundHold(releaseForm());
    assert.deepEqual(fake.calls.filter((c: any) => c.kind === "write").map((c: any) => c.name), ["rpc:hc_resolve_partial_refund_hold"]);
  });
});

describe("DB-vs-web permission agreement for payout DRAFTING (217491)", () => {
  test("web: the draft action is NOT_FOUND for hc.payout staff who are not the owner, and for hc.read managers; the owner reaches hc_create_payout_draft", async () => {
    const m: any = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
    for (const ctx of [FINANCE, MANAGER]) {
      const fake = makeFakeSupabase({ status: "active", userId: "u-1", staffContext: ctx });
      (globalThis as any).__fakeSupabase = fake;
      let threw: unknown = null;
      try { await m.payoutAction(form({ kind: "draft", partner_id: id })); } catch (e) { threw = e; }
      assert.ok(isNotFound(threw)); assert.deepEqual(fake.calls.filter((c: any) => c.kind === "write"), []);
    }
    const fake = makeFakeSupabase({ status: "active", userId: "u-owner", staffContext: OWNER });
    (globalThis as any).__fakeSupabase = fake;
    await m.payoutAction(form({ kind: "draft", partner_id: id }));
    assert.ok(fake.calls.some((c: any) => c.name === "rpc:hc_create_payout_draft"));
  });
  test("database: 217491 adds hc_is_owner() right after the hc.payout check of hc_create_payout_draft and changes nothing else", () => {
    const sql = read("cc_sql/followup/src/20261114217491_hc_payout_draft_owner_only.sql");
    const rb = read("cc_sql/followup/rollback/ROLLBACK_217491.sql");
    const perm = "if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;";
    const own = "if not public.hc_is_owner() then raise exception 'owner_required' using errcode = 'P0001'; end if;";
    assert.ok(sql.includes(perm + "\n  " + own));
    assert.ok(!rb.includes("hc_is_owner"));
    const body = (t: string) => t.slice(t.indexOf("CREATE OR REPLACE FUNCTION"));
    assert.equal(body(sql).replace(/\n  if not public\.hc_is_owner\(\)[^\n]*\n/, "\n"), body(rb).replace(/;\n?$/, ";\n").replace(/;\n$/, ";\n"));
  });
  test("every payout writer in the main package is owner-only at the database (the follow-up makes draft the sixth)", () => {
    const sql = read("cc_sql/20261114217430_hc_payout_owner_only_writes.sql");
    for (const fn of ["hc_approve_payout", "hc_record_external_payment", "hc_void_payout", "hc_reverse_recorded_payment", "hc_settle_clawback"]) assert.match(sql, new RegExp(`FUNCTION public\\.${fn}\\(`));
    assert.equal((sql.match(/owner_required/g) ?? []).length >= 5, true);
  });
  test("hc.payout stays VIEW: the list / history / ledger / eligibility reads and the new hold list require hc.payout, not the owner", () => {
    const sql = read("cc_sql/followup/src/20261114217490_hc_partial_refund_hold_resolution.sql");
    const fn = sql.slice(sql.indexOf("function public.hc_admin_list_partial_refund_holds"));
    assert.match(fn, /staff_has_permission\('hc\.payout'\)/); assert.doesNotMatch(fn.split("$function$;")[0], /hc_is_owner/);
    const res = sql.slice(sql.indexOf("function public.hc_resolve_partial_refund_hold"), sql.indexOf("function public.hc_admin_list_partial_refund_holds"));
    assert.match(res, /if not public\.hc_is_owner\(\) then raise exception 'owner_required'/);
  });
});

describe("page wiring and package integrity", () => {
  test("every control of the new section is behind caps.canSeePayoutActions; viewers (hc.payout) see the list read-only", () => {
    const page = read(`${DIR}/page.tsx`);
    assert.match(page, /hc_admin_list_partial_refund_holds/);
    assert.match(page, /Partial refund reviews/);
    const sec = page.slice(page.indexOf('aria-labelledby="pr"'), page.indexOf('aria-labelledby="hist"'));
    const parts = sec.split("<ActionForm"); assert.equal(parts.length - 1, 2);
    for (let i = 0; i < parts.length - 1; i++) assert.match(parts[i].slice(-300), /caps\.canSeePayoutActions/, `form ${i + 1}`);
    assert.match(sec, /Only the owner can decide/); assert.match(sec, /Neither choice moves money/);
    assert.doesNotMatch(sec.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"), /stripe|paypal|transfer\(|sendMoney/i);
  });
  test("the action file gates the resolve action with requirePayoutOwner before anything else", () => {
    const a = read(`${DIR}/actions.ts`);
    const fn = a.slice(a.indexOf("export async function resolvePartialRefundHold"));
    assert.match(fn, /requirePayoutOwner\(PATH\)/); assert.ok(fn.indexOf("requirePayoutOwner") < fn.indexOf("resolvePartialRefundHoldWith"));
  });
  test("web cc_sql/followup checksums match FOLLOWUP_ORDER.tsv and every migration has a rollback and a test", () => {
    const tsv = read("cc_sql/followup/FOLLOWUP_ORDER.tsv").trim().split("\n").slice(1).map((l) => l.split("\t"));
    assert.ok(tsv.length >= 2);
    for (const [, file, sha, , rb] of tsv) {
      assert.equal(createHash("sha256").update(readFileSync(new URL(`../cc_sql/followup/${file}`, import.meta.url))).digest("hex").slice(0, 12), sha, file);
      assert.ok(existsSync(new URL(`../cc_sql/followup/rollback/${rb}`, import.meta.url)), rb);
    }
    assert.ok(existsSync(new URL("../cc_sql/followup/tests/ts217490.sql", import.meta.url)) && existsSync(new URL("../cc_sql/followup/tests/ts217491.sql", import.meta.url)));
  });
  test("the follow-up SQL does not touch approved economics, SMS or paid-referral defaults", () => {
    const sql = (read("cc_sql/followup/src/20261114217490_hc_partial_refund_hold_resolution.sql") + read("cc_sql/followup/src/20261114217491_hc_payout_draft_owner_only.sql")).split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    assert.doesNotMatch(sql, /paid_referrals_enabled\s*=\s*true|update public\.hc_settings|insert into public\.hc_terms|sms_enabled|kill_switch|staff_role_permissions/i);
    assert.doesNotMatch(sql, /hc_terms_amounts|hc_terms_versions/);   // economics are asserted against the real database in ts217490 F5
  });
});
