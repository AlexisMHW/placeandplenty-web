import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canStartPurchase, isPurchaseRefusal, myPurchaseCapabilities, splitPurchasable, PURCHASE_NOT_ALLOWED_MESSAGE } from "../lib/purchase-permission.ts";
import { parseMyCapabilities } from "../lib/cohost-permissions.ts";

// FOUNDER DECISION C: only owners and full (legacy_full) co-hosts may start a Gathering Pass purchase; planner and manager co-hosts may not.
const PLANNER = { isOwner: false, permissionLevel: "planner", capabilities: ["edit_planning"] };
const MANAGER = { isOwner: false, permissionLevel: "manager", capabilities: ["edit_planning", "edit_core_details", "manage_guests", "manage_invitations", "manage_rsvp", "manage_budget"] };
const FULL = { isOwner: false, permissionLevel: "legacy_full", capabilities: ["edit_planning", "edit_core_details", "manage_guests", "manage_invitations", "manage_rsvp", "manage_budget", "start_purchase"] };
const OWNER = { isOwner: true, permissionLevel: "owner", capabilities: [] };
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

describe("canStartPurchase uses the existing start_purchase capability", () => {
  test("owner and full co-host yes; planner and manager no", () => {
    assert.equal(canStartPurchase(parseMyCapabilities(OWNER)), true);
    assert.equal(canStartPurchase(parseMyCapabilities(FULL)), true);
    assert.equal(canStartPurchase(parseMyCapabilities(MANAGER)), false);
    assert.equal(canStartPurchase(parseMyCapabilities(PLANNER)), false);
  });
});

describe("gathering picker split (checkout page)", () => {
  const answers: Record<string, unknown> = { own: OWNER, full: FULL, mgr: MANAGER, plan: PLANNER };
  const client: any = { rpc: async (fn: string, a: { p_gathering_id: string }) => (fn === "get_my_gathering_capabilities" ? { data: answers[a.p_gathering_id], error: null } : { data: null, error: { message: "unexpected" } }) };
  test("only gatherings the person may buy for are offered; the rest are reported as blocked", async () => {
    const gs = ["own", "full", "mgr", "plan"].map((id) => ({ id, name: id }));
    const { allowed, blocked } = await splitPurchasable(client, gs);
    assert.deepEqual(allowed.map((g) => g.id), ["own", "full"]);
    assert.deepEqual(blocked.map((g) => g.id), ["mgr", "plan"]);
  });
  test("asks the capability RPC with the gathering id", async () => {
    const seen: unknown[] = [];
    await myPurchaseCapabilities({ rpc: async (fn, args) => { seen.push([fn, args]); return { data: OWNER, error: null }; } }, "g-1");
    assert.deepEqual(seen, [["get_my_gathering_capabilities", { p_gathering_id: "g-1" }]]);
  });
  test("backend not migrated or a failed lookup keeps legacy behaviour (the database still decides at purchase time)", async () => {
    for (const rpc of [async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }), async () => { throw new Error("net"); }]) {
      assert.equal(canStartPurchase(await myPurchaseCapabilities({ rpc } as any, "g")), true);
    }
  });
});

describe("server refusal mapping", () => {
  test("not-authorized style refusals map to the clear message; unrelated errors do not", () => {
    for (const e of [{ message: "not_authorized" }, { message: "not authorized" }, { code: "42501", message: "x" }]) assert.equal(isPurchaseRefusal(e), true);
    for (const e of [null, { message: "stripe failed" }, { code: "PGRST202", message: "function does not exist" }]) assert.equal(isPurchaseRefusal(e as any), false);
    assert.match(PURCHASE_NOT_ALLOWED_MESSAGE, /host or a co-host with full access/);
  });
});

describe("wiring", () => {
  test("/api/checkout re-checks the capability before any purchase intent and maps the database refusal; never forwards raw error text", () => {
    const route = read("app/api/checkout/route.ts");
    const check = route.indexOf("canStartPurchase(await myPurchaseCapabilities(");
    const intent = route.indexOf('rpc("create_purchase_intent"');
    assert.ok(check > 0 && intent > check, "capability check must come before create_purchase_intent");
    assert.match(route, /isPurchaseRefusal\(intentError\)\) return notAllowedBack\(\)/);
    assert.match(route, /purchase: "not-allowed"/);
  });
  test("checkout page filters the picker and the action hides the purchase control with the clear message", () => {
    const page = read("app/(marketing)/checkout/[product]/page.tsx");
    assert.match(page, /splitPurchasable\(/);
    assert.match(page, /notPurchasable=\{/);
    const act = read("app/(marketing)/checkout/[product]/CheckoutAction.tsx");
    assert.match(act, /gatherings\.length === 0 && \(notPurchasable\.length > 0 \|\| notice === "not-allowed"\)/);
    assert.match(act, /PURCHASE_NOT_ALLOWED_MESSAGE/);
    // the not-allowed panel returns before the purchase form is rendered
    assert.ok(act.indexOf("Ask the host to buy this") < act.indexOf('action="/api/checkout"'));
  });
});
