import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeMessage, dispatchDeliveries, eventHref, eventLabel, EVENT_LABELS, parseDestinations, parseEvents, parseHealth, rpcDeps, type ClaimedDelivery, type DispatchDeps } from "../lib/hc/events.ts";

const D = (o: Partial<ClaimedDelivery> = {}): ClaimedDelivery => ({ id: 1, event_id: 9, channel: "staff_email", destination_id: "d", attempts: 1, kind: "application_received", ref_type: "creator_application", ref_id: "abc", severity: "action", ...o });
function deps(over: Partial<DispatchDeps> & { claimed?: ClaimedDelivery[]; sends?: any[]; records?: any[] } = {}) {
  const records: any[] = over.records ?? []; const sends: any[] = over.sends ?? [];
  const d: DispatchDeps = {
    enabled: true, siteUrl: "https://example.test",
    mailer: { async send(to, m, o) { sends.push({ to, m, o }); return { ok: true, providerId: "prov-1" }; } },
    async claim() { return over.claimed ?? [D()]; },
    async recipient() { return { email: "ops@example.test", kind: "application_received" }; },
    async record(id, outcome, code, prov) { records.push({ id, outcome, code, prov }); },
    ...over,
  };
  return { d, records, sends };
}

test("dispatcher is OFF by default and when no mailer: nothing is claimed or sent", async () => {
  const a = deps({ enabled: false }); let claimed = false; a.d.claim = async () => { claimed = true; return []; };
  assert.deepEqual(await dispatchDeliveries(a.d), { ran: false, reason: "dispatch_disabled", claimed: 0, sent: 0, failed: 0, skipped: 0 });
  assert.equal(claimed, false);
  const b = deps({ mailer: null });
  assert.equal((await dispatchDeliveries(b.d)).reason, "mailer_not_configured");
});

test("a successful send is recorded as SENT (never delivered) with the provider id", async () => {
  const x = deps(); const r = await dispatchDeliveries(x.d);
  assert.equal(r.sent, 1);
  assert.deepEqual(x.records, [{ id: 1, outcome: "sent", code: undefined, prov: "prov-1" }]);
  assert.equal(x.sends[0].o.idempotencyKey, "hc-delivery-1");
  assert.ok(!x.records.some((r) => r.outcome === "delivered"));
});

test("send failure is recorded as failed with a safe code; provider text is not passed through", async () => {
  const x = deps({ mailer: { async send() { return { ok: false, code: "Provider said: 550 secret@x.com" }; } } });
  const r = await dispatchDeliveries(x.d);
  assert.equal(r.failed, 1); assert.deepEqual(x.records, [{ id: 1, outcome: "failed", code: "send_failed", prov: undefined }]);
  const y = deps({ mailer: { async send() { return { ok: false, code: "rate_limited" }; } } });
  await dispatchDeliveries(y.d); assert.equal(y.records[0].code, "rate_limited");
});

test("a thrown error is contained: recorded as failed, the batch continues", async () => {
  let n = 0;
  const x = deps({ claimed: [D({ id: 1 }), D({ id: 2 })], mailer: { async send() { n++; if (n === 1) throw new Error("boom with address a@b.com"); return { ok: true }; } } });
  const r = await dispatchDeliveries(x.d);
  assert.deepEqual([r.sent, r.failed], [1, 1]);
  assert.deepEqual(x.records.map((r) => [r.id, r.outcome, r.code]), [[1, "failed", "dispatch_error"], [2, "sent", undefined]]);
});

test("no recipient (not verified, no consent, deleted) => skipped, nothing sent", async () => {
  const x = deps({ recipient: async () => null });
  const r = await dispatchDeliveries(x.d);
  assert.equal(r.skipped, 1); assert.equal(x.sends.length, 0); assert.deepEqual(x.records, [{ id: 1, outcome: "skipped", code: "no_recipient", prov: undefined }]);
});

test("unknown event kind => skipped (no template), nothing sent", async () => {
  const x = deps({ claimed: [D({ kind: "mystery" })] }); const r = await dispatchDeliveries(x.d);
  assert.equal(r.skipped, 1); assert.equal(x.sends.length, 0);
});

test("staff email carries NO names, emails, amounts or ids: only the event label and a link", () => {
  for (const kind of Object.keys(EVENT_LABELS)) {
    const m = composeMessage(D({ kind, ref_id: "SECRET-REF-123" }), { email: "ops@example.test", display_name: "Jane Doe", kind }, "https://example.test")!;
    const all = m.subject + m.text;
    assert.doesNotMatch(all, /SECRET-REF-123|Jane|ops@example|\$\d/);
    assert.match(m.text, /https:\/\/example\.test\/command-center\/hosting-collective/);
  }
});

test("applicant emails: approved and declined use the approved templates; declined never includes an internal note; other kinds send nothing", () => {
  const ap = composeMessage(D({ channel: "applicant_email", kind: "application_approved" }), { email: "a@example.test", display_name: "Sam", kind: "application_approved" }, "https://example.test")!;
  assert.match(ap.text, /Hi Sam/); assert.match(ap.text, /https:\/\/example\.test\/creator/); assert.doesNotMatch(ap.text, /\$|commission|%/i);
  const de = composeMessage(D({ channel: "applicant_email", kind: "application_declined" }), { email: "a@example.test", display_name: "Sam", kind: "application_declined" }, "https://example.test")!;
  assert.doesNotMatch(de.text, /note from our team/i);
  assert.equal(composeMessage(D({ channel: "applicant_email", kind: "payout_needs_approval" }), { email: "a@example.test", kind: "x" }, "https://example.test"), null);
});

test("limit is clamped to 1..50", async () => {
  let seen = 0; const x = deps(); x.d.claim = async (n) => { seen = n; return []; };
  await dispatchDeliveries(x.d, 9999); assert.equal(seen, 50);
  await dispatchDeliveries(x.d, 0); assert.equal(seen, 1);
});

test("rpcDeps adapter calls the service RPCs with the right arguments and fails closed on errors", async () => {
  const calls: any[] = [];
  const client = { async rpc(fn: string, args?: any) { calls.push([fn, args]);
    if (fn === "hc_claim_deliveries") return { data: [D(), { id: "bad" }, D({ id: 3, channel: "applicant_email" })], error: null };
    if (fn === "hc_delivery_recipient") return { data: { email: "e@example.test", kind: "k" }, error: null };
    return { data: null, error: args?.p_id === 99 ? { message: "db down" } : null }; } };
  const dd = rpcDeps(client, { enabled: true, siteUrl: "https://example.test", mailer: null });
  assert.equal((await dd.claim(5)).length, 2);
  assert.equal((await dd.recipient(1))?.email, "e@example.test");
  await dd.record(1, "sent", undefined, "p");
  await assert.rejects(dd.record(99, "failed", "x"), /record_failed/);
  assert.deepEqual(calls[0], ["hc_claim_deliveries", { p_limit: 5, p_channel: null }]);
  assert.deepEqual(calls[2], ["hc_record_delivery_result", { p_id: 1, p_outcome: "sent", p_error: null, p_provider_id: "p" }]);
  const bad = rpcDeps({ async rpc() { return { data: null, error: { message: "x" } }; } }, { enabled: true, siteUrl: "", mailer: null });
  assert.deepEqual(await bad.claim(1), []); assert.equal(await bad.recipient(1), null);
});

test("event/destination/health parsing is tolerant and never exposes a full address", () => {
  assert.equal(parseEvents("x"), null);
  assert.deepEqual(parseEvents([{ id: 1, kind: "member_suspended", ref_type: "partner", ref_id: "p", severity: "weird", deliveries: { queued: 2, junk: "x" } }, { id: "no" }]),
    [{ id: 1, kind: "member_suspended", refType: "partner", refId: "p", severity: "info", createdAt: null, acknowledgedAt: null, deliveries: { queued: 2 } }]);
  assert.deepEqual(parseDestinations([{ id: "d", label: "Ops", address_masked: "op***@example.test", verified: false, active: false }]), [{ id: "d", label: "Ops", addressMasked: "op***@example.test", verified: false, active: false }]);
  assert.deepEqual(parseHealth({ by_status: { "staff_email:queued": 3 }, oldest_queued_minutes: 7, failed: 1, active_destinations: 1, unverified_destinations: 2 }), { byStatus: { "staff_email:queued": 3 }, oldestQueuedMinutes: 7, failed: 1, activeDestinations: 1, unverifiedDestinations: 2 });
  assert.equal(parseHealth(null), null);
});

test("labels and links: every event kind has a label; links go to Command Center HC pages only", () => {
  for (const k of Object.keys(EVENT_LABELS)) assert.ok(eventLabel(k).length > 3);
  assert.equal(eventLabel("zzz"), "Notification");
  for (const t of ["creator_application", "payout", "submission", "partner", "other"]) assert.match(eventHref("x", t), /^\/command-center\/hosting-collective\//);
});

test("static: no email address, secret or provider key is hardcoded in lib/hc/events.ts; no SMS", () => {
  const s = readFileSync(new URL("../lib/hc/events.ts", import.meta.url), "utf8");
  assert.doesNotMatch(s, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.(com|org|net|io|co)/);
  assert.doesNotMatch(s, /sk_live|sk_test|rk_|re_[A-Za-z0-9]{10}|SERVICE_ROLE/);
  assert.doesNotMatch(s, /telnyx|twilio|sms/i);
});
