import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { createFakeProvider, createDisabledProvider } from "../lib/comms/provider.ts";
import { createMemorySuppressionStore, hashEmail } from "../lib/comms/suppression.ts";
import { dispatchEmail, suppressAddress, sendingEnabled, type DispatchDeps } from "../lib/comms/dispatch.ts";
import { applyProviderEvent, hostLabelFor, COMMS_STATUSES } from "../lib/comms/status.ts";
import { renderTemplate } from "../lib/comms/templates.ts";
import { planReminders } from "../lib/comms/reminders.ts";
import { commsReadOnlyBlock, READ_ONLY_COMMS_MESSAGE } from "../lib/comms/readonly-guard.ts";

const KEY = "test-only-hash-key";
function deps(over: Partial<DispatchDeps> = {}) {
  const provider = createFakeProvider();
  return { provider, suppression: createMemorySuppressionStore(), hashKey: KEY, sendEnabled: true, ...over } as DispatchDeps & { provider: ReturnType<typeof createFakeProvider> };
}
const msg = (to = "guest@example.com", k = "pp/1/1") => ({ to, subject: "s", body: "b", idempotencyKey: k });

describe("send switch (hard default OFF)", () => {
  test("only the exact string 'true' enables sending", () => {
    for (const v of [undefined, "", "1", "TRUE", "yes", " true"]) assert.equal(sendingEnabled({ COMMS_SEND_ENABLED: v }), false);
    assert.equal(sendingEnabled({ COMMS_SEND_ENABLED: "true" }), true);
  });
  test("disabled: record stays queued and the provider is never called", async () => {
    const d = deps({ sendEnabled: false });
    const r = await dispatchEmail(d, msg());
    assert.deepEqual([r.status, r.reason], ["queued", "sending_disabled"]);
    assert.equal(d.provider.calls, 0);
  });
  test("the disabled provider refuses every send", async () => {
    const r = await createDisabledProvider().send({ to: "a@b.co", subject: "s", body: "b", idempotencyKey: "k" });
    assert.equal(r.status, "failed"); assert.equal(r.failureReason, "comms_sending_disabled");
  });
});

describe("journey: invitation email lifecycle with a fake provider", () => {
  test("sent is not delivered; delivered needs a provider event; host label stays honest", async () => {
    const d = deps();
    const r = await dispatchEmail(d, msg());
    assert.equal(r.status, "sent");
    assert.equal(hostLabelFor(r.status), "accepted");            // never "delivered" yet
    const delivered = applyProviderEvent(r.status, "delivered");
    assert.equal(delivered, "delivered"); assert.equal(hostLabelFor(delivered), "delivered");
  });
  test("out-of-order events never downgrade", () => {
    assert.equal(applyProviderEvent("delivered", "accepted"), "delivered");
    assert.equal(applyProviderEvent("delivered", "delayed"), "delivered");
    assert.equal(applyProviderEvent("sent", "delayed"), "delayed");
    assert.equal(applyProviderEvent("queued", "failed"), "failed");
  });
  test("bounce and complaint are terminal and read as 'undeliverable' to the host (no disclosure)", () => {
    for (const ev of ["bounced", "complained"] as const) {
      const s = applyProviderEvent("delivered", ev);
      assert.ok(s === "bounced" || s === "suppressed");
      assert.equal(hostLabelFor(s), "undeliverable");
      assert.equal(applyProviderEvent(s, "delivered"), s);
    }
  });
  test("unknown status never produces a stronger claim", () => {
    assert.equal(hostLabelFor("mystery"), "queued"); assert.equal(hostLabelFor(null), "queued");
    assert.ok(!COMMS_STATUSES.includes("opened" as never));
  });
  test("retried worker run with the same idempotency key delivers once", async () => {
    const d = deps();
    await dispatchEmail(d, msg("a@b.co", "pp/9/9")); await dispatchEmail(d, msg("a@b.co", "pp/9/9"));
    assert.equal(d.provider.sent.length, 1);
  });
  test("provider failure and thrown errors become 'failed', never an exception", async () => {
    const f = deps({ provider: createFakeProvider([{ status: "failed", failureReason: "rejected" }, "throw"]) });
    assert.deepEqual((await dispatchEmail(f, msg("a@b.co", "k1"))).reason, "provider_failed");
    assert.deepEqual((await dispatchEmail(f, msg("a@b.co", "k2"))).reason, "provider_error");
  });
  test("invalid recipient fails before any provider call", async () => {
    const d = deps(); const r = await dispatchEmail(d, msg("not-an-email"));
    assert.deepEqual([r.status, r.reason], ["failed", "invalid_recipient"]); assert.equal(d.provider.calls, 0);
  });
});

describe("journey: unsubscribe and suppression", () => {
  test("unsubscribe suppresses future sends; address is stored only as a keyed hash", async () => {
    const d = deps();
    assert.equal((await dispatchEmail(d, msg("Guest@Example.com", "k1"))).status, "sent");
    assert.equal(await suppressAddress(d, "guest@example.com", "unsubscribe"), true);
    const r = await dispatchEmail(d, msg("GUEST@example.com", "k2"));      // case-insensitive match
    assert.deepEqual([r.status, r.reason], ["suppressed", "recipient_suppressed"]);
    assert.equal(d.provider.sent.length, 1);
    for (const k of (d.suppression as ReturnType<typeof createMemorySuppressionStore>).entries.keys()) assert.doesNotMatch(k, /@|example/);
  });
  test("a bounce suppresses the address; other addresses are unaffected", async () => {
    const d = deps(); await suppressAddress(d, "dead@example.com", "bounce");
    assert.equal((await dispatchEmail(d, msg("dead@example.com", "k1"))).status, "suppressed");
    assert.equal((await dispatchEmail(d, msg("alive@example.com", "k2"))).status, "sent");
  });
  test("missing hash key: write fails closed (reports false), read does not block mail", async () => {
    const d = deps({ hashKey: undefined });
    assert.equal(await suppressAddress(d, "a@b.co", "unsubscribe"), false);
    assert.equal((await dispatchEmail(d, msg())).status, "sent");
    assert.equal(await hashEmail("a@b.co", undefined), null);
  });
});

describe("template API (nothing invented)", () => {
  test("HC approve/decline render through the public API with no money/legal terms", () => {
    const a = renderTemplate("hc_application_approved", { displayName: "Sam" }, { baseUrl: "https://example.test/" });
    assert.ok(a.ok && a.text.includes("https://example.test/creator"));
    const dcl = renderTemplate("hc_application_declined", { displayName: "Sam", note: "Reapply later" });
    assert.ok(dcl.ok && dcl.text.includes("Reapply later"));
    for (const t of [a, dcl]) if (t.ok) assert.doesNotMatch(t.text, /\$|%|commission|payout|tax|earn/i);
  });
  test("missing config returns an error instead of a made-up default", () => {
    assert.deepEqual(renderTemplate("hc_application_approved", { displayName: "S" }, {}), { ok: false, error: "missing_config" });
    assert.deepEqual(renderTemplate("gathering_reminder", { gatheringName: "Dinner" }, {}), { ok: false, error: "missing_config" });
    assert.deepEqual(renderTemplate("nope", {}, {}), { ok: false, error: "unknown_template" });
  });
  test("reminder uses only owner-supplied wording and the support line only when supplied", () => {
    const cfg = { reminder: { subject: "Soon: {gatheringName}", body: "Hi from {hostName}" } };
    const r = renderTemplate("gathering_reminder", { gatheringName: "Dinner", hostName: "Alex" }, cfg);
    assert.ok(r.ok && r.subject === "Soon: Dinner" && r.text === "Hi from Alex");
    const r2 = renderTemplate("gathering_reminder", { gatheringName: "Dinner" }, { ...cfg, supportLine: "Questions? Reply here." });
    assert.ok(r2.ok && r2.text.endsWith("Questions? Reply here."));
  });
  test("header injection is flattened", () => {
    const r = renderTemplate("hc_application_declined", { displayName: "Sam\r\nBcc: x@y.z" });
    assert.ok(r.ok && !/\r|\n.*Bcc/.test(r.text.split("\n")[0]));
  });
});

describe("reminder cadence is configured, never defaulted", () => {
  const start = "2026-12-20T18:00:00.000Z"; const now = Date.parse("2026-12-01T00:00:00Z");
  test("no config => no reminders", () => { assert.deepEqual(planReminders(start, null, now), []); assert.deepEqual(planReminders(start, { offsetsHoursBefore: [] }, now), []); });
  test("configured offsets are ordered, deduped, and never in the past", () => {
    const out = planReminders(start, { offsetsHoursBefore: [24, 168, 24, 1, -5, 100000] }, now);
    assert.deepEqual(out.map((o) => o.hoursBefore), [168, 24, 1]);
    assert.equal(planReminders(start, { offsetsHoursBefore: [24] }, Date.parse("2026-12-20T00:00:00Z")).length, 0);
  });
  test("bad start date => none", () => assert.deepEqual(planReminders("nope", { offsetsHoursBefore: [1] }, now), []));
});

describe("D2: completed/cancelled/archived gatherings block invitations and guest updates (fail closed)", () => {
  const db = (data: unknown, error: unknown = null) => ({ rpc: async () => ({ data, error }) });
  test("terminal states are blocked with one message, active states pass", async () => {
    for (const s of ["completed", "cancelled", "archived"]) assert.equal(await commsReadOnlyBlock(db(s), "g"), READ_ONLY_COMMS_MESSAGE);
    for (const s of ["draft", "active", "hosting"]) assert.equal(await commsReadOnlyBlock(db(s), "g"), null);
  });
  test("unreadable status refuses the action", async () => {
    assert.ok(await commsReadOnlyBlock(db(null, { message: "x" }), "g"));
    assert.ok(await commsReadOnlyBlock(db(null), "g"));
    assert.ok(await commsReadOnlyBlock({ rpc: async () => { throw new Error("net"); } }, "g"));
  });
  test("every guest-comms and invitation server action calls the guard before its write", () => {
    const need: [string, string[]][] = [
      ["lib/guest-experience-actions.ts", ["set_guest_page_content", "publish_guest_update", "delete_guest_update"]],
      ["lib/share-by-text-actions.ts", ["record_invitation_share_initiated"]],
      ["lib/host-actions.ts", ["create_gathering_invitation", "save_invitation_artwork"]],
    ];
    for (const [f, rpcs] of need) {
      const src = readFileSync(f, "utf8");
      for (const rpc of rpcs) {
        const at = src.indexOf(`"${rpc}"`); assert.ok(at > 0, `${rpc} present`);
        const before = src.slice(Math.max(0, at - 700), at);
        assert.match(before, /commsReadOnlyBlock|gatheringWriteBlock/, `${f}: ${rpc} is guarded`);
      }
    }
  });
});

describe("hard guarantees: no network or real provider in lib/comms", () => {
  test("no fetch/resend/telnyx/http in the comms library", () => {
    for (const f of readdirSync("lib/comms")) {
      const src = readFileSync(`lib/comms/${f}`, "utf8").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(src, /\bfetch\(|api\.resend|telnyx|https?:\/\/(?!example)|XMLHttpRequest|node:https?/i, f);
    }
  });
});
