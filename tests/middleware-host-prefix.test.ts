import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression: `pathname.startsWith("/host")` also matched the PUBLIC /hosting-collective pages and sent anonymous visitors
// (including creators applying) to /login. The signed-in-only area is /host and /host/*, nothing else.
test("middleware gates /host exactly, not every path that merely starts with the letters 'host'", () => {
  const src = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.ok(!/pathname\.startsWith\("\/host"\)/.test(src), 'must not use startsWith("/host")');
  assert.ok(/pathname === "\/host" \|\| pathname\.startsWith\("\/host\/"\)/.test(src));
});
