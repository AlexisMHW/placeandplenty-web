import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { gatheringWriteBlock, GATHERING_READ_ONLY_MESSAGE, GATHERING_STATUS_UNKNOWN_MESSAGE } from "../lib/gathering-write-guard.ts";
import { makeFakeSupabase } from "./helpers/fake-supabase.ts";

register("./helpers/alias-loader.mjs", import.meta.url);

const READ_ONLY = ["completed", "cancelled", "archived"];
const LIVE = ["draft", "active", "hosting"];
const CALLERS = [
  { label: "owner", userId: "u-owner" },
  { label: "co-host (any capability)", userId: "u-cohost" },
  { label: "unrelated direct caller", userId: "u-direct" },
];

describe("gatheringWriteBlock (server-side D2 guard)", () => {
  for (const s of READ_ONLY) {
    test(`blocks ${s} with no exceptions`, async () => {
      const r = await gatheringWriteBlock(makeFakeSupabase({ status: s }), "g-1");
      assert.deepEqual(r, { ok: false, message: GATHERING_READ_ONLY_MESSAGE });
    });
  }
  for (const s of LIVE) {
    test(`allows ${s}`, async () => {
      assert.equal(await gatheringWriteBlock(makeFakeSupabase({ status: s }), "g-1"), null);
    });
  }
  test("fails closed when status cannot be read", async () => {
    const r = await gatheringWriteBlock(makeFakeSupabase({ status: null }), "g-1");
    assert.deepEqual(r, { ok: false, message: GATHERING_STATUS_UNKNOWN_MESSAGE });
  });
  test("fails closed on empty id, non-string status and thrown rpc", async () => {
    assert.equal((await gatheringWriteBlock(makeFakeSupabase({ status: "active" }), ""))?.ok, false);
    const weird: any = { rpc: async () => ({ data: 42, error: null }) };
    assert.equal((await gatheringWriteBlock(weird, "g-1"))?.ok, false);
    const thrower: any = { rpc: async () => { throw new Error("net"); } };
    assert.equal((await gatheringWriteBlock(thrower, "g-1"))?.ok, false);
  });
  test("uses the EFFECTIVE (time-derived) status rpc with the gathering id", async () => {
    const c = makeFakeSupabase({ status: "active" });
    await gatheringWriteBlock(c, "g-77");
    assert.deepEqual(c.calls[0], { kind: "status", name: "effective_gathering_status", args: { p_gathering_id: "g-77" } });
  });
});

// ---- Behavioural: the REAL server actions, run against a fake client ---------------------------------
const MODULES: Record<string, string[]> = {
  "../lib/menu-actions.ts": [],
  "../lib/shopping-actions.ts": [],
  "../lib/people-actions.ts": ["createHouseholdWeb"],
  "../lib/guest-experience-actions.ts": [],
  "../lib/budget-actions.ts": [],
  "../lib/contribution-actions.ts": [],
  "../lib/gathering-photos-actions.ts": [],
  "../lib/music-media-actions.ts": [],
  "../lib/style-board-actions.ts": [],
  "../lib/multi-day-actions.ts": ["getMultiDayAccessState", "getMultiDayLockInGate", "getMultiDayPassStep", "finishMultiDayGathering"],
  "../lib/closet-smart-actions.ts": ["checkSmartClosetWeb"],
  "../lib/recipe-source-actions.ts": [],
};

// Pre-existing, stricter-or-equal refusals that fire before the shared guard (photo workspace already refuses).
const OWN_REFUSAL_OK = new Set(["uploadGatheringPhotoWeb", "saveStyleBoardWeb", "uploadStyleImageWeb", "deleteStyleImageWeb"]);
function formFor(): FormData {
  const f = new FormData();
  for (const k of ["name", "title", "item_name", "first_name", "last_name", "notes", "category", "message", "body",
    "vendor", "description", "label", "amount", "quantity", "estimated_cost", "cost", "servings", "email", "contact_email",
    "dietary_notes", "allergy_notes", "plus_one_count", "date", "start_time", "end_time", "location", "provider", "kind", "visibility",
    "subject", "guest_id", "gathering_guest_id", "headline", "welcome_message", "theme", "occasion", "mood", "text", "url", "status"]) f.set(k, k.includes("email") ? "a@b.test" : /amount|quantity|cost|servings|count/.test(k) ? "4" : "x");
  for (const k of ["photo", "file", "receipt", "image", "artwork"]) f.set(k, new File([new Uint8Array(16)], "a.png", { type: "image/png" }));
  return f;
}
function paramNames(fn: Function): string[] {
  const src = fn.toString();
  const m = src.match(/^(?:async\s+)?function\s*\w*\s*\(([\s\S]*?)\)\s*\{/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.replace(/=[\s\S]*$/, "").trim()).filter(Boolean);
}
function argsFor(fn: Function): unknown[] {
  const names = paramNames(fn);
  if (names.length === 1 && /^(input|args|params|opts)$/.test(names[0])) {
    return [{ gatheringId: "g-1", needName: "x", needQuantity: 1, closetItemId: "c-1", action: "yes", category: null, occasion: "x", theme: "x", moodDescriptors: [], visionNotes: "x" }];
  }
  return names.map((n, i) => {
    if (i === 0) return "g-1";
    if (/form/i.test(n)) return formFor();
    if (/hidden|visible|returned|bool/i.test(n)) return true;
    if (/titles|tasks|list|items/i.test(n)) return ["x"];
    if (/^value$/.test(n)) return "guest:x";
    if (/servings|days|total|count|amount|leftover/i.test(n)) return 4;
    if (/^input$|^options?$|^data$/.test(n)) return { occasion: "x", theme: "x", moodDescriptors: [], visionNotes: "x" };
    if (/ids?$/i.test(n) && /guest|visible/i.test(n)) return [];
    return "x";
  });
}

const loaded: { mod: string; name: string; fn: Function }[] = [];
before(async () => {
  for (const [mod, skip] of Object.entries(MODULES)) {
    const m = await import(mod);
    for (const [name, fn] of Object.entries(m)) {
      if (typeof fn === "function" && !skip.includes(name)) loaded.push({ mod, name, fn: fn as Function });
    }
  }
});

// RPCs that only READ (entitlement/workspace lookups); every other rpc/from-write/storage/function call counts as a write.
const READ_RPCS = new Set(["rpc:resolve_gathering_is_premium", "rpc:gathering_photo_workspace"]);
function isWrite(c: { kind: string; name: string }) { return c.kind === "write" && !READ_RPCS.has(c.name); }

describe("every mutating web action refuses read-only gatherings (no exceptions, any caller)", () => {
  test("coverage: the behavioural suite exercises a meaningful number of real actions", () => {
    assert.ok(loaded.length >= 50, `only ${loaded.length} actions loaded`);
  });

  for (const status of READ_ONLY) {
    for (const caller of CALLERS) {
      test(`${status} / ${caller.label}: refused, zero writes, read-only message`, async () => {
        const failures: string[] = [];
        for (const a of loaded) {
          const fake = makeFakeSupabase({ status, userId: caller.userId });
          (globalThis as any).__fakeSupabase = fake;
          let res: any;
          try { res = await a.fn(...argsFor(a.fn)); } catch (e) { failures.push(`${a.name}: threw ${(e as Error).message}`); continue; }
          const writes = fake.calls.filter(isWrite);
          if (res?.ok !== false) failures.push(`${a.name}: ok=${res?.ok}`);
          else if (writes.length) failures.push(`${a.name}: WROTE ${writes.map((w: any) => w.name).join(",")}`);
          else if (OWN_REFUSAL_OK.has(a.name)) continue;
          else if (!fake.calls.some((c: any) => c.kind === "status")) failures.push(`${a.name}: never checked effective status (message=${res?.message})`);
          else if (res?.message !== GATHERING_READ_ONLY_MESSAGE) failures.push(`${a.name}: wrong message "${res?.message}"`);
        }
        assert.deepEqual(failures, []);
      });
    }
  }

  test("unknown/unreadable status fails closed for every action (no writes)", async () => {
    const failures: string[] = [];
    for (const a of loaded) {
      const fake = makeFakeSupabase({ status: null, userId: "u-cohost" });
      (globalThis as any).__fakeSupabase = fake;
      const res: any = await a.fn(...argsFor(a.fn)).catch((e: Error) => ({ ok: false, message: `threw ${e.message}` }));
      if (res?.ok !== false || fake.calls.some(isWrite)) failures.push(a.name);
    }
    assert.deepEqual(failures, []);
  });

  for (const status of LIVE) {
    test(`control: ${status} gatherings are NOT blocked by the guard`, async () => {
      const blocked: string[] = [];
      for (const a of loaded) {
        const fake = makeFakeSupabase({ status, userId: "u-owner" });
        (globalThis as any).__fakeSupabase = fake;
        const res: any = await a.fn(...argsFor(a.fn)).catch(() => ({ ok: true }));
        if (res?.message === GATHERING_READ_ONLY_MESSAGE || res?.message === GATHERING_STATUS_UNKNOWN_MESSAGE) blocked.push(a.name);
      }
      assert.deepEqual(blocked, []);
    });
  }
});

// ---- Static coverage: new gathering-scoped actions cannot silently skip the guard -----------------------
// Lifecycle + read-only getters are explicitly allowed. host-actions.ts is tracked as PENDING_OWNER: its guard
// is delivered as reports/patches/host-actions-readonly-guard.patch for the invitation/co-host owner to apply.
const LIFECYCLE_OR_READ = new Set(["createHouseholdWeb", "finishGathering", "cancelGathering", "gatherAgain", "finishMultiDayGathering",
  "getMultiDayAccessState", "getMultiDayLockInGate", "getMultiDayPassStep", "checkSmartClosetWeb", "countGatheringInvitees",
  "recordShareInitiatedWeb", "acceptCoHostInvitation", "declineCoHostInvitation", "reissueCoHostInvitation"]);
const PENDING_OWNER_FILES = new Set(["host-actions.ts"]);

describe("weather actions keep their own read-only guard (pre-existing message)", () => {
  for (const status of READ_ONLY) {
    test(`${status}: weather writes refused, zero writes`, async () => {
      const m: any = await import("../lib/weather-actions.ts");
      for (const [name, args] of [["saveWeatherLocation", ["g-1", "Austin", "outdoor"]], ["refreshWeatherForecast", ["g-1"]], ["saveWeatherContingency", ["g-1", [], false]]] as const) {
        const fake = makeFakeSupabase({ status, userId: "u-cohost" });
        (globalThis as any).__fakeSupabase = fake;
        const res: any = await m[name](...args);
        assert.equal(res.ok, false, name);
        assert.deepEqual(fake.calls.filter(isWrite), [], name);
      }
    });
  }
});

describe("static coverage of server-action files", () => {
  const dir = new URL("../lib/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith("-actions.ts") || f === "cohost-permissions.ts");
  test("every gathering-scoped export is guarded, lifecycle/read-only, or tracked pending", () => {
    const unguarded: string[] = []; const pending: string[] = [];
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), "utf8");
      if (!/^["']use server["']/m.test(src)) continue;
      const parts = src.split(/^(?=export async function )/m).slice(1);
      for (const p of parts) {
        const m = p.match(/^export async function (\w+)\s*\(([^)]*)\)/);
        if (!m) continue;
        const [, name, params] = m;
        const scoped = /^\s*(\{[^}]*)?gatheringId\b/.test(params) || /\bgatheringId\s*:/.test(params.split(",")[0] ?? "");
        if (!scoped || LIFECYCLE_OR_READ.has(name)) continue;
        const guarded = /gatheringWriteBlock\(/.test(p) || /effective_gathering_status/.test(p) || /assertWritable|ensureWritable|ensureEditable|readOnlyBlock/.test(p);
        if (guarded) continue;
        (PENDING_OWNER_FILES.has(f) ? pending : unguarded).push(`${f}:${name}`);
      }
    }
    assert.deepEqual(unguarded, [], "unguarded gathering-scoped actions");
    assert.ok(pending.every((p) => p.startsWith("host-actions.ts:")), "only host-actions may be pending");
  });
  test("lifecycle operations are NOT routed through the write guard (archive/finish/cancel/gather-again preserved)", () => {
    const src = readFileSync(new URL("host-lifecycle-actions.ts", dir), "utf8");
    assert.ok(!/gatheringWriteBlock/.test(src));
  });
});
