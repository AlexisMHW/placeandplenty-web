import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { decideAccess, parseStaffContext } from "../lib/admin/access.ts";
import { clampDays, funnelRows, parseOverview } from "../lib/admin/overview.ts";

const ctx = (role: string, permissions: string[]) => ({ role, permissions });
const OWNER = ctx("owner", ["overview.read", "staff.manage", "audit.read"]);
const SUPPORT = ctx("support", ["support.read", "support.manage"]);
const CPM = ctx("creator_program_manager", ["overview.read", "hc.read", "hc.manage"]);

test("unauthenticated visitor is sent to login, whatever the context says", () => {
  assert.deepEqual(decideAccess({ signedIn: false, rawContext: null }, "overview.read"), { kind: "login" });
  assert.deepEqual(decideAccess({ signedIn: false, rawContext: OWNER }, "overview.read"), { kind: "login" });
});

test("signed-in non-staff user (including an external creator) gets not_found", () => {
  assert.deepEqual(decideAccess({ signedIn: true, rawContext: null }, "overview.read"), { kind: "not_found" });
  assert.deepEqual(decideAccess({ signedIn: true, rawContext: null }), { kind: "not_found" });
});

test("external creator claiming a role the matrix does not know is rejected", () => {
  assert.equal(parseStaffContext(ctx("external_creator", ["overview.read"])), null);
  assert.deepEqual(decideAccess({ signedIn: true, rawContext: ctx("external_creator", ["overview.read"]) }, "overview.read"), { kind: "not_found" });
});

test("support staff lack overview.read -> not_found; keep support.read", () => {
  assert.deepEqual(decideAccess({ signedIn: true, rawContext: SUPPORT }, "overview.read"), { kind: "not_found" });
  assert.equal(decideAccess({ signedIn: true, rawContext: SUPPORT }, "support.read").kind, "allow");
});

test("wrong role: creator program manager cannot read revenue or manage staff", () => {
  assert.equal(decideAccess({ signedIn: true, rawContext: CPM }, "revenue.read").kind, "not_found");
  assert.equal(decideAccess({ signedIn: true, rawContext: CPM }, "staff.manage").kind, "not_found");
  assert.equal(decideAccess({ signedIn: true, rawContext: CPM }, "overview.read").kind, "allow");
});

test("owner is allowed and the group gate (no permission) admits any active staff", () => {
  assert.equal(decideAccess({ signedIn: true, rawContext: OWNER }, "overview.read").kind, "allow");
  assert.equal(decideAccess({ signedIn: true, rawContext: SUPPORT }).kind, "allow");
});

test("malformed context never grants access", () => {
  for (const bad of [undefined, 5, "owner", [], {}, { role: "owner" }, { role: "owner", permissions: "all" }, { role: 7, permissions: [] }]) {
    assert.deepEqual(decideAccess({ signedIn: true, rawContext: bad }, "overview.read"), { kind: "not_found" });
  }
});

test("unknown permission strings are dropped, not trusted", () => {
  const parsed = parseStaffContext(ctx("owner", ["overview.read", "god.mode"]));
  assert.deepEqual(parsed?.permissions, ["overview.read"]);
  assert.equal(decideAccess({ signedIn: true, rawContext: ctx("owner", ["god.mode"]) }, "overview.read").kind, "not_found");
});

test("overview parsing: valid payload, zero registered, malformed payload", () => {
  const good = {
    window_days: 30,
    cohort_funnel: { registered: 9, email_confirmed: 9, signed_in: 7, created_gathering: 6, locked_in_gathering: 5, shared_an_invitation: 0, paid: 0 },
    window_activity: { gatherings_created: 2 },
    paid_purchases_in_window: { gathering_pass: 1 },
    hosting_collective: { status: "not_available" },
  };
  const o = parseOverview(good);
  assert.ok(o);
  assert.equal(o.funnel.registered, 9);
  assert.equal(o.activity.gatherings_locked_in, null);
  assert.equal(o.hostingCollectiveAvailable, false);
  assert.equal(funnelRows(o.funnel)[2].percentOfRegistered, 77.8);
  const empty = parseOverview({ ...good, cohort_funnel: { ...good.cohort_funnel, registered: 0, signed_in: 0 } });
  assert.equal(funnelRows(empty!.funnel)[0].percentOfRegistered, null);
  assert.equal(parseOverview(null), null);
  assert.equal(parseOverview({ cohort_funnel: { registered: -1 } }), null);
  assert.equal(parseOverview({ ...good, cohort_funnel: { ...good.cohort_funnel, paid: "x" } }), null);
});

test("window parameter is clamped to 7, 30 or 90", () => {
  assert.equal(clampDays("7"), 7);
  assert.equal(clampDays("90"), 90);
  assert.equal(clampDays("9999"), 30);
  assert.equal(clampDays(undefined), 30);
  assert.equal(clampDays(["7", "90"]), 7);
});

// ---- structural guards: no client-only checks, no service role, gate present ----
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const ccFiles = [...walk("app/(command-center)"), ...walk("lib/admin")];

test("no Command Center file is a client component or uses the service-role key", () => {
  for (const f of ccFiles) {
    const src = readFileSync(f, "utf8");
    // Phase 2: a client component is allowed ONLY for a form that posts to a server action. It may not touch Supabase or any key.
    if (/^\s*["']use client["']/m.test(src)) {
      assert.ok(!/supabase|createClient|process\.env/i.test(src.replace(/\/\/.*$/gm, "")), `${f}: a client file must not touch Supabase or env`);
      // Reviewed exception: the shared ActionForm wrapper. It receives the server action as a PROP (it imports no server code), only shows a mapped message.
      if (/_components[\\/]action-form\.tsx$/.test(f)) {
        const imports = [...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
        assert.deepEqual(imports.sort(), ["@/lib/admin/messages", "react-dom"], `${f}: ActionForm may import only react-dom and the message map`);
      } else assert.match(src, /from "\.\/actions"/, `${f}: a client file may only call its sibling server action`);
    }
    assert.ok(!/service_role|SERVICE_ROLE/.test(src.replace(/\/\/.*$/gm, "")), `${f} must not use the service role`);
  }
});

test("layout and page both call requireStaff; page requires overview.read; layout is dynamic and noindex", () => {
  const layout = readFileSync("app/(command-center)/command-center/layout.tsx", "utf8");
  const page = readFileSync("app/(command-center)/command-center/page.tsx", "utf8");
  assert.match(layout, /requireStaff\(/);
  assert.match(page, /requireStaff\("overview\.read"/);
  assert.match(layout, /force-dynamic/);
  assert.match(layout, /index:\s*false/);
});

test("server gate uses getUser (not getSession) and the database role lookup", () => {
  const s = readFileSync("lib/admin/server.ts", "utf8");
  assert.match(s, /auth\.getUser\(\)/);
  assert.ok(!/getSession/.test(s.replace(/\/\/.*$/gm, "")));
  assert.match(s, /get_my_staff_context/);
});

test("middleware gates /command-center for signed-out users and sets no-store", () => {
  const m = readFileSync("middleware.ts", "utf8");
  assert.match(m, /startsWith\("\/command-center"\)/);
  assert.match(m, /private, no-store/);
});

test("route does not collide with the Tina /admin output", () => {
  assert.ok(!ccFiles.some((f) => /app\/\(command-center\)\/admin/.test(f)));
});
