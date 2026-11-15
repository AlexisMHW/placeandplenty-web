import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
// @ts-ignore plain JS module
import { checkPreviewIsolation, QA_SUPABASE_REF, refFromSupabaseUrl, refFromJwt, PRODUCTION_SUPABASE_REF } from "../scripts/lib/preview-isolation.mjs";

const PROD = PRODUCTION_SUPABASE_REF;
const QA = "gpzlytukyvshrrxrmooo";
const jwt = (ref: string) =>
  ["h", Buffer.from(JSON.stringify({ iss: "supabase", ref, role: "anon" })).toString("base64url"), "sig"].join(".");

test("production ref constant is the production project", () => assert.equal(PROD, "iyvdxvotthwrerirdzwd"));

test("preview resolving to production URL fails", () => {
  const r = checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${PROD}.supabase.co`, anonKey: jwt(QA) });
  assert.equal(r.ok, false);
  assert.equal(r.applies, true);
});

test("preview with production anon key but QA URL fails (mixed wiring)", () => {
  const r = checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${QA}.supabase.co`, anonKey: jwt(PROD) });
  assert.equal(r.ok, false);
});

test("preview URL variants still detected (case, trailing dot is invalid host form, path, port)", () => {
  for (const u of [
    `HTTPS://${PROD.toUpperCase()}.SUPABASE.CO`,
    `https://${PROD}.supabase.co/`,
    `https://${PROD}.supabase.co/rest/v1`,
    `  https://${PROD}.supabase.co  `,
    `https://${PROD}.supabase.co:443`,
  ]) {
    assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: u }).ok, false, u);
  }
});

test("unparseable value containing the production ref still fails", () => {
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `${PROD}.supabase.co` }).ok, false);
});

test("preview on QA project passes", () => {
  const r = checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${QA}.supabase.co`, anonKey: jwt(QA), analyticsMode: "off" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
});

test("preview with no Supabase URL fails loudly (no silent fallback)", () => {
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview" }).ok, false);
});

test("guard never affects production, development or unset env", () => {
  for (const vercelEnv of ["production", "development", "", undefined, "Production"]) {
    const r = checkPreviewIsolation({ vercelEnv, supabaseUrl: `https://${PROD}.supabase.co`, anonKey: jwt(PROD) });
    assert.equal(r.ok, true, String(vercelEnv));
    assert.equal(r.applies, false);
  }
});

test("reasons never contain key material", () => {
  const key = jwt(PROD);
  const r = checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${PROD}.supabase.co`, anonKey: key });
  const text = JSON.stringify(r);
  assert.ok(!text.includes(key));
  assert.ok(!text.includes(key.split(".")[1]));
});

test("ref helpers", () => {
  assert.equal(refFromSupabaseUrl(`https://${QA}.supabase.co`), QA);
  assert.equal(refFromSupabaseUrl("https://example.com"), null);
  assert.equal(refFromJwt(jwt(QA)), QA);
  assert.equal(refFromJwt("not-a-jwt"), null);
  assert.equal(refFromJwt(undefined), null);
});

function runGuard(env: Record<string, string | undefined>) {
  const clean = { PATH: process.env.PATH } as unknown as NodeJS.ProcessEnv;
  return spawnSync(process.execPath, ["scripts/check-preview-isolation.mjs"], { env: { ...clean, ...env } as NodeJS.ProcessEnv, encoding: "utf8" });
}

test("CLI: exits 1 for production-wired Preview, 0 otherwise, and prints no env values", () => {
  const bad = runGuard({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(PROD) });
  assert.equal(bad.status, 1);
  assert.ok(!bad.stdout.includes(jwt(PROD)) && !bad.stderr.includes(jwt(PROD)));
  assert.equal(runGuard({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(QA), NEXT_PUBLIC_ANALYTICS_MODE: "off" }).status, 0);
  assert.equal(runGuard({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(QA) }).status, 1); // analytics not off
  assert.equal(runGuard({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }).status, 0);
  assert.equal(runGuard({ NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }).status, 0);
});

test("guard script is plain JS (no TS type stripping needed on the build host) and runs first in build", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(pkg.scripts.build.startsWith("node scripts/check-preview-isolation.mjs && "), pkg.scripts.build);
  for (const f of ["scripts/check-preview-isolation.mjs", "scripts/lib/preview-isolation.mjs"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/from ["'][^"']+\.ts["']/.test(src), `${f} must not import .ts`);
  }
});

test("preview fails unless analytics mode is exactly off", () => {
  const base = { vercelEnv: "preview", supabaseUrl: `https://${QA}.supabase.co`, anonKey: jwt(QA) };
  for (const m of [undefined, "", "consent", "legacy", "OFF", "on", " off ", "off ", " off", "off\n", "\toff"]) assert.equal(checkPreviewIsolation({ ...base, analyticsMode: m }).ok, false, String(m));
  assert.equal(checkPreviewIsolation({ ...base, analyticsMode: "off" }).ok, true);
});

test("preview fails closed for any project other than QA, and for a missing anon key", () => {
  const other = "abcdefghij0123456789";
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${other}.supabase.co`, anonKey: jwt(other), analyticsMode: "off" }).ok, false);
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: "https://example.com", anonKey: jwt(QA), analyticsMode: "off" }).ok, false);
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${QA}.supabase.co`, analyticsMode: "off" }).ok, false);
  assert.equal(QA_SUPABASE_REF, QA);
});

// ---- A8 M2 (agent H): server-side secrets in a Preview build. Reasons name variables only, never values.
const okBase = { vercelEnv: "preview", supabaseUrl: `https://${QA}.supabase.co`, anonKey: jwt(QA), analyticsMode: "off" };
const svcJwt = (ref: string) => ["h", Buffer.from(JSON.stringify({ iss: "supabase", ref, role: "service_role" })).toString("base64url"), "sig"].join(".");
const LIVE = "sk_live_" + "A".repeat(24); const TESTK = "sk_test_" + "B".repeat(24);

test("M2 live payment keys fail a Preview (sk_live_/rk_live_, any case/whitespace); test keys and unset pass", () => {
  for (const name of ["PAYMENT_PROCESSOR_SECRET_KEY", "STRIPE_SECRET_KEY"]) {
    for (const v of [LIVE, "rk_live_" + "C".repeat(20), " " + LIVE, "SK_LIVE_" + "D".repeat(20)]) {
      const r = checkPreviewIsolation({ ...okBase, paymentSecretKeys: { [name]: v } });
      assert.equal(r.ok, false, name + " " + v.slice(0, 7)); assert.ok(r.reasons.some((x: string) => x.includes(name)));
    }
    for (const v of [TESTK, "rk_test_" + "E".repeat(20), undefined, ""]) assert.equal(checkPreviewIsolation({ ...okBase, paymentSecretKeys: { [name]: v } }).ok, true, name + String(v));
  }
});

test("M2 Gelato / MailerLite / Brevo keys fail a Preview when set at all, unless the explicit QA override is exactly true", () => {
  for (const name of ["GELATO_API_KEY", "MAILERLITE_API_KEY", "BREVO_API_KEY"]) {
    assert.equal(checkPreviewIsolation({ ...okBase, thirdPartyKeys: { [name]: "anything" } }).ok, false, name);
    assert.equal(checkPreviewIsolation({ ...okBase, thirdPartyKeys: { [name]: " " } }).ok, false, name + " whitespace counts as set");
    assert.equal(checkPreviewIsolation({ ...okBase, thirdPartyKeys: { [name]: "" } }).ok, true, name + " empty = unset");
    assert.equal(checkPreviewIsolation({ ...okBase, thirdPartyKeys: { [name]: undefined } }).ok, true);
    for (const o of [undefined, "", "TRUE", "1", "yes", " true", "true "]) assert.equal(checkPreviewIsolation({ ...okBase, thirdPartyKeys: { [name]: "qa-key" }, qaThirdPartyOverride: o }).ok, false, name + String(o));
    assert.equal(checkPreviewIsolation({ ...okBase, thirdPartyKeys: { [name]: "qa-key" }, qaThirdPartyOverride: "true" }).ok, true, name + " override");
  }
});

test("M2 the QA override never relaxes live payment keys, the service key or tester ids", () => {
  const o = { qaThirdPartyOverride: "true" };
  assert.equal(checkPreviewIsolation({ ...okBase, ...o, paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: LIVE } }).ok, false);
  assert.equal(checkPreviewIsolation({ ...okBase, ...o, serviceRoleKey: svcJwt(PROD) }).ok, false);
  assert.equal(checkPreviewIsolation({ ...okBase, ...o, checkoutTesterIds: "u1" }).ok, false);
});

test("M2 service-role key: unset ok; QA ref ok; production, other project, unparseable or opaque value fail closed", () => {
  assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: undefined }).ok, true);
  assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: "" }).ok, true);
  assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: svcJwt(QA) }).ok, true);
  for (const v of [svcJwt(PROD), svcJwt("abcdefghij0123456789"), "not-a-jwt", "sb_secret_abcdef", "a.b.c"]) assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: v }).ok, false, v.slice(0, 8));
});

test("M2 WEB_CHECKOUT_TESTER_USER_IDS must be empty in a Preview", () => {
  for (const v of [undefined, ""]) assert.equal(checkPreviewIsolation({ ...okBase, checkoutTesterIds: v }).ok, true);
  for (const v of ["11111111-1111-4111-8111-111111111111", " ", "x"]) assert.equal(checkPreviewIsolation({ ...okBase, checkoutTesterIds: v }).ok, false, JSON.stringify(v));
});

test("M2 non-preview builds are unaffected by every new check (production build keeps its live keys)", () => {
  for (const vercelEnv of ["production", "development", undefined]) {
    const r = checkPreviewIsolation({ vercelEnv, paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: LIVE }, thirdPartyKeys: { GELATO_API_KEY: "k", BREVO_API_KEY: "k", MAILERLITE_API_KEY: "k" }, serviceRoleKey: svcJwt(PROD), checkoutTesterIds: "u" });
    assert.deepEqual([r.ok, r.applies], [true, false]);
  }
});

test("M2 existing checks keep their exact-compare semantics alongside the new ones, and reasons never contain secret values", () => {
  const secrets = { paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: LIVE }, thirdPartyKeys: { GELATO_API_KEY: "gelato-secret-value-1", MAILERLITE_API_KEY: "ml-secret-value-2", BREVO_API_KEY: "brevo-secret-value-3" }, serviceRoleKey: svcJwt(PROD), checkoutTesterIds: "tester-uuid-9" };
  const r = checkPreviewIsolation({ ...okBase, analyticsMode: " off", ...secrets });
  assert.equal(r.ok, false);
  const text = r.reasons.join("\n");
  for (const v of [LIVE, "gelato-secret-value-1", "ml-secret-value-2", "brevo-secret-value-3", "tester-uuid-9", svcJwt(PROD)]) assert.ok(!text.includes(v), "leaked " + v.slice(0, 6));
  for (const n of ["PAYMENT_PROCESSOR_SECRET_KEY", "GELATO_API_KEY", "MAILERLITE_API_KEY", "BREVO_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WEB_CHECKOUT_TESTER_USER_IDS", "ANALYTICS_MODE"]) assert.ok(text.includes(n), n);
});

test("M2 the build script wires the env vars, prints names only and exits 1; clean QA preview exits 0", () => {
  const clean = { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(QA), NEXT_PUBLIC_ANALYTICS_MODE: "off" };
  assert.equal(runGuard(clean).status, 0);
  assert.equal(runGuard({ ...clean, PAYMENT_PROCESSOR_SECRET_KEY: TESTK, SUPABASE_SERVICE_ROLE_KEY: svcJwt(QA) }).status, 0);
  for (const extra of [{ PAYMENT_PROCESSOR_SECRET_KEY: LIVE }, { STRIPE_SECRET_KEY: LIVE }, { GELATO_API_KEY: "gk-zzz" }, { MAILERLITE_API_KEY: "mk-zzz" }, { BREVO_API_KEY: "bk-zzz" }, { SUPABASE_SERVICE_ROLE_KEY: svcJwt(PROD) }, { WEB_CHECKOUT_TESTER_USER_IDS: "tester-zzz" }]) {
    const r = runGuard({ ...clean, ...extra });
    assert.equal(r.status, 1, JSON.stringify(Object.keys(extra)));
    for (const v of Object.values(extra)) assert.ok(!r.stdout.includes(v) && !r.stderr.includes(v), "secret value printed");
    assert.ok(r.stderr.includes(Object.keys(extra)[0]), "names the variable");
  }
  assert.equal(runGuard({ ...clean, GELATO_API_KEY: "gk-zzz", PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS: "true" }).status, 0);
  assert.equal(runGuard({ ...clean, GELATO_API_KEY: "gk-zzz", PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS: "TRUE" }).status, 1);
  assert.equal(runGuard({ VERCEL_ENV: "production", PAYMENT_PROCESSOR_SECRET_KEY: LIVE, GELATO_API_KEY: "g" }).status, 0);
});
