import test from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyStatus } from "../lib/gathering-readonly.ts";

test("terminal states are read-only", () => {
  for (const s of ["completed", "cancelled", "archived"]) assert.equal(isReadOnlyStatus(s), true);
});
test("live states are not", () => {
  for (const s of ["draft", "active", "hosting", "", null, undefined]) assert.equal(isReadOnlyStatus(s), false);
});
