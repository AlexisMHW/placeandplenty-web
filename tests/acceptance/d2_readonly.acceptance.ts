// D2 (founder 2026-11-14): completed and cancelled gatherings follow production-intended lifecycle restrictions, NO new exceptions,
// gate ON by design (no flag), enforced on web/native/DB/edge/co-host/invitations/menus/shopping, incl. indirect edits.
// This file = WEB layer. DB + edge enforcement: docs/qa/d2_db_guard_scan.mjs and docs/qa/sql/d2_readonly_db.acceptance.sql (NOT RUN until QA is authorised).
import test from "node:test";
import assert from "node:assert/strict";
import { read, walk } from "./helpers.ts";
import { isReadOnlyStatus, READ_ONLY_STATES } from "../../lib/gathering-readonly.ts";

test("D2 rule: completed, cancelled, archived are read-only; every live state is editable", () => {
  assert.deepEqual([...READ_ONLY_STATES].sort(), ["archived", "cancelled", "completed"]);
  for (const s of ["completed", "cancelled", "archived"]) assert.equal(isReadOnlyStatus(s), true, s);
  for (const s of ["draft", "active", "planning", "hosting", "locked", "", null, undefined]) assert.equal(isReadOnlyStatus(s as never), false, String(s));
});

test("D2 gate is ON by design: the web rule has no environment flag or off-switch", () => {
  const s = read("lib/gathering-readonly.ts");
  assert.doesNotMatch(s, /process\.env|\bFLAG\b|_ENABLED/i, "read-only rule must not be flag-controlled");
});

// UI-layer coverage (heuristic): any file that CALLS a gathering-mutating RPC must also consult the shared rule or an equivalent readOnly prop.
const MUTATING = /^(menu_|shopping_|people_|send_|set_|save_|remove_|assign_|publish_|delete_|select_|add_|respond_to|cancel_contribution|release_|music_media_upsert|create_gathering_invitation|record_invitation_share|move_gathering_activity_day|gather_again)/;
function callsMutating(src: string): string[] {
  return [...src.matchAll(/\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/g)].map((m) => m[1]).filter((n) => MUTATING.test(n));
}
const GUARD = /(isReadOnlyStatus|readOnly|read_only|effectiveStatus|effective_status|isArchived|isTerminal)/;

test("D2 web: UI-layer CANDIDATES: files calling a mutating RPC with no read-only awareness in the same file (heuristic; callers/DB may still guard - confirm with docs/qa/sql/d2_readonly_db.acceptance.sql in QA)", () => {
  const files = [...walk("app"), ...walk("components"), ...walk("lib")].filter((f) => !/command-center|\(creator\)|paper-suite|checkout|billing/.test(f));
  const offenders = files.flatMap((f) => { const s = read(f); const c = callsMutating(s); return c.length && !GUARD.test(s) ? [`${f}: ${[...new Set(c)].join(", ")}`] : []; });
  assert.equal(offenders.length, 0, `${offenders.length} file(s) call a mutating RPC with no read-only awareness (UI layer; DB must still enforce):\n${offenders.join("\n")}`);
});

test("D2 indirect edits: co-host, invitation and member-management mutations are gated", () => {
  const INDIRECT = /(set_cohost_permission_level|remove_gathering_member|create_gathering_invitation|send_gathering_invitation|publish_guest_update|send_guest_message|save_invitation_artwork|remove_invitation_artwork)/;
  const files = [...walk("app"), ...walk("components"), ...walk("lib")];
  const offenders = files.filter((f) => { const s = read(f); return INDIRECT.test(s) && /\.rpc\(/.test(s) && !GUARD.test(s); });
  assert.deepEqual(offenders, [], `ungated indirect-edit surfaces: ${offenders.join(", ")}`);
});

test("D2: authorised lifecycle ops (archive/unarchive/gather_again) are not part of the read-only rule", () => {
  // web has no archive RPC caller today (archive lives in native/DB), so only assert the rule helper does not name lifecycle operations.
  const code = read("lib/gathering-readonly.ts").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /gather_again|unarchive|archive_gathering/);
});
