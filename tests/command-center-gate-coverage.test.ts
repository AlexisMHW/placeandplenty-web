import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { navFor } from "../lib/admin/nav.ts";
import { parseAudit, parseStaff } from "../lib/admin/ops.ts";
import { STAFF_PERMISSIONS, type StaffContext } from "../lib/admin/access.ts";

// STRUCTURAL GATE COVERAGE. These tests read the source tree: every page and server action under the Command Center must call
// requireStaff with a permission, and nothing in it may use a service-role key. A new page that forgets the gate fails here.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
const ccFiles = walk(join(root, "app", "(command-center)")).filter((f) => /\.(ts|tsx)$/.test(f));

test("every Command Center page.tsx calls requireStaff with a concrete permission", () => {
  const pages = ccFiles.filter((f) => f.endsWith("page.tsx"));
  assert.ok(pages.length >= 7, `expected at least 7 pages, found ${pages.length}`);
  for (const p of pages) {
    const src = readFileSync(p, "utf8");
    assert.match(src, /requireStaff\(\s*"[a-z_.]+"/, `${p} must call requireStaff("<permission>", ...)`);
    assert.doesNotMatch(src, /requireStaff\(\s*undefined/, `${p} must not use the any-staff gate`);
  }
});

test("every server action file re-checks the permission before each exported action", () => {
  for (const f of ccFiles.filter((f) => /actions\.ts$/.test(f))) {
    const src = readFileSync(f, "utf8");
    const exported = (src.match(/export async function \w+/g) ?? []).length;
    const gated = (src.match(/requireStaff\(\s*"[a-z_.]+"/g) ?? []).length;
    assert.ok(exported > 0 && gated >= exported, `${f}: ${exported} actions, ${gated} gates`);
  }
});

test("the layout gates all staff and no Command Center or admin lib file uses a service-role key", () => {
  assert.match(readFileSync(join(root, "app", "(command-center)", "command-center", "layout.tsx"), "utf8"), /requireStaff\(/);
  for (const f of [...ccFiles, ...walk(join(root, "lib", "admin"))]) {
    const src = readFileSync(f, "utf8");

    assert.ok(!/SUPABASE_SERVICE_ROLE_KEY/.test(src), `${f} must not read the service-role key`);
  }
});

test("only the database may decide the role: no cookie, header or query-string role in the gate", () => {
  const src = readFileSync(join(root, "lib", "admin", "server.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/cookies\(|headers\(|searchParams/.test(src));
  assert.match(src, /auth\.getUser\(\)/);
  assert.ok(!/getSession\(/.test(src));
});

test("the Tina /admin route is untouched: middleware matcher still excludes it and no Command Center file lives under /admin", () => {
  const mw = readFileSync(join(root, "middleware.ts"), "utf8");
  assert.match(mw, /matcher:[\s\S]*\|admin\|/);
  assert.ok(!ccFiles.some((f) => /[\\/]app[\\/](admin|\(admin\))[\\/]/.test(f)));
  assert.ok(!/pathname\.startsWith\("\/admin/.test(mw));
});

test("middleware redirects signed-out /command-center and /creator and marks them no-store", () => {
  const mw = readFileSync(join(root, "middleware.ts"), "utf8");
  assert.match(mw, /startsWith\("\/command-center"\)[\s\S]*no-store/);
  assert.match(mw, /"\/creator"/);
});

const ctx = (permissions: StaffContext["permissions"]): StaffContext => ({ role: "support", permissions });
test("navigation shows only links the context may see, and never invents a permission", () => {
  assert.deepEqual(navFor(ctx([])), []);
  assert.deepEqual(navFor(ctx(["support.read"])).map((l) => l.label), ["Purchases and support"]);
  assert.deepEqual(navFor(ctx(["ops.read"])).map((l) => l.label), ["Email and SMS", "Integration health"]);
  assert.deepEqual(navFor(ctx(["overview.read"])).map((l) => l.label), ["Overview"]);
  const all = navFor(ctx([...STAFF_PERMISSIONS]));
  assert.ok(all.length >= 9);
});

test("staff and audit parsers drop malformed rows and cap the detail text", () => {
  assert.deepEqual(parseStaff(null), []);
  assert.equal(parseStaff([{ user_id: "u", role: "owner", status: "active", display_name: null }, { role: "x" }, 5]).length, 1);
  const rows = parseAudit([{ id: 3, action: "staff.grant_role", target_type: "user", detail: { previous_role: null, new_role: "support", nested: { a: 1 }, long: "x".repeat(100) } }, { id: "bad" }]);
  assert.equal(rows.length, 1);
  assert.match(rows[0].detail, /new_role=support/);
  assert.ok(!/nested/.test(rows[0].detail));
  assert.ok(rows[0].detail.length < 160);
});
