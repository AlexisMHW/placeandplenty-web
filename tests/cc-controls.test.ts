import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSwitches, parseSwitchForm } from "../lib/admin/controls.ts";
import { messageFor, knownCode } from "../lib/admin/messages.ts";
const fd = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
test("missing switch data is null, never guessed", () => {
  assert.equal(parseSwitches(null), null);
  const s = parseSwitches({ program_enabled: "yes" })!;
  assert.equal(s.programEnabled, null); assert.equal(s.applicationsOpen, null);
});
test("switch form needs kind, state and a reason", () => {
  assert.equal(parseSwitchForm(fd({ kind: "program", state: "on", reason: "" })).ok, false);
  assert.equal(parseSwitchForm(fd({ kind: "program", state: "maybe", reason: "abc" })).ok, false);
  assert.equal(parseSwitchForm(fd({ kind: "paid", state: "on", reason: "abc" })).ok, false);
  assert.equal(parseSwitchForm(fd({ kind: "applications", state: "on", reason: "abc", terms_version: "<b>" })).ok, false);
  const ok = parseSwitchForm(fd({ kind: "applications", state: "on", reason: "abc", terms_version: "v1" }));
  assert.ok(ok.ok && ok.kind === "applications" && ok.on && ok.termsVersion === "v1");
});
test("new codes have plain messages", () => {
  assert.notEqual(messageFor("terms_version_required"), messageFor("failed"));
  assert.equal(knownCode("terms_version_required"), "terms_version_required");
});
