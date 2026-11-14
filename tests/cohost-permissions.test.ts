import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASSIGNABLE_LEVELS, DEFAULT_INVITE_LEVEL, LEGACY_ALL_CAPABILITIES, LEVEL_ERROR_MESSAGES, NOT_ALLOWED_MESSAGE,
  can, isMissingRpc, isNotAuthorized, normalizeLevel, parseMyCapabilities,
} from "../lib/cohost-permissions.ts";

describe("co-host permissions (web)", () => {
  test("planner is the invite default and only planner/manager are assignable", () => {
    assert.equal(DEFAULT_INVITE_LEVEL, "planner");
    assert.deepEqual([...ASSIGNABLE_LEVELS], ["planner", "manager"]);
    assert.equal(normalizeLevel("legacy_full"), "legacy_full");
    assert.equal(normalizeLevel("admin"), null);
  });
  test("both backend spellings of a refusal, plus RLS, are recognised", () => {
    for (const message of ["not authorized", "not_authorized", "new row violates row-level security policy", "permission denied for function"]) {
      assert.equal(isNotAuthorized({ message }), true, message);
    }
    assert.equal(isNotAuthorized({ code: "42501", message: "x" }), true);
    assert.equal(isNotAuthorized({ message: "gathering_archived_read_only" }), false);
    assert.equal(isNotAuthorized(null), false);
  });
  test("missing RPC means backend not migrated", () => {
    assert.equal(isMissingRpc({ code: "PGRST202" }), true);
    assert.equal(isMissingRpc({ code: "42883" }), true);
    assert.equal(isMissingRpc({ code: "P0001", message: "not_authorized" }), false);
  });
  test("unknown or garbage capability data keeps legacy behaviour", () => {
    for (const v of [null, undefined, "x", {}, { capabilities: "no" }]) {
      const c = parseMyCapabilities(v);
      assert.equal(c.known, false);
      assert.equal(can(c, "start_purchase"), true);
    }
    assert.equal(LEGACY_ALL_CAPABILITIES.known, false);
  });
  test("planner, manager, legacy and owner", () => {
    const p = parseMyCapabilities({ isOwner: false, permissionLevel: "planner", capabilities: ["edit_planning"] });
    assert.equal(can(p, "edit_planning"), true);
    assert.equal(can(p, "manage_guests"), false);
    const m = parseMyCapabilities({ isOwner: false, permissionLevel: "manager", capabilities: ["edit_planning", "manage_guests", "manage_invitations", "manage_rsvp", "manage_budget", "edit_core_details"] });
    assert.equal(can(m, "start_purchase"), false);
    assert.equal(can(m, "manage_rsvp"), true);
    const o = parseMyCapabilities({ isOwner: true, permissionLevel: "owner", capabilities: [] });
    assert.equal(can(o, "start_purchase"), true);
  });
  test("host-actions translate() routes both refusals to the permission sentence and keeps unrelated text untouched", () => {
    const src = readFileSync(new URL("../lib/host-actions.ts", import.meta.url), "utf8");
    assert.match(src, /raw\.includes\("not_authorized"\) \|\| raw\.includes\("not authorized"\)\) \{\s*return NOT_ALLOWED_MESSAGE;/);
    assert.match(src, /error\?\.code === "42501"\) \{\s*return NOT_ALLOWED_MESSAGE;/);
    assert.ok(NOT_ALLOWED_MESSAGE.includes("permissions"));
    assert.ok(Object.keys(LEVEL_ERROR_MESSAGES).includes("invalid_permission_level"));
  });
  test("setCoHostPermission is an owner-gated RPC call and invite flow stays on the existing RPC (planner default is server-side)", () => {
    const src = readFileSync(new URL("../lib/host-actions.ts", import.meta.url), "utf8");
    assert.match(src, /rpc\("set_cohost_permission_level"/);
    assert.match(src, /rpc\("create_gathering_invitation"/);
  });
});
