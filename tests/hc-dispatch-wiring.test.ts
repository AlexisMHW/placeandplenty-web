import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { submitApplicationReview } from "../lib/hc/review-flow.ts";
import { afterApplicationDecision, hcDispatchEnabled, mailerFromProvider, runHcDispatch } from "../lib/hc/dispatch-runner.ts";
import { createDisabledProvider, createFakeProvider } from "../lib/comms/provider.ts";
import type { ClaimedDelivery } from "../lib/hc/events.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const input = (decision: string) => ({ id: ID, decision, tier: "", note: "", code: "" }) as any;
const delivery: ClaimedDelivery = { id: 7, event_id: 3, channel: "applicant_email", destination_id: null, attempts: 1, kind: "application_approved", ref_type: "creator_application", ref_id: ID, severity: "info" };

/** Fake DB: hc_review_application enqueues exactly one applicant_email delivery for approved/declined (mirrors DB suite t215003 C15/C16). */
function fakeDb() {
  const calls: { fn: string; args: any }[] = []; const queue: ClaimedDelivery[] = [];
  const client: any = {
    calls, queue,
    async rpc(fn: string, args: any) {
      calls.push({ fn, args });
      if (fn === "hc_review_application" && (args.p_decision === "approved" || args.p_decision === "declined")) queue.push({ ...delivery, id: queue.length + 1, kind: args.p_decision === "approved" ? "application_approved" : "application_declined" });
      if (fn === "hc_claim_deliveries") return { data: queue.splice(0), error: null };
      if (fn === "hc_delivery_recipient") return { data: { email: "member@example.test", display_name: "Sam", kind: "x" }, error: null };
      return { data: null, error: null };
    },
  };
  return client;
}

test("approval triggers exactly one enqueue (one decision RPC, no extra enqueue) and then runs the hook once", async () => {
  const db = fakeDb(); let hookCalls = 0;
  const r = await submitApplicationReview(db, input("approved"), async (d) => { hookCalls++; assert.equal(d, "approved"); });
  assert.deepEqual(r, { ok: true, code: "saved" });
  assert.equal(db.calls.filter((c: any) => c.fn === "hc_review_application").length, 1);
  assert.equal(db.calls.length, 1, "no other RPC (no second enqueue) from the web action");
  assert.equal(db.queue.length, 1, "exactly one queued applicant delivery");
  assert.equal(hookCalls, 1);
});

test("a failed decision enqueues nothing and does not run the hook; hook errors never change the saved decision", async () => {
  let hook = 0;
  const bad: any = { rpc: async () => ({ error: { message: "application_closed" } }) };
  assert.deepEqual(await submitApplicationReview(bad, input("approved"), async () => { hook++; }), { ok: false, code: "application_closed" });
  assert.equal(hook, 0);
  const db = fakeDb();
  assert.deepEqual(await submitApplicationReview(db, input("approved"), async () => { throw new Error("boom"); }), { ok: true, code: "saved" });
});

test("hook only reacts to approved/declined and never throws", async () => {
  let runs = 0; const run = async () => { runs++; return { ran: false, claimed: 0, sent: 0, failed: 0, skipped: 0 }; };
  assert.equal(await afterApplicationDecision("in_review", run), null); assert.equal(runs, 0);
  await afterApplicationDecision("approved", run); await afterApplicationDecision("declined", run); assert.equal(runs, 2);
  assert.equal(await afterApplicationDecision("approved", async () => { throw new Error("x"); }), null);
});

test("flag OFF (default): nothing claimed, no client built, nothing sent", async () => {
  const db = fakeDb(); const provider = createFakeProvider(); let built = 0;
  for (const env of [{}, { HC_NOTIFY_DISPATCH_ENABLED: "false" }, { HC_NOTIFY_DISPATCH_ENABLED: "TRUE" }, { HC_NOTIFY_DISPATCH_ENABLED: " true", COMMS_SEND_ENABLED: "true" }]) {
    await submitApplicationReview(db, input("approved"), (d) => afterApplicationDecision(d, () => runHcDispatch({ env, provider, serviceClient: () => { built++; return db; } })));
  }
  assert.equal(built, 0); assert.equal(provider.calls, 0); assert.equal(provider.sent.length, 0);
  assert.equal(db.calls.filter((c: any) => c.fn === "hc_claim_deliveries").length, 0);
  assert.equal(db.queue.length, 4, "deliveries stay queued");
  assert.equal(hcDispatchEnabled({}), false);
});

test("dispatch flag ON but COMMS_SEND_ENABLED off: still nothing claimed or sent (deliveries stay queued, not burned)", async () => {
  const db = fakeDb(); const provider = createFakeProvider();
  await submitApplicationReview(db, input("approved"), async () => {});
  const s = await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", SITE_URL: "https://example.test" }, provider, serviceClient: () => db });
  assert.equal(s.reason, "mailer_not_configured"); assert.equal(provider.calls, 0);
  assert.equal(db.queue.length, 1);
  assert.equal(mailerFromProvider(provider, {}), null);
});

test("both flags ON with the FAKE provider: exactly one email for one approval, applicant channel only, idempotent key, no SMS", async () => {
  const db = fakeDb(); const provider = createFakeProvider();
  await submitApplicationReview(db, input("approved"), async () => {});
  const s = await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true", SITE_URL: "https://example.test/" }, provider, serviceClient: () => db });
  assert.equal(s.sent, 1); assert.equal(provider.sent.length, 1);
  assert.equal(provider.sent[0].to, "member@example.test"); assert.equal(provider.sent[0].idempotencyKey, "hc-delivery-1");
  assert.match(provider.sent[0].body, /https:\/\/example\.test\/creator/);
  assert.deepEqual(db.calls.find((c: any) => c.fn === "hc_claim_deliveries").args.p_channel, "applicant_email");
  const rec = db.calls.find((c: any) => c.fn === "hc_record_delivery_result"); assert.equal(rec.args.p_outcome, "sent");
});

test("disabled provider (the only real one in the repo) can never deliver", async () => {
  const r = await createDisabledProvider().send({ to: "a@b.test", subject: "s", body: "b", idempotencyKey: "k" });
  assert.equal(r.status, "failed");
});

test("missing site url or service client fails closed without claiming", async () => {
  const db = fakeDb(); const env = { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true" };
  assert.equal((await runHcDispatch({ env, provider: createFakeProvider(), serviceClient: () => db })).reason, "site_url_missing");
  assert.equal((await runHcDispatch({ env: { ...env, SITE_URL: "https://x.test" }, provider: createFakeProvider(), serviceClient: () => null })).reason, "service_client_unavailable");
  assert.equal(db.calls.length, 0);
});

test("the review server action routes through the tested flow (single decision RPC, dispatch hook)", () => {
  const src = readFileSync(new URL("../app/(command-center)/command-center/hosting-collective/actions.ts", import.meta.url), "utf8");
  assert.match(src, /submitApplicationReview\(/); assert.match(src, /afterApplicationDecision\(/);
  assert.equal((src.match(/hc_review_application/g) ?? []).length, 0);
});

// ---- D4: one canonical founder-notification config path -------------------------------------------------
test("D4: no destination form, no env founder module, no hardcoded founder address in notification code or docs", () => {
  const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
  const page = read("app/(command-center)/command-center/hosting-collective/inbox/page.tsx");
  assert.ok(!/addDestinationForm|setDestinationActiveForm|hc_admin_add_destination|name="address"/.test(page));
  const fa = read("app/(command-center)/command-center/hosting-collective/form-actions.ts");
  assert.ok(!/Destination|hc_admin_add_destination|hc_admin_set_destination_active/.test(fa));
  assert.throws(() => readFileSync(new URL("../lib/comms/founder-notify.ts", import.meta.url)));
  const addr = ["alexis", "placeandplenty.com"].join("@");
  const walk = (d: string): string[] => readdirSync(new URL("../" + d, import.meta.url)).flatMap((n) => { const rel = join(d, n); return statSync(new URL("../" + rel, import.meta.url)).isDirectory() ? walk(rel) : [rel]; });
  const files = [...walk("lib/hc"), ...walk("lib/admin"), ...walk("lib/comms"), ...walk("app/(command-center)"), "docs/ENV_COMMS.md"];
  const hits = files.filter((f) => /\.(ts|tsx|md)$/.test(f) && read(f).toLowerCase().includes(addr));
  assert.deepEqual(hits, []);
  assert.match(read("docs/ENV_COMMS.md"), /FOUNDER_NOTIFICATION_EMAIL_VERIFIED. = .false./);
});
