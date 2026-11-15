import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { gatheringWriteBlock, photoWriteBlock, GATHERING_READ_ONLY_MESSAGE, GATHERING_STATUS_UNKNOWN_MESSAGE } from "../lib/gathering-write-guard.ts";
import { photoControlsOpen } from "../lib/gathering-photo-window.ts";
import { READ_ONLY_COMMS_MESSAGE } from "../lib/comms/readonly-guard.ts";
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
// host-actions.ts: every gathering-scoped write action, run for real (D1). Non-scoped / lifecycle / read helpers excluded.
const HOST_ACTIONS_SKIP = ["saveGatheringDraft", "finaliseGatheringCreation", "countGatheringInvitees", "recordShareInitiatedWeb", "acceptCoHostInvitation", "declineCoHostInvitation", "createGatheringWithDetails",
  // user-scoped (guest book / closet belong to the user, not a gathering):
  "addGuestBookPerson", "updateGuestBookPerson", "setGuestSaved", "deleteGuestBookPerson", "addClosetItem", "updateClosetItem", "archiveClosetItem", "restoreClosetItem",
  // validate their arguments before touching the database; exercised with valid arguments in the explicit test below:
  "inviteCoHost", "reissueCoHostInvitation", "saveInvitationArtwork", "setCoHostPermission", "setContributionStatus", "setRsvpStatus", "setShoppingStatus"];
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
  "../lib/host-actions.ts": HOST_ACTIONS_SKIP,
};

// Pre-existing, stricter-or-equal refusals that fire before the shared guard (photo workspace already refuses).
const COMMS_GUARDED = new Set(["inviteCoHost", "reissueCoHostInvitation", "saveInvitationArtwork"]); // guarded via commsReadOnlyBlock (same status RPC, comms wording)
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
          else if (res?.message !== GATHERING_READ_ONLY_MESSAGE && !(COMMS_GUARDED.has(a.name) && res?.message === READ_ONLY_COMMS_MESSAGE)) failures.push(`${a.name}: wrong message "${res?.message}"`);
        }
        assert.deepEqual(failures, []);
      });
    }
  }

  test("host-actions with validated arguments: refused on read-only, zero writes (D1)", async () => {
    const m: any = await import("../lib/host-actions.ts");
    const form = new FormData(); form.set("invited_email", "a@b.test");
    const calls: [string, unknown[]][] = [
      ["inviteCoHost", ["g-1", form]], ["reissueCoHostInvitation", ["g-1", "a@b.test"]],
      ["saveInvitationArtwork", ["g-1", "g-1/a.png", "image/png", "a.png"]], ["removeCoHost", ["g-1", "m-1"]],
      ["setCoHostPermission", ["g-1", "m-1", "planner"]], ["setContributionStatus", ["g-1", "c-1", "confirmed"]],
      ["setRsvpStatus", ["g-1", "guest-1", "yes"]], ["setShoppingStatus", ["g-1", "s-1", "bought"]],
    ];
    const failures: string[] = [];
    for (const status of READ_ONLY) for (const [name, args] of calls) {
      const fake = makeFakeSupabase({ status, userId: "u-cohost" });
      (globalThis as any).__fakeSupabase = fake;
      const res: any = await m[name](...args);
      if (res?.ok !== false || fake.calls.some(isWrite) || !fake.calls.some((c: any) => c.kind === "status")) failures.push(`${status}:${name}:${res?.message}`);
    }
    assert.deepEqual(failures, []);
  });

  test("host-actions translate() maps the database gathering_read_only error to a clear message", async () => {
    const src = readFileSync(new URL("../lib/host-actions.ts", import.meta.url), "utf8");
    assert.match(src, /raw\.includes\("gathering_read_only"\)/);
    assert.match(src, /finished or cancelled, so it can't be changed/);
  });

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
// host-actions.ts is fully guarded now; no file is allowed to be "pending".
// Draft-only creation steps are not read-only-gated: saveGatheringDraft edits a draft the caller is composing and
// finaliseGatheringCreation only flips status draft->active (it is a lifecycle step and has .eq("status","draft")).
LIFECYCLE_OR_READ.add("saveGatheringDraft");
LIFECYCLE_OR_READ.add("finaliseGatheringCreation");

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
  test("every gathering-scoped export is guarded or lifecycle/read-only (no pending allowance)", () => {
    const unguarded: string[] = [];
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
        const guarded = /gatheringWriteBlock\(|photoWriteBlock\(/.test(p) || /effective_gathering_status/.test(p) || /assertWritable|ensureWritable|ensureEditable|readOnlyBlock|commsReadOnlyBlock/.test(p);
        if (guarded) continue;
        unguarded.push(`${f}:${name}`);
      }
    }
    assert.deepEqual(unguarded, [], "unguarded gathering-scoped actions");
  });
  test("lifecycle operations are NOT routed through the write guard (archive/finish/cancel/gather-again preserved)", () => {
    const src = readFileSync(new URL("host-lifecycle-actions.ts", dir), "utf8");
    assert.ok(!/gatheringWriteBlock/.test(src));
  });
});

// ---- Founder decision B: the photo actions are the ONLY exception, and only inside the photo-sharing window ----------
// The window is the database's own (gathering_lifecycle_ends_at = event end + retention, strict `now() < ends_at`, surfaced by
// gathering_photo_workspace as expiresAt). These tests mirror that definition only to build fixtures; production code invents no length.
const PHOTO_ACTIONS = new Set(["uploadGatheringPhotoWeb", "setGatheringPhotoHiddenWeb", "deleteGatheringPhotoWeb"]);
const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30; // fixture only: mirrors supabase gathering_lifecycle_ends_at (event end + 30 days)
const eventEnd = Date.parse("2026-06-01T20:00:00Z");
const windowEnd = new Date(eventEnd + WINDOW_DAYS * DAY).toISOString();

describe("photoWriteBlock window boundary (injected clock)", () => {
  const ws = { expiresAt: windowEnd, editable: true };
  const at = (ms: number) => photoWriteBlock(makeFakeSupabase({ status: "completed", photoWorkspace: ws }), "g-1", new Date(ms));
  test("completed, day 29 after the event: allowed", async () => assert.equal(await at(eventEnd + 29 * DAY), null));
  test("completed, 1 ms before the window end: allowed", async () => assert.equal(await at(eventEnd + WINDOW_DAYS * DAY - 1), null));
  test("completed, exactly at the window end (day 30 boundary, database uses strict <): refused", async () => assert.deepEqual(await at(eventEnd + WINDOW_DAYS * DAY), { ok: false, message: GATHERING_READ_ONLY_MESSAGE }));
  test("completed, day 31: refused", async () => assert.deepEqual(await at(eventEnd + 31 * DAY), { ok: false, message: GATHERING_READ_ONLY_MESSAGE }));
  test("cancelled inside the window: refused (no exception)", async () => {
    const r = await photoWriteBlock(makeFakeSupabase({ status: "cancelled", photoWorkspace: ws }), "g-1", new Date(eventEnd + 5 * DAY));
    assert.deepEqual(r, { ok: false, message: GATHERING_READ_ONLY_MESSAGE });
  });
  test("archived inside the window: refused (no exception)", async () => {
    const r = await photoWriteBlock(makeFakeSupabase({ status: "archived", photoWorkspace: ws }), "g-1", new Date(eventEnd + 5 * DAY));
    assert.deepEqual(r, { ok: false, message: GATHERING_READ_ONLY_MESSAGE });
  });
  test("completed but the server says not editable, window unreadable or missing: refused (server can only restrict, fails closed)", async () => {
    for (const photoWorkspace of [{ expiresAt: windowEnd, editable: false }, { expiresAt: "", editable: true }, { expiresAt: "not-a-date", editable: true }, null]) {
      const r = await photoWriteBlock(makeFakeSupabase({ status: "completed", photoWorkspace }), "g-1", new Date(eventEnd + DAY));
      assert.deepEqual(r, { ok: false, message: GATHERING_READ_ONLY_MESSAGE });
    }
  });
  test("live gatherings are not affected and the status stays fail-closed", async () => {
    assert.equal(await photoWriteBlock(makeFakeSupabase({ status: "active" }), "g-1"), null);
    assert.equal((await photoWriteBlock(makeFakeSupabase({ status: null }), "g-1"))?.message, GATHERING_STATUS_UNKNOWN_MESSAGE);
  });
});

describe("read-only sweep: photo actions are the ONLY exception, only on completed gatherings inside the window", () => {
  const scenarios: { label: string; status: string; daysAfterEvent: number; photosAllowed: boolean }[] = [
    { label: "completed, day 29", status: "completed", daysAfterEvent: 29, photosAllowed: true },
    { label: "completed, day 30 boundary", status: "completed", daysAfterEvent: 30, photosAllowed: false },
    { label: "completed, day 31", status: "completed", daysAfterEvent: 31, photosAllowed: false },
    { label: "cancelled, day 5", status: "cancelled", daysAfterEvent: 5, photosAllowed: false },
    { label: "archived, day 5", status: "archived", daysAfterEvent: 5, photosAllowed: false },
  ];
  for (const sc of scenarios) {
    for (const caller of CALLERS) {
      test(`${sc.label} / ${caller.label}: every non-photo action refused with zero writes; photo actions ${sc.photosAllowed ? "allowed" : "refused"}`, async () => {
        const failures: string[] = [];
        // "now" is the real clock; the window end is placed so that today is `daysAfterEvent` days after the event.
        const expiresAt = new Date(Date.now() + (WINDOW_DAYS - sc.daysAfterEvent) * DAY).toISOString();
        for (const a of loaded) {
          const fake = makeFakeSupabase({ status: sc.status, userId: caller.userId, photoWorkspace: { expiresAt, editable: true } });
          (globalThis as any).__fakeSupabase = fake;
          const res: any = await a.fn(...argsFor(a.fn)).catch((e: Error) => ({ ok: false, message: `threw ${e.message}` }));
          const writes = fake.calls.filter(isWrite);
          if (PHOTO_ACTIONS.has(a.name) && sc.photosAllowed) {
            if (res?.ok !== true) failures.push(`${a.name}: should be allowed, got ${res?.message}`);
            continue;
          }
          if (res?.ok !== false) failures.push(`${a.name}: ok=${res?.ok}`);
          else if (writes.length) failures.push(`${a.name}: WROTE ${writes.map((w: any) => w.name).join(",")}`);
          else if (PHOTO_ACTIONS.has(a.name) && res?.message !== GATHERING_READ_ONLY_MESSAGE) failures.push(`${a.name}: wrong message "${res?.message}"`);
        }
        assert.deepEqual(failures, []);
      });
    }
  }
  test("the three photo actions all exist in the swept set", () => {
    for (const n of PHOTO_ACTIONS) assert.ok(loaded.some((a) => a.name === n), n);
  });
});

describe("photoWriteBlock is used ONLY by the three photo actions", () => {
  test("no other server-action file or function references photoWriteBlock", () => {
    const dir = new URL("../lib/", import.meta.url);
    const users: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts") || f === "gathering-write-guard.ts") continue;
      const src = readFileSync(new URL(f, dir), "utf8");
      if (/photoWriteBlock/.test(src)) users.push(f);
    }
    assert.deepEqual(users, ["gathering-photos-actions.ts"]);
    const src = readFileSync(new URL("gathering-photos-actions.ts", dir), "utf8");
    const parts = src.split(/^(?=export async function )/m).slice(1);
    const using = parts.filter((p) => /photoWriteBlock\(/.test(p)).map((p) => p.match(/^export async function (\w+)/)![1]);
    assert.deepEqual(using.sort(), [...PHOTO_ACTIONS].sort());
    for (const p of parts) assert.ok(!/gatheringWriteBlock\(/.test(p), "photo actions must not mix guards");
  });
  test("photo page offers controls only through photoControlsOpen (server flag can only restrict)", () => {
    const page = readFileSync(new URL("../app/(host)/host/g/[id]/photos/page.tsx", import.meta.url), "utf8");
    assert.match(page, /workspace\.editable && photoControlsOpen\(/);
    assert.ok(!/editable=\{workspace\.editable\}/.test(page));
  });
});

describe("photoControlsOpen (page helper)", () => {
  const end = windowEnd;
  test("window states", () => {
    const at = (s: string, ms: number) => photoControlsOpen({ effectiveStatus: s, expiresAt: end }, new Date(ms));
    assert.equal(at("completed", eventEnd + 29 * DAY), true);
    assert.equal(at("completed", eventEnd + 30 * DAY), false);
    assert.equal(at("completed", eventEnd + 31 * DAY), false);
    assert.equal(at("cancelled", eventEnd + DAY), false);
    assert.equal(at("archived", eventEnd + DAY), false);
    assert.equal(at("active", eventEnd - DAY), true);
    assert.equal(photoControlsOpen({ effectiveStatus: "completed", expiresAt: null }), false);
    assert.equal(photoControlsOpen({ effectiveStatus: "", expiresAt: end }), false);
  });
});
