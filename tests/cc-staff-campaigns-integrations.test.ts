import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStaffForm } from "../lib/admin/staff.ts";
import { parseAssignForm, parseCampaignForm, parseCampaigns } from "../lib/admin/campaigns.ts";
import { ADAPTERS, probeAll, probeIntegration } from "../lib/admin/integrations.ts";
import { navFor } from "../lib/admin/nav.ts";

const F = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const U = "123e4567-e89b-42d3-a456-426614174000";

test("staff form: grant/revoke validated; owner needs confirmation; bad ids and roles refused", () => {
  assert.deepEqual(parseStaffForm(F({ kind: "grant", user_id: U, role: "support" })), { ok: true, value: { kind: "grant", userId: U, role: "support" } });
  assert.deepEqual(parseStaffForm(F({ kind: "revoke", user_id: U })), { ok: true, value: { kind: "revoke", userId: U } });
  assert.deepEqual(parseStaffForm(F({ kind: "grant", user_id: U, role: "owner" })), { ok: false, error: "owner_confirmation_required" });
  assert.deepEqual(parseStaffForm(F({ kind: "grant", user_id: U, role: "owner", confirm_owner: "yes" })).ok, true);
  assert.deepEqual(parseStaffForm(F({ kind: "grant", user_id: "x", role: "support" })), { ok: false, error: "invalid_user_id" });
  assert.deepEqual(parseStaffForm(F({ kind: "grant", user_id: U, role: "root" })), { ok: false, error: "invalid_role" });
  assert.deepEqual(parseStaffForm(F({ kind: "nuke", user_id: U })), { ok: false, error: "invalid_action" });
});
test("campaign form limits and niche allowlist", () => {
  assert.equal(parseCampaignForm(F({ title: "Spring table", brief: "Show a spring table." })).ok, true);
  assert.deepEqual(parseCampaignForm(F({ title: "x", brief: "Show a spring table." })), { ok: false, error: "invalid_title" });
  assert.deepEqual(parseCampaignForm(F({ title: "Spring", brief: "short" })), { ok: false, error: "invalid_brief" });
  assert.deepEqual(parseCampaignForm(F({ title: "Spring", brief: "Long enough brief", niche: "crypto" })), { ok: false, error: "invalid_niche" });
  assert.deepEqual(parseCampaignForm(F({ title: "Spring", brief: "Long enough brief", compensation_terms: "abc" })), { ok: false, error: "invalid_compensation" });
  assert.equal(parseAssignForm(F({ campaign_id: U, partner_id: U })).ok, true);
  assert.equal(parseAssignForm(F({ campaign_id: U, partner_id: "no" })).ok, false);
  assert.deepEqual(parseCampaigns([{ id: "a", title: "T", status: "draft", assigned: 2 }, { id: "b", title: "T", status: "weird" }, null]), [{ id: "a", title: "T", brief: "", niche: null, status: "draft", hasCompensation: false, assigned: 2 }]);
  assert.equal(parseCampaigns({}), null);
});
test("integration probes: off by default, need a key, never leak it, no network when off", async () => {
  let calls = 0; const f = async () => { calls++; return { ok: true, status: 200 }; };
  assert.deepEqual((await probeAll({}, f)).map((p) => p.status), ["off", "off", "off", "off"]); assert.equal(calls, 0);
  assert.equal((await probeIntegration(ADAPTERS[0], { CC_INTEGRATION_STRIPE: "true" }, f)).status, "not_configured");
  const ok = await probeIntegration(ADAPTERS[0], { CC_INTEGRATION_STRIPE: "true", CC_STRIPE_READONLY_KEY: "rk_test_SECRET" }, f);
  assert.equal(ok.status, "ok"); assert.ok(!JSON.stringify(ok).includes("SECRET")); assert.equal(calls, 1);
  const bad = await probeIntegration(ADAPTERS[2], { CC_INTEGRATION_MAILERLITE: "true", CC_MAILERLITE_READONLY_KEY: "k" }, async () => ({ ok: false, status: 401 }));
  assert.deepEqual([bad.status, bad.note], ["failed", "Provider answered 401."]);
  const thrown = await probeIntegration(ADAPTERS[1], { CC_INTEGRATION_REVENUECAT: "true", CC_REVENUECAT_READONLY_KEY: "k" }, async () => { throw new Error("boom k"); });
  assert.ok(thrown.status === "failed" && !thrown.note.includes("boom"));
  assert.equal((await probeIntegration(ADAPTERS[3], { CC_INTEGRATION_GA4: "true", CC_GA4_SERVICE_ACCOUNT: "x" }, f)).status, "not_implemented");
});
test("probes are GET-only (read-only) and nothing forwards credentials anywhere but the provider", async () => {
  const seen: string[] = []; await probeAll({ CC_INTEGRATION_STRIPE: "true", CC_STRIPE_READONLY_KEY: "k", CC_INTEGRATION_MAILERLITE: "true", CC_MAILERLITE_READONLY_KEY: "k" }, async (u, i) => { seen.push(`${i.method} ${new URL(u).host}`); return { ok: true, status: 200 }; });
  assert.deepEqual(seen, ["GET api.stripe.com", "GET connect.mailerlite.com"]);
});
test("nav: staff access link only for staff.manage; campaigns for hc.read", () => {
  const owner = navFor({ role: "owner", permissions: ["staff.manage", "hc.read", "overview.read"] });
  assert.ok(owner.some((l) => l.href === "/command-center/ops/staff") && owner.some((l) => l.href.endsWith("/campaigns")));
  const sup = navFor({ role: "support", permissions: ["support.read", "overview.read"] });
  assert.ok(!sup.some((l) => l.href.includes("/staff") || l.href.includes("/campaigns")));
});
