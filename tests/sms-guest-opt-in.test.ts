import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  SMS_CONSENT_WORDING, SMS_COPY, SMS_WORDING_VERSION, forwardSmsConsent, isSmsGuestOptInEnabled, pickSmsLocale, validateConsentInput,
} from "../lib/sms-guest-consent.ts";

const ON = { NEXT_PUBLIC_SMS_GUEST_OPT_IN: "true" };
const TOKEN = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const good = { publicToken: TOKEN, phone: "(202) 555-0123", accepted: true, locale: "en" };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("feature flag: only the exact string \"true\" turns it on (default off)", () => {
  assert.equal(isSmsGuestOptInEnabled({}), false);
  for (const v of ["", "1", "TRUE", " true", "yes", "false"]) assert.equal(isSmsGuestOptInEnabled({ NEXT_PUBLIC_SMS_GUEST_OPT_IN: v }), false, v);
  assert.equal(isSmsGuestOptInEnabled(ON), true);
});

test("consent wording (en and es) carries STOP, HELP, rates, frequency, not-a-condition, terms and privacy", () => {
  for (const v of ["v2", "v2-es"] as const) {
    const w = SMS_CONSENT_WORDING[v];
    for (const needle of ["STOP", "HELP", "Place & Plenty", "placeandplenty.com/terms", "placeandplenty.com/privacy"]) assert.ok(w.includes(needle), `${v} has ${needle}`);
  }
  assert.match(SMS_CONSENT_WORDING.v2, /Message and data rates may apply/);
  assert.match(SMS_CONSENT_WORDING.v2, /frequency varies/i);
  assert.match(SMS_CONSENT_WORDING.v2, /not required to RSVP or to buy anything/);
  assert.match(SMS_CONSENT_WORDING["v2-es"], /tarifas de mensajes y datos/);
  assert.match(SMS_CONSENT_WORDING["v2-es"], /frecuencia/i);
  assert.match(SMS_COPY.es.helpLine, /STOP/);
  assert.match(SMS_COPY.en.helpLine, /STOP/);
});

test("web wording is identical to the edge function's CONSENT_WORDING (checked when the app repo is next to this one)", (t) => {
  const edge = new URL("../../placeandplenty-native/supabase/proposed/sms-edge/src/consent.ts", import.meta.url);
  if (!existsSync(edge)) return t.skip("app repo not found beside the web repo");
  const src = readFileSync(edge, "utf8");
  for (const v of ["v2", "v2-es"] as const) {
    const key = v === "v2" ? "v2" : "'v2-es'";
    const m = src.match(new RegExp(`\\n  ${key}: '((?:[^'\\\\]|\\\\.)*)',`));
    assert.ok(m, `edge has ${v}`);
    assert.equal(m![1].replace(/\\'/g, "'"), SMS_CONSENT_WORDING[v], `${v} wording matches the edge function`);
  }
});

test("locale: Spanish browsers get Spanish wording and the matching wording version", () => {
  assert.equal(pickSmsLocale("es-MX"), "es"); assert.equal(pickSmsLocale("es"), "es");
  assert.equal(pickSmsLocale("en-US"), "en"); assert.equal(pickSmsLocale(undefined), "en"); assert.equal(pickSmsLocale("est"), "en");
  assert.deepEqual(SMS_WORDING_VERSION, { en: "v2", es: "v2-es" });
});

test("validation: consent must be explicitly true, token and US phone must be well formed", () => {
  assert.equal(validateConsentInput(good).ok, true);
  assert.deepEqual(validateConsentInput({ ...good, accepted: false }), { ok: false, error: "consent_required" });
  assert.deepEqual(validateConsentInput({ ...good, accepted: "true" }), { ok: false, error: "consent_required" });
  assert.deepEqual(validateConsentInput({ ...good, phone: "12345" }), { ok: false, error: "invalid_phone" });
  assert.deepEqual(validateConsentInput({ ...good, publicToken: "../x" }), { ok: false, error: "bad_request" });
  assert.deepEqual(validateConsentInput(null), { ok: false, error: "bad_request" });
});

test("flag off: nothing is forwarded and the route answers 404", async () => {
  let calls = 0;
  const transport = (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch;
  const out = await forwardSmsConsent(good, { supabaseUrl: "https://x.test", anonKey: "k", flagEnv: {} }, transport);
  assert.equal(out.status, 404); assert.equal(calls, 0);
  assert.match(read("app/api/sms-consent/route.ts"), /NEXT_PUBLIC_SMS_GUEST_OPT_IN !== "true"[^\n]*404/);
});

test("flag on: forwards the VERSION (never the wording) to the edge function with the public key only, and never echoes the number", async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const transport = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return Response.json({ ok: true, still_opted_out: false }); }) as unknown as typeof fetch;
  const out = await forwardSmsConsent({ ...good, locale: "es" }, { supabaseUrl: "https://x.test", anonKey: "anon-pub", flagEnv: ON }, transport);
  assert.deepEqual(out, { status: 200, body: { ok: true, stillOptedOut: false } });
  assert.equal(seen.length, 1); assert.equal(seen[0].url, "https://x.test/functions/v1/sms-consent");
  const sent = JSON.parse(String(seen[0].init.body));
  assert.deepEqual(Object.keys(sent).sort(), ["accepted", "phone", "public_token", "wording_version"]);
  assert.equal(sent.wording_version, "v2-es"); assert.equal(sent.accepted, true);
  assert.ok(!JSON.stringify(out).includes("555"));
});

test("edge outcomes map to safe answers: still-opted-out, rate limit, unavailable, network error", async () => {
  const cfg = { supabaseUrl: "https://x.test", anonKey: "k", flagEnv: ON };
  const mk = (status: number, body: unknown) => (async () => Response.json(body as object, { status })) as typeof fetch;
  assert.deepEqual((await forwardSmsConsent(good, cfg, mk(200, { ok: true, still_opted_out: true }))).body, { ok: true, stillOptedOut: true });
  assert.equal((await forwardSmsConsent(good, cfg, mk(429, { error: "rate_limited" }))).status, 429);
  assert.equal((await forwardSmsConsent(good, cfg, mk(503, { error: "sms_unavailable" }))).status, 503);
  assert.equal((await forwardSmsConsent(good, cfg, mk(500, {}))).status, 503);
  assert.equal((await forwardSmsConsent(good, cfg, (async () => { throw new Error("net"); }) as typeof fetch)).status, 503);
  assert.equal((await forwardSmsConsent(good, { ...cfg, anonKey: undefined }, mk(200, { ok: true }))).status, 503);
});

test("UI contract: checkbox starts unchecked, no pre-tick, flag gates rendering, no service key or edge URL in client code", () => {
  const ui = read("components/guest/SmsOptIn.tsx");
  assert.match(ui, /useState\(false\)/);                       // checked defaults to false
  assert.doesNotMatch(ui, /defaultChecked|checked=\{true\}/);
  assert.match(ui, /if \(!isSmsGuestOptInEnabled\(\)\) return null/);
  assert.match(ui, /fetch\("\/api\/sms-consent"/);
  assert.doesNotMatch(ui, /SERVICE_ROLE|functions\/v1|ANON_KEY|sms-consent"?\s*,\s*\{[^}]*apikey/i);
  assert.match(read("app/(guest)/invite/[token]/GuestPageClient.tsx"), /<SmsOptIn publicToken=\{token\} \/>/);
  assert.match(read("app/(guest)/i/[token]/ShareInviteClient.tsx"), /<SmsHelpLine \/>/);
  assert.match(read(".env.example"), /^NEXT_PUBLIC_SMS_GUEST_OPT_IN=$/m);   // shipped empty = off
});
