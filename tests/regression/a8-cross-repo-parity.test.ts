// A8 regression: web copies of shared rules stay in step with each other and (when the native repo is checked out beside it) with native.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WEB_ROOT, walk, read, rel, stripComments } from "./scan-support.ts";
import { ASSIGNABLE_LEVELS, DEFAULT_INVITE_LEVEL, LEGACY_ALL_CAPABILITIES, can, parseMyCapabilities } from "../../lib/cohost-permissions.ts";
import { READ_ONLY_STATES, isReadOnlyStatus } from "../../lib/gathering-readonly.ts";
import { RESEND_COOLDOWN_SECONDS, resendSecondsRemaining, classifyAuthEmailError } from "../../lib/resend-cooldown.ts";
import { isGuestCountUnknown, resolveGuestCountState } from "../../lib/guest-count-state.ts";

const NATIVE = join(WEB_ROOT, "../placeandplenty-native");
const nativeFile = (p: string) => (existsSync(join(NATIVE, p)) ? readFileSync(join(NATIVE, p), "utf8") : null);

const ALL = ["edit_planning", "edit_core_details", "manage_guests", "manage_invitations", "manage_rsvp", "manage_budget", "start_purchase"] as const;
const MATRIX: Record<string, readonly string[]> = {
  planner: ["edit_planning"],
  manager: ["edit_planning", "edit_core_details", "manage_guests", "manage_invitations", "manage_rsvp", "manage_budget"],
  legacy_full: ALL,
};

test("co-host matrix (web): every level x capability", () => {
  for (const [level, caps] of Object.entries(MATRIX)) {
    const c = parseMyCapabilities({ isOwner: false, permissionLevel: level, capabilities: [...caps] });
    for (const cap of ALL) assert.equal(can(c, cap), caps.includes(cap), `${level}/${cap}`);
  }
  assert.equal(can(parseMyCapabilities({ isOwner: true, permissionLevel: "owner", capabilities: [] }), "start_purchase"), true);
  assert.equal(DEFAULT_INVITE_LEVEL, "planner");
  assert.deepEqual([...ASSIGNABLE_LEVELS], ["planner", "manager"]);
  for (const bad of [null, undefined, "x", {}]) assert.equal(parseMyCapabilities(bad), LEGACY_ALL_CAPABILITIES);
});

test("web co-host capability union equals native's", { skip: nativeFile("features/collaboration/permissions.ts") === null }, () => {
  const n = nativeFile("features/collaboration/permissions.ts")!;
  const w = read(join(WEB_ROOT, "lib/cohost-permissions.ts"));
  for (const cap of ALL) { assert.ok(n.includes(`'${cap}'`), `native ${cap}`); assert.ok(w.includes(`"${cap}"`), `web ${cap}`); }
});

test("D2 read-only states are the same three everywhere", () => {
  assert.deepEqual([...READ_ONLY_STATES], ["completed", "cancelled", "archived"]);
  for (const s of READ_ONLY_STATES) assert.equal(isReadOnlyStatus(s), true);
  for (const s of ["active", "draft", null, undefined, ""]) assert.equal(isReadOnlyStatus(s), false);
  const n = nativeFile("features/gatherings/readOnly.ts");
  if (n) assert.match(n, /\['completed', 'cancelled', 'archived'\]/);
});

test("resend cooldown: 60s, whole seconds, never locks on a backwards clock; matches native", () => {
  assert.equal(RESEND_COOLDOWN_SECONDS, 60);
  assert.equal(resendSecondsRemaining(1000, 1000), 60);
  assert.equal(resendSecondsRemaining(1000, 1000 + 59_001), 1);
  assert.equal(resendSecondsRemaining(5000, 1000), 0);
  assert.equal(resendSecondsRemaining(null, 1000), 0);
  assert.equal(classifyAuthEmailError({ status: 429 }), "rate_limited");
  const n = nativeFile("features/auth/services/resendCooldown.ts");
  if (n) assert.match(n, /RESEND_COOLDOWN_SECONDS = 60/);
});

test("unknown guest count is its own state, never zero", () => {
  assert.equal(isGuestCountUnknown({ guest_count_unknown: true, expected_guest_count: 0 }), true);
  assert.equal(isGuestCountUnknown({ expected_guest_count: null }), true);
  assert.equal(isGuestCountUnknown({}), false);
  assert.equal(isGuestCountUnknown({ expected_guest_count: 0 }), false);
  assert.equal(resolveGuestCountState({ guest_count_unknown: true }, { attendanceConfirmed: true }), "unknown");
  assert.equal(resolveGuestCountState({ expected_guest_count: 8 }), "estimated");
  assert.equal(resolveGuestCountState({ expected_guest_count: 8 }, { attendanceConfirmed: true }), "confirmed");
});

test("no web client module writes entitlement or money tables directly", () => {
  const MONEY = /(entitlement|payment_event|purchase_fact|commission|payout|referral|partner|hc_|cc_|sms_plan|sms_allowance|staff)/i;
  const bad: string[] = [];
  for (const f of ["app", "components"].flatMap((d) => walk(join(WEB_ROOT, d), [".ts", ".tsx"]))) {
    const src = read(f);
    if (!/^\s*["']use client["']/.test(src)) continue;
    for (const m of stripComments(src).matchAll(/\.from\(\s*["'`]([a-z_0-9]+)["'`]\s*\)\s*\.(insert|update|upsert|delete)\b/g)) if (MONEY.test(m[1])) bad.push(`${rel(f)}: ${m[1]}.${m[2]}`);
  }
  assert.deepEqual(bad, []);
});
