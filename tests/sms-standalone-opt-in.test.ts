import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  STANDALONE_CONSENT_WORDING, MIN_FILL_MS, createRateLimiter, forwardStandaloneConsent, isStandaloneOptInEnabled, validateStandaloneInput,
} from "../lib/sms-standalone-opt-in.ts";

const ON = { NEXT_PUBLIC_SMS_STANDALONE_OPT_IN: "true" };
const T0 = 1_000_000;
const good = { phone: "(202) 555-0123", accepted: true, website: "", startedAt: T0 };
const cfg = { supabaseUrl: "https://x.test", anonKey: "anon-pub", flagEnv: ON, now: () => T0 + MIN_FILL_MS + 1000 };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const mk = (status: number, body: unknown) => (async () => Response.json(body as object, { status })) as typeof fetch;

test("flag: only exact \"true\" opens the form; default off", () => {
  assert.equal(isStandaloneOptInEnabled({}), false);
  for (const v of ["", "1", "TRUE", " true", "false"]) assert.equal(isStandaloneOptInEnabled({ NEXT_PUBLIC_SMS_STANDALONE_OPT_IN: v }), false, v);
  assert.equal(isStandaloneOptInEnabled(ON), true);
  assert.match(read(".env.example"), /^NEXT_PUBLIC_SMS_STANDALONE_OPT_IN=$/m);
});

test("wording carries sender, frequency, rates, STOP, HELP, not-a-condition, terms and privacy", () => {
  for (const n of ["Place & Plenty", "invitations", "RSVP reminders", "gathering updates", "Message frequency varies", "Message and data rates may apply", "STOP", "HELP", "not required", "placeandplenty.com/terms", "placeandplenty.com/privacy"])
    assert.ok(STANDALONE_CONSENT_WORDING.includes(n), n);
});

test("wording v3 matches the edge function when it has v3 (skips otherwise)", (t) => {
  const edge = new URL("../../placeandplenty-native/supabase/proposed/sms-edge/src/consent.ts", import.meta.url);
  if (!existsSync(edge)) return t.skip("app repo not beside web repo");
  const m = readFileSync(edge, "utf8").match(/\n  v3: '((?:[^'\\]|\\.)*)',/);
  if (!m) return t.skip("edge consent.ts has no v3 yet: BLOCKER, backend must add identical v3 wording");
  assert.equal(m[1].replace(/\\'/g, "'"), STANDALONE_CONSENT_WORDING);
});

test("validation: consent must be literally true, phone must be US-shaped", () => {
  assert.equal(validateStandaloneInput(good).ok, true);
  assert.deepEqual(validateStandaloneInput({ ...good, accepted: false }), { ok: false, error: "consent_required" });
  assert.deepEqual(validateStandaloneInput({ ...good, accepted: "true" }), { ok: false, error: "consent_required" });
  assert.deepEqual(validateStandaloneInput({ ...good, phone: "123" }), { ok: false, error: "invalid_phone" });
  assert.deepEqual(validateStandaloneInput({ ...good, phone: 5 }), { ok: false, error: "invalid_phone" });
});

test("flag off: 404 and nothing forwarded", async () => {
  let calls = 0;
  const out = await forwardStandaloneConsent(good, { ...cfg, flagEnv: {} }, (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch);
  assert.equal(out.status, 404); assert.equal(calls, 0);
});

test("honeypot, too-fast submit: nothing forwarded; expired form rejected", async () => {
  let calls = 0;
  const tr = (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch;
  assert.equal((await forwardStandaloneConsent({ ...good, website: "http://spam" }, cfg, tr)).body.ignored, true);
  assert.equal((await forwardStandaloneConsent(good, { ...cfg, now: () => T0 + 500 }, tr)).body.ignored, true);
  assert.equal((await forwardStandaloneConsent(good, { ...cfg, now: () => T0 + 7 * 3600_000 }, tr)).status, 400);
  assert.equal(calls, 0);
});

test("forwards source/version/phone/consent only, never wording; never echoes the number", async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const tr = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return Response.json({ ok: true, status: "pending" }); }) as unknown as typeof fetch;
  const out = await forwardStandaloneConsent(good, { ...cfg, clientKey: "hash" }, tr);
  assert.deepEqual(out, { status: 200, body: { ok: true, status: "pending" } });
  assert.equal(seen[0].url, "https://x.test/functions/v1/sms-consent");
  const sent = JSON.parse(String(seen[0].init.body));
  assert.deepEqual(Object.keys(sent).sort(), ["accepted", "client_key", "phone", "source", "wording_version"]);
  assert.equal(sent.source, "standalone_page"); assert.equal(sent.wording_version, "v3");
  assert.ok(!JSON.stringify(out).includes("555"));
});

test("fail closed: an edge that rejects/does not know this source is 'unavailable', never success; opt-out surfaced", async () => {
  for (const [s, b] of [[400, { error: "bad_request" }], [404, { error: "not_found" }], [500, {}], [503, { error: "sms_unavailable" }]] as const)
    assert.deepEqual(await forwardStandaloneConsent(good, cfg, mk(s, b)), { status: 503, body: { error: "unavailable" } }, String(s));
  assert.equal((await forwardStandaloneConsent(good, cfg, mk(400, { error: "invalid_phone" }))).status, 400);
  assert.equal((await forwardStandaloneConsent(good, cfg, mk(429, {}))).status, 429);
  assert.equal((await forwardStandaloneConsent(good, cfg, (async () => { throw new Error("net"); }) as typeof fetch)).status, 503);
  assert.equal((await forwardStandaloneConsent(good, { ...cfg, anonKey: undefined }, mk(200, { ok: true }))).status, 503);
  assert.deepEqual((await forwardStandaloneConsent(good, cfg, mk(200, { ok: true, still_opted_out: true }))).body, { ok: true, status: "pending" });
  assert.equal((await forwardStandaloneConsent(good, cfg, mk(200, { ok: false }))).status, 503);
});

test("rate limiter blocks after the limit and recovers after the window", () => {
  let t = 0; const allow = createRateLimiter(2, 1000, () => t);
  assert.equal(allow("a"), true); assert.equal(allow("a"), true); assert.equal(allow("a"), false); assert.equal(allow("b"), true);
  t = 1500; assert.equal(allow("a"), true);
});

test("UI/page contract: unchecked box, honeypot, flag-gated page, links, disclosures, no secrets client-side", () => {
  const ui = read("components/guest/SmsOptInStandalone.tsx");
  assert.match(ui, /useState\(false\)/); assert.doesNotMatch(ui, /defaultChecked|checked=\{true\}/);
  assert.match(ui, /name="website"/); assert.match(ui, /fetch\("\/api\/sms-opt-in"/);
  assert.doesNotMatch(ui, /SERVICE_ROLE|functions\/v1|ANON_KEY/);
  const page = read("app/sms-opt-in/page.tsx");
  for (const n of ["isStandaloneOptInEnabled", 'href="/privacy"', 'href="/terms"', "STOP", "HELP", "Message and data rates may apply", "Place &amp; Plenty", "sms-opt-in-coming-soon", "does not sign you up"]) assert.ok(page.includes(n), n);
  assert.doesNotMatch(read("app/api/sms-opt-in/route.ts"), /SERVICE_ROLE/);
});

// ---- Voluntary revoke ("Stop texts") -------------------------------------------------------------------------------
import { REVOKE_MIN_FILL_MS, forwardStandaloneRevoke, validateRevokeInput } from "../lib/sms-standalone-opt-in.ts";
const rgood = { action: "revoke", phone: "(202) 555-0123", website: "", startedAt: T0 };
const rcfg = { ...cfg, now: () => T0 + REVOKE_MIN_FILL_MS + 500 };

test("revoke: flag off -> 404, nothing forwarded", async () => {
  let calls = 0;
  const out = await forwardStandaloneRevoke(rgood, { ...rcfg, flagEnv: {} }, (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch);
  assert.equal(out.status, 404); assert.equal(calls, 0);
});

test("revoke: validation needs a US-shaped phone only (no consent flag required); honeypot / too fast ignored; expired rejected", async () => {
  assert.equal(validateRevokeInput(rgood).ok, true);
  assert.deepEqual(validateRevokeInput({ ...rgood, phone: "123" }), { ok: false, error: "invalid_phone" });
  assert.deepEqual(validateRevokeInput([]), { ok: false, error: "bad_request" });
  let calls = 0; const tr = (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch;
  assert.equal((await forwardStandaloneRevoke({ ...rgood, website: "http://spam" }, rcfg, tr)).body.ignored, true);
  assert.equal((await forwardStandaloneRevoke(rgood, { ...rcfg, now: () => T0 + 200 }, tr)).body.ignored, true);
  assert.equal((await forwardStandaloneRevoke(rgood, { ...rcfg, now: () => T0 + 7 * 3600_000 }, tr)).status, 400);
  assert.equal(calls, 0);
  // a revoke is allowed faster than an opt-in
  assert.ok(REVOKE_MIN_FILL_MS < MIN_FILL_MS);
});

test("revoke: forwards source/action/phone/client_key only (no wording, no accepted); never echoes the number", async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const tr = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return Response.json({ ok: true }); }) as unknown as typeof fetch;
  const out = await forwardStandaloneRevoke(rgood, { ...rcfg, clientKey: "hash" }, tr);
  assert.deepEqual(out, { status: 200, body: { ok: true } });
  assert.equal(seen[0].url, "https://x.test/functions/v1/sms-consent");
  const sent = JSON.parse(String(seen[0].init.body));
  assert.deepEqual(Object.keys(sent).sort(), ["action", "client_key", "phone", "source"]);
  assert.equal(sent.source, "standalone_page"); assert.equal(sent.action, "revoke");
  assert.ok(!JSON.stringify(out).includes("555"));
});

test("revoke fails closed: an edge that rejects/does not know 'revoke' is 'unavailable', never done; 429 and invalid_phone surfaced", async () => {
  for (const [s, b] of [[400, { error: "bad_request" }], [404, { error: "not_found" }], [500, {}], [503, { error: "consent_not_configured" }], [503, { error: "consent_unavailable" }]] as const)
    assert.deepEqual(await forwardStandaloneRevoke(rgood, rcfg, mk(s, b)), { status: 503, body: { error: "unavailable" } }, String(s));
  assert.equal((await forwardStandaloneRevoke(rgood, rcfg, mk(400, { error: "invalid_phone" }))).status, 400);
  assert.equal((await forwardStandaloneRevoke(rgood, rcfg, mk(429, {}))).status, 429);
  assert.equal((await forwardStandaloneRevoke(rgood, rcfg, (async () => { throw new Error("net"); }) as typeof fetch)).status, 503);
  assert.equal((await forwardStandaloneRevoke(rgood, { ...rcfg, anonKey: undefined }, mk(200, { ok: true }))).status, 503);
  assert.equal((await forwardStandaloneRevoke(rgood, rcfg, mk(200, { ok: false }))).status, 503);
});

test("revoke UI/route contract: Stop texts form on the page, states STOP reply, no secrets client-side, separate rate limiter, same-origin check kept", () => {
  const ui = read("components/guest/SmsOptInStandalone.tsx");
  assert.match(ui, /export function SmsStopTexts/); assert.match(ui, /action: "revoke"/); assert.match(ui, /name="website"/);
  assert.doesNotMatch(ui, /SERVICE_ROLE|functions\/v1|ANON_KEY/);
  const page = read("app/sms-opt-in/page.tsx");
  for (const n of ["SmsStopTexts", "Stop texts", "Reply STOP to any Place &amp; Plenty text", "sms-stop-card", "will not turn texts back on"]) assert.ok(page.includes(n), n);
  const route = read("app/api/sms-opt-in/route.ts");
  assert.match(route, /forwardStandaloneRevoke/); assert.match(route, /allowRevoke/); assert.match(route, /origin !== new URL\(request\.url\)\.origin/); assert.doesNotMatch(route, /SERVICE_ROLE/);
  assert.match(read("lib/sms-standalone-opt-in.ts"), /reply START/i);
});
