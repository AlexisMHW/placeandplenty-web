import test from "node:test";
import assert from "node:assert/strict";
import { deliverChecklist } from "../lib/checklist-delivery.ts";
import { CHECKLISTS } from "../lib/checklists.ts";

const input = { edition: "halloween", firstName: "Alexis", email: "host@example.com", consent: false, website: "" };
const config = { supabaseUrl: "https://test.example", anonKey: "test", brevoKey: "test", sender: "alexis@placeandplenty.com", listIds: { halloween: "12" } };
function mock(statuses: number[] = []) {
  const calls: { url: string; body: Record<string, unknown>; headers: HeadersInit | undefined }[] = [];
  const fetcher = (async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body)), headers: options?.headers });
    return Response.json({ success: true }, { status: statuses.shift() ?? 200 });
  }) as typeof fetch;
  return { fetcher, calls };
}
test("all five editions save the correct source and offer their matching PDF", async () => {
  for (const kit of CHECKLISTS) {
    const m = mock(); const response = await deliverChecklist({ ...input, edition: kit.slug }, "192.0.2.1", config, m.fetcher);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).download, `/checklists/put-together-get-together-${kit.slug}.pdf`);
    assert.equal((m.calls[0].body.data as Record<string, unknown>).source, `checklist_${kit.slug}`);
    assert.equal(m.calls.length, 2); // no newsletter without affirmative consent
  }
});
test("invalid input and honeypots make no external writes", async () => {
  for (const patch of [{ edition: "bad" }, { email: "bad" }, { consent: "true" }, { website: "spam" }]) {
    const m = mock(); await deliverChecklist({ ...input, ...patch }, "unknown", config, m.fetcher); assert.equal(m.calls.length, 0);
  }
});
test("rate limited or failed saves never send email or unlock through success", async () => {
  for (const status of [429, 500]) {
    const m = mock([status]); const r = await deliverChecklist(input, "unknown", config, m.fetcher);
    assert.equal(r.status, status === 429 ? 429 : 502); assert.equal(m.calls.length, 1);
  }
});
test("download remains available without Brevo or if email delivery fails", async () => {
  for (const settings of [{ ...config, brevoKey: undefined }, config]) {
    const m = mock([200, 500]); const r = await deliverChecklist(input, "unknown", settings, m.fetcher);
    const result = await r.json(); assert.equal(r.status, 200); assert.equal(result.emailSent, false); assert.ok(result.download.endsWith('.pdf'));
  }
});
test("newsletter consent adds only the edition list without resetting suppression", async () => {
  const m = mock(); const r = await deliverChecklist({ ...input, consent: true }, "unknown", config, m.fetcher);
  assert.equal((await r.json()).newsletterSynced, true);
  assert.equal(m.calls.length, 3); assert.deepEqual(m.calls[2].body.listIds, [12]);
  assert.equal(m.calls[2].body.updateEnabled, true); assert.equal("emailBlacklisted" in m.calls[2].body, false);
});
test("names are escaped in email HTML", async () => {
  const m = mock(); await deliverChecklist({ ...input, firstName: '<img src=x>' }, "unknown", config, m.fetcher);
  assert.ok(String(m.calls[1].body.htmlContent).includes('&lt;img src=x&gt;'));
  assert.ok(!String(m.calls[1].body.htmlContent).includes('<img src=x>'));
});

test("MailerLite receives only opted-in contacts without resetting status or groups", async () => {
  const settings = { ...config, brevoKey: undefined, mailerliteKey: "test", mailerliteGroupIds: { halloween: "123456789012345678" } };
  for (const consent of [false, true]) {
    const m = mock(); const response = await deliverChecklist({ ...input, consent }, "unknown", settings, m.fetcher);
    assert.equal((await response.json()).newsletterSynced, consent);
    assert.equal(m.calls.length, consent ? 2 : 1);
    if (consent) {
      assert.equal(m.calls[1].url, "https://connect.mailerlite.com/api/subscribers");
      assert.deepEqual(m.calls[1].body.groups, ["123456789012345678"]);
      assert.equal("status" in m.calls[1].body, false);
      assert.equal("resubscribe" in m.calls[1].body, false);
    }
  }
});
