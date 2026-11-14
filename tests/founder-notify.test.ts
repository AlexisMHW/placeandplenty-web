import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FOUNDER_CATEGORIES, loadFounderNotifyConfig, raiseFounderNotification, attemptFounderEmail, recordFounderEmailEvent,
  createMemoryFounderStore, founderDedupKey, type FounderNotifyConfig,
} from "../lib/comms/founder-notify.ts";
import { createFakeProvider } from "../lib/comms/provider.ts";
import { createMemorySuppressionStore } from "../lib/comms/suppression.ts";

const goodEnv = { FOUNDER_NOTIFY_ENABLED: "true", FOUNDER_NOTIFICATION_EMAIL: "owner@example.test", FOUNDER_NOTIFICATION_EMAIL_VERIFIED: "true", SITE_URL: "https://example.test" };
let t = Date.parse("2026-11-14T12:00:00Z"); const clock = { now: () => new Date(t).toISOString() };
function mk(env: Record<string, string | undefined>, script: Parameters<typeof createFakeProvider>[0] = [], sendEnabled = true) {
  const store = createMemoryFounderStore(); const provider = createFakeProvider(script); let n = 0;
  const config = loadFounderNotifyConfig(env);
  const deps = { store, config, newId: () => `n${++n}`, nowIso: clock.now,
    dispatch: { provider, suppression: createMemorySuppressionStore(), hashKey: "k", sendEnabled } };
  return { store, provider, config, deps };
}

describe("configuration (destination never hardcoded; send only when verified)", () => {
  test("defaults are all OFF", () => {
    const c = loadFounderNotifyConfig({});
    assert.deepEqual([c.enabled, c.destination, c.destinationVerified], [false, null, false]);
  });
  test("source contains no email address literal", () => {
    const src = readFileSync("lib/comms/founder-notify.ts", "utf8");
    assert.doesNotMatch(src, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]{2,}/);
  });
  test("retry config is parsed and bounded", () => {
    const c = loadFounderNotifyConfig({ FOUNDER_NOTIFY_RETRY_SECONDS: "10, 20,x,-3", FOUNDER_NOTIFY_MAX_ATTEMPTS: "99" });
    assert.deepEqual(c.backoffSeconds, [10, 20]); assert.equal(c.maxAttempts, 10);
  });
});

describe("channel A inbox is always recorded; channel B only when verified", () => {
  for (const [name, env, reason] of [
    ["disabled", { ...goodEnv, FOUNDER_NOTIFY_ENABLED: undefined }, "disabled"],
    ["no destination", { ...goodEnv, FOUNDER_NOTIFICATION_EMAIL: undefined }, "no_destination"],
    ["unverified destination", { ...goodEnv, FOUNDER_NOTIFICATION_EMAIL_VERIFIED: undefined }, "destination_unverified"],
  ] as const) {
    test(`${name}: inbox record exists, email skipped (${reason}), provider untouched`, async () => {
      const { deps, provider } = mk(env);
      const r = await raiseFounderNotification(deps, { category: "hc_application_new", entityId: "app1" });
      assert.equal(r.emailEligible, false); assert.equal(r.notification.email.state, "skipped"); assert.equal(r.notification.email.skipReason, reason);
      await attemptFounderEmail(deps, r.notification); assert.equal(provider.calls, 0);
      assert.equal(deps.store.all.length, 1);
    });
  }
  test("global COMMS switch off: skipped as sending_disabled, still no provider call", async () => {
    const { deps, provider } = mk(goodEnv, [], false);
    const r = await raiseFounderNotification(deps, { category: "system_failure", entityId: "x" });
    const n = await attemptFounderEmail(deps, r.notification);
    assert.deepEqual([n.email.state, n.email.skipReason, provider.calls], ["skipped", "sending_disabled", 0]);
  });
});

describe("delivery truthfulness, dedup, severity, retry, audit", () => {
  test("queued != sent != delivered; delivered only from a provider event; body carries minimal data", async () => {
    const { deps, provider } = mk(goodEnv);
    const { notification } = await raiseFounderNotification(deps, { category: "payout_needs_approval", entityId: "p1" });
    assert.equal(notification.severity, "urgent");
    const n = await attemptFounderEmail(deps, notification);
    assert.equal(n.email.state, "sent");                                  // accepted by provider only
    const body = provider.sent[0].body + provider.sent[0].subject;
    assert.match(body, /Payout needs approval/); assert.match(body, /command-center\/inbox\/n1/);
    assert.doesNotMatch(body, /p1|\$|@/);                                 // no entity id, amounts or addresses
    assert.equal(provider.sent[0].to, "owner@example.test");
    await recordFounderEmailEvent(deps.store, n, "delivered", clock.now());
    assert.equal(n.email.state, "delivered");
    await recordFounderEmailEvent(deps.store, n, "accepted", clock.now()); // late duplicate cannot downgrade
    assert.equal(n.email.state, "delivered");
  });
  test("dedup: same open key => one inbox item, rising count, no second email", async () => {
    const { deps, provider, store } = mk(goodEnv);
    const a = await raiseFounderNotification(deps, { category: "comms_failed_or_delayed", entityId: "g1", bucket: "2026-11-14" });
    await attemptFounderEmail(deps, a.notification);
    const b = await raiseFounderNotification(deps, { category: "comms_failed_or_delayed", entityId: "g1", bucket: "2026-11-14" });
    assert.equal(b.deduped, true); assert.equal(b.emailEligible, false);
    assert.equal(store.all.length, 1); assert.equal(store.all[0].occurrences, 2); assert.equal(provider.calls, 1);
    const c = await raiseFounderNotification(deps, { category: "comms_failed_or_delayed", entityId: "g1", bucket: "2026-11-15" });
    assert.equal(c.deduped, false); assert.equal(store.all.length, 2);
    assert.notEqual(founderDedupKey("system_failure", "a"), founderDedupKey("system_failure", "b"));
  });
  test("every category has a label and a severity; severity can be overridden", async () => {
    for (const [k, v] of Object.entries(FOUNDER_CATEGORIES)) assert.ok(v.label && ["info", "attention", "urgent"].includes(v.severity), k);
    assert.equal(Object.keys(FOUNDER_CATEGORIES).length, 8);
    const { deps } = mk(goodEnv);
    assert.equal((await raiseFounderNotification(deps, { category: "hc_application_decided", entityId: "z", severity: "urgent" })).notification.severity, "urgent");
  });
  test("failures retry with backoff, honor nextAttemptAt, then fail finally; audit has every step", async () => {
    t = Date.parse("2026-11-14T12:00:00Z");
    const f = { status: "failed", failureReason: "x" } as const;
    const { deps, provider } = mk({ ...goodEnv, FOUNDER_NOTIFY_MAX_ATTEMPTS: "3", FOUNDER_NOTIFY_RETRY_SECONDS: "60,300" }, [f, f, f]);
    let { notification: n } = await raiseFounderNotification(deps, { category: "system_failure", entityId: "s" });
    n = await attemptFounderEmail(deps, n);
    assert.deepEqual([n.email.state, n.email.attempts], ["queued", 1]);
    assert.equal(n.email.nextAttemptAt, new Date(t + 60_000).toISOString());
    await attemptFounderEmail(deps, n); assert.equal(provider.calls, 1);        // too early: no new attempt
    t += 61_000; n = await attemptFounderEmail(deps, n);
    assert.deepEqual([n.email.state, n.email.attempts], ["queued", 2]);
    assert.equal(n.email.nextAttemptAt, new Date(t + 300_000).toISOString());
    t += 301_000; n = await attemptFounderEmail(deps, n);
    assert.deepEqual([n.email.state, n.email.attempts, n.email.nextAttemptAt], ["failed", 3, null]);
    t += 9_999_000; await attemptFounderEmail(deps, n); assert.equal(provider.calls, 3); // no attempts past the maximum
    assert.deepEqual(n.audit.map((a) => a.action), ["inbox_recorded", "email_retry_scheduled", "email_retry_scheduled", "email_failed_final"]);
  });
  test("a suppressed destination is recorded as suppressed, not retried", async () => {
    const { deps, provider } = mk(goodEnv);
    const { suppressAddress } = await import("../lib/comms/dispatch.ts");
    await suppressAddress(deps.dispatch, "owner@example.test", "complaint");
    const { notification } = await raiseFounderNotification(deps, { category: "hc_member_onboarded", entityId: "m" });
    const n = await attemptFounderEmail(deps, notification);
    assert.deepEqual([n.email.state, provider.calls], ["suppressed", 0]);
  });
  test("audit entries never contain addresses", async () => {
    const { deps } = mk(goodEnv);
    const { notification } = await raiseFounderNotification(deps, { category: "creator_content_submitted", entityId: "c" });
    const n = await attemptFounderEmail(deps, notification);
    assert.doesNotMatch(JSON.stringify(n.audit), /@/);
  });
});

describe("documented default destination is config-only", () => {
  const ADDR = ["alexis", "placeandplenty.com"].join("@"); // assembled so this test file is not itself a literal
  test("no source file (lib/app/components/supabase) contains the founder address literal", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        if (["node_modules", ".next", ".git"].includes(e)) continue;
        const p = `${d}/${e}`; const s = statSync(p);
        if (s.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs|json|sql)$/.test(e) && readFileSync(p, "utf8").includes(ADDR)) hits.push(p);
      }
    };
    for (const d of ["lib", "app", "components", "supabase", "scripts"]) { try { walk(d); } catch { /* dir absent */ } }
    // lib/checklist-delivery.ts has a PRE-EXISTING marketing replyTo literal (not founder notifications, not A4-owned); flagged in REPORT, not changed here.
    assert.deepEqual(hits.filter((h) => h !== "lib/checklist-delivery.ts"), []);
  });
  test("with the address configured but VERIFIED=false, nothing is sent; inbox still records", async () => {
    const { store, provider, deps } = mk({ FOUNDER_NOTIFY_ENABLED: "true", FOUNDER_NOTIFICATION_EMAIL: ADDR, FOUNDER_NOTIFICATION_EMAIL_VERIFIED: "false", SITE_URL: "https://example.test" });
    const r = await raiseFounderNotification(deps, { category: "payout_needs_approval", entityId: "p1" });
    assert.equal(r.emailEligible, false);
    await attemptFounderEmail(deps, r.notification);
    assert.equal(provider.calls, 0);
    assert.equal(store.all.length, 1);
  });
  test("documented in docs/ENV_COMMS.md with verified=false", () => {
    const doc = readFileSync("docs/ENV_COMMS.md", "utf8");
    assert.match(doc, /FOUNDER_NOTIFICATION_EMAIL_VERIFIED=false/);
    assert.ok(doc.includes(ADDR));
  });
});
