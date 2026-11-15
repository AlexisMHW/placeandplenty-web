import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// ---- A8 n3 (agent I): allowlist semantics + strict hygiene + decoded JWT role/ref. One test per bypass the independent reviewer tried.
const anonJwt = (ref: string, role = "anon") => ["h", Buffer.from(JSON.stringify({ iss: "supabase", ref, role })).toString("base64url"), "sig"].join(".");
const ZW = "​";
const reasonsOf = (o: Record<string, unknown>) => checkPreviewIsolation({ ...okBase, ...o }).reasons.join("\n");

test("n3 bypass: quoted live key (double, single, backtick) is rejected and named", () => {
  for (const q of ['"', "'", "`"]) {
    const r = checkPreviewIsolation({ ...okBase, paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: q + LIVE + q } });
    assert.equal(r.ok, false);
    assert.ok(r.reasons.join("").includes("PAYMENT_PROCESSOR_SECRET_KEY"));
  }
  assert.equal(checkPreviewIsolation({ ...okBase, paymentSecretKeys: { STRIPE_SECRET_KEY: '"' + TESTK + '"' } }).ok, false, "a quoted TEST key is also rejected (exact match only)");
});

test("n3 bypass: zero-width / non-ASCII characters in or around the prefix are rejected", () => {
  for (const v of [ZW + LIVE, "sk_" + ZW + "live_" + "A".repeat(20), "sk_live" + ZW + "_" + "A".repeat(20), "﻿" + LIVE, "sk_test_" + ZW + "B".repeat(20), TESTK + ZW, " " + TESTK, "ѕk_test_" + "B".repeat(20) /* cyrillic s */, "sk_test_" + "é".repeat(20)]) {
    assert.equal(checkPreviewIsolation({ ...okBase, paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: v } }).ok, false, JSON.stringify(v.slice(0, 12)));
  }
});

test("n3 bypass: unknown prefix, wrong case, whitespace and malformed test keys are rejected (allowlist, not blocklist)", () => {
  for (const v of ["pk_live_" + "A".repeat(20), "pk_test_" + "A".repeat(20), "sk_prod_" + "A".repeat(20), "sk_" + "A".repeat(20), "sk_staging_" + "A".repeat(20), "whsec_" + "A".repeat(20), "random-secret", "sk_test_", "sk_test_short", "Sk_test_" + "B".repeat(20), "sk_TEST_" + "B".repeat(20), "SK_TEST_" + "B".repeat(20), " " + TESTK, TESTK + " ", TESTK + "\n", "sk_test_" + "B".repeat(10) + " " + "B".repeat(10), "sk_test_" + "B".repeat(20) + "-x"]) {
    assert.equal(checkPreviewIsolation({ ...okBase, paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: v } }).ok, false, JSON.stringify(v.slice(0, 14)));
  }
  assert.equal(checkPreviewIsolation({ ...okBase, paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: TESTK, STRIPE_SECRET_KEY: "rk_test_" + "Z9".repeat(12) } }).ok, true);
});

test("n3 any variable name holding a live-key-shaped value is caught via scanEnv (names only)", () => {
  const r = checkPreviewIsolation({ ...okBase, scanEnv: { SOME_RANDOM_NAME: LIVE, QUOTED_ONE: `"${LIVE}"`, ZW_ONE: "sk_" + ZW + "live_" + "A".repeat(20), FINE: "hello", ALSO_FINE: TESTK } });
  assert.equal(r.ok, false);
  const t = r.reasons.join("\n");
  for (const n of ["SOME_RANDOM_NAME", "QUOTED_ONE", "ZW_ONE"]) assert.ok(t.includes(n), n);
  assert.ok(!t.includes("FINE") && !t.includes(LIVE));
  assert.equal(checkPreviewIsolation({ ...okBase, scanEnv: { FINE: "hello", T: TESTK } }).ok, true);
});

test("n3 bypass: QA service-role key in the anon variable fails; QA anon key in the service variable fails", () => {
  const r = checkPreviewIsolation({ ...okBase, anonKey: svcJwt(QA) });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x: string) => x.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") && x.includes("role")));
  assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: anonJwt(QA, "anon") }).ok, false);
  assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: svcJwt(QA) }).ok, true);
  assert.equal(checkPreviewIsolation({ ...okBase, anonKey: anonJwt(QA, "authenticated") }).ok, false);
  assert.equal(checkPreviewIsolation({ ...okBase, anonKey: ["h", Buffer.from(JSON.stringify({ ref: QA })).toString("base64url"), "sig"].join(".") }).ok, false, "missing role");
  assert.equal(checkPreviewIsolation({ ...okBase, anonKey: ["h", Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url"), "sig"].join(".") }).ok, false, "missing ref");
});

test("n3 bypass: production ref in any form, in any guarded value, fails", () => {
  const P = PROD;
  for (const url of [`https://${P}.supabase.co`, `HTTPS://${P.toUpperCase()}.SUPABASE.CO`, `https://${P}.supabase.co.`, `https://${P}.supabase.co./`, `https://${P}.supabase.co:443/`, `https://x@${P}.supabase.co`, `https://${P.slice(0, 5)}${ZW}${P.slice(5)}.supabase.co`, `https://${QA}.supabase.co/?ref=${P}`, `https://${QA}.supabase.co/${P}`, `"https://${P}.supabase.co"`, ` https://${P}.supabase.co`, `db.${P}.supabase.co`]) {
    const r = checkPreviewIsolation({ ...okBase, supabaseUrl: url });
    assert.equal(r.ok, false, url);
  }
  // production ref hidden in a JWT: ref claim, upper case ref, other claim (iss), and as the service key
  assert.equal(checkPreviewIsolation({ ...okBase, anonKey: anonJwt(P.toUpperCase()) }).ok, false);
  assert.equal(checkPreviewIsolation({ ...okBase, anonKey: ["h", Buffer.from(JSON.stringify({ iss: `https://${P}.supabase.co/auth/v1`, ref: QA, role: "anon" })).toString("base64url"), "sig"].join(".") }).ok, false, "QA ref claim but production issuer");
  assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: svcJwt(P) }).ok, false);
  assert.ok(reasonsOf({ supabaseUrl: `https://${P}.supabase.co.` }).includes("production"));
});

test("n3 bypass: mixed-case and trailing-dot QA host are NOT accepted as the QA project (strict URL form)", () => {
  for (const url of [`https://${QA}.supabase.co.`, `https://${QA.toUpperCase()}.supabase.co`, `https://${QA}.SUPABASE.co`, `http://${QA}.supabase.co`, `https://${QA}.supabase.co:8443`, `https://${QA}.supabase.co/rest/v1`, `https://${QA}.supabase.co//`, ` https://${QA}.supabase.co`, `https://${QA}.supabase.co `, `https://${QA}.supabase.co${ZW}`, `"https://${QA}.supabase.co"`, `https://${QA}.supabase.co.evil.com`, `https://evil.com/${QA}.supabase.co`]) {
    assert.equal(checkPreviewIsolation({ ...okBase, supabaseUrl: url }).ok, false, JSON.stringify(url));
  }
  assert.equal(checkPreviewIsolation({ ...okBase, supabaseUrl: `https://${QA}.supabase.co` }).ok, true);
  assert.equal(checkPreviewIsolation({ ...okBase, supabaseUrl: `https://${QA}.supabase.co/` }).ok, true);
});

test("n3 hygiene applies to JWT variables: quotes, whitespace and zero-width characters fail even when the payload is QA", () => {
  const good = anonJwt(QA);
  for (const v of [`"${good}"`, `'${good}'`, ` ${good}`, `${good} `, `${good}\n`, good.slice(0, 3) + ZW + good.slice(3), `${good}é`]) assert.equal(checkPreviewIsolation({ ...okBase, anonKey: v }).ok, false, JSON.stringify(v.slice(0, 6)));
  for (const v of [`"${svcJwt(QA)}"`, ` ${svcJwt(QA)}`, svcJwt(QA) + ZW]) assert.equal(checkPreviewIsolation({ ...okBase, serviceRoleKey: v }).ok, false);
  assert.equal(checkPreviewIsolation({ ...okBase, anonKey: good }).ok, true);
});

test("n3 third-party keys: when the QA override is exactly true the value must still be clean; reasons never leak values", () => {
  const o = { qaThirdPartyOverride: "true" };
  assert.equal(checkPreviewIsolation({ ...okBase, ...o, thirdPartyKeys: { GELATO_API_KEY: "qa-key-123" } }).ok, true);
  for (const v of ['"qa-key"', "qa key", "qa-key" + ZW, "sk_live_" + "A".repeat(20)]) assert.equal(checkPreviewIsolation({ ...okBase, ...o, thirdPartyKeys: { BREVO_API_KEY: v } }).ok, false, JSON.stringify(v.slice(0, 8)));
  const all = reasonsOf({ paymentSecretKeys: { PAYMENT_PROCESSOR_SECRET_KEY: `"${LIVE}"` }, anonKey: anonJwt(QA, "service_role"), scanEnv: { X: LIVE } });
  assert.ok(!all.includes(LIVE) && !all.includes("A".repeat(24)));
});

test("n3 CLI: bypass attempts exit 1 and print names only", () => {
  const clean = { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(QA), NEXT_PUBLIC_ANALYTICS_MODE: "off" };
  for (const extra of [{ PAYMENT_PROCESSOR_SECRET_KEY: `"${LIVE}"` }, { PAYMENT_PROCESSOR_SECRET_KEY: ZW + LIVE }, { STRIPE_SECRET_KEY: "pk_xx_" + "A".repeat(20) }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: svcJwt(QA) }, { NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co.` }, { RANDOM_VAR_NAME: LIVE }]) {
    const r = runGuard({ ...clean, ...extra });
    assert.equal(r.status, 1, JSON.stringify(Object.keys(extra)));
    for (const v of Object.values(extra)) assert.ok(!r.stdout.includes(v) && !r.stderr.includes(v), "value printed");
    assert.ok(r.stderr.includes(Object.keys(extra)[0]), "names the variable");
  }
  assert.equal(runGuard({ ...clean, PAYMENT_PROCESSOR_SECRET_KEY: TESTK }).status, 0);
  rmSync(".preview-isolation-ok.json", { force: true });
});

// ---- A8 n5 (agent I): the guard cannot be silently skipped. Marker written by the guard, verified by next.config.js.
const require_ = createRequire(import.meta.url);
const marker = require_("../scripts/lib/preview-marker.cjs");
const cleanPreviewEnv = { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(QA), NEXT_PUBLIC_ANALYTICS_MODE: "off" };
function tmpRoot() { return mkdtempSync(join(tmpdir(), "pp-marker-")); }
function runGuardIn(cwd: string, env: Record<string, string>) {
  const guard = join(process.cwd(), "scripts/check-preview-isolation.mjs");
  return spawnSync(process.execPath, [guard], { cwd, env: { PATH: process.env.PATH, ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
}
function runNextConfig(cwd: string, env: Record<string, string>, phase: string) {
  const cfg = join(process.cwd(), "next.config.js");
  const code = `const c=require(${JSON.stringify(cfg)});const r=typeof c==="function"?c(${JSON.stringify(phase)}):c;console.log(typeof r==="object"&&r&&r.reactStrictMode===true?"CONFIG_OK":"CONFIG_BAD")`;
  return spawnSync(process.execPath, ["-e", code], { cwd, env: { PATH: process.env.PATH, ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
}

test("n5 marker: a passing Preview guard writes it, next.config.js accepts it", () => {
  const d = tmpRoot();
  assert.equal(runGuardIn(d, cleanPreviewEnv).status, 0);
  assert.ok(existsSync(join(d, marker.MARKER_FILE)));
  const body = readFileSync(join(d, marker.MARKER_FILE), "utf8");
  assert.ok(!body.includes(QA) && !body.includes(jwt(QA)), "marker holds a hash, never values");
  const r = runNextConfig(d, cleanPreviewEnv, "phase-production-build");
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /CONFIG_OK/);
});

test("n5 overridden Build Command (guard never ran): next build config load fails on a Preview", () => {
  const d = tmpRoot();
  const r = runNextConfig(d, cleanPreviewEnv, "phase-production-build");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /preview-isolation self-check FAILED/);
  assert.match(r.stderr, /Build Command/);
});

test("n5 a failing guard leaves no marker, and removes a stale one", () => {
  const d = tmpRoot();
  assert.equal(runGuardIn(d, cleanPreviewEnv).status, 0);
  assert.equal(runGuardIn(d, { ...cleanPreviewEnv, NEXT_PUBLIC_ANALYTICS_MODE: "consent" }).status, 1);
  assert.ok(!existsSync(join(d, marker.MARKER_FILE)));
  assert.notEqual(runNextConfig(d, cleanPreviewEnv, "phase-production-build").status, 0);
});

test("n5 environment changed after the guard ran invalidates the marker", () => {
  const d = tmpRoot();
  assert.equal(runGuardIn(d, cleanPreviewEnv).status, 0);
  for (const change of [{ PAYMENT_PROCESSOR_SECRET_KEY: TESTK }, { NEXT_PUBLIC_ANALYTICS_MODE: "consent" }, { NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }]) {
    const r = runNextConfig(d, { ...cleanPreviewEnv, ...change } as Record<string, string>, "phase-production-build");
    assert.notEqual(r.status, 0, JSON.stringify(Object.keys(change)));
    assert.match(r.stderr, /changed after the preview isolation check/);
  }
});

test("n5 stale, forged-format and corrupt markers are rejected; fresh one accepted", () => {
  const d = tmpRoot();
  const env = cleanPreviewEnv as unknown as NodeJS.ProcessEnv;
  marker.writeMarker(env, d, Date.now() - marker.MAX_AGE_MS - 1000);
  assert.match(String(marker.verifyMarker(env, d)), /stale/);
  marker.writeMarker(env, d, Date.now() + 10 * 60 * 1000);
  assert.match(String(marker.verifyMarker(env, d)), /stale/, "marker from the future");
  writeFileSync(join(d, marker.MARKER_FILE), "not json");
  assert.match(String(marker.verifyMarker(env, d)), /unreadable/);
  writeFileSync(join(d, marker.MARKER_FILE), JSON.stringify({ v: 1, at: Date.now() }));
  assert.match(String(marker.verifyMarker(env, d)), /unexpected format/);
  marker.writeMarker(env, d);
  assert.equal(marker.verifyMarker(env, d), null);
});

test("n5 only Preview production builds are checked: dev, start, production, local and CI are unaffected", () => {
  const d = tmpRoot();
  for (const [env, phase] of [[cleanPreviewEnv, "phase-development-server"], [cleanPreviewEnv, "phase-production-server"], [{ ...cleanPreviewEnv, VERCEL_ENV: "production" }, "phase-production-build"], [{ ...cleanPreviewEnv, VERCEL_ENV: "development" }, "phase-production-build"], [{}, "phase-production-build"]] as const) {
    const r = runNextConfig(d, env as Record<string, string>, phase);
    assert.equal(r.status, 0, phase + JSON.stringify(Object.keys(env)));
    assert.match(r.stdout, /CONFIG_OK/);
  }
});

test("n5 the marker file is gitignored, not committed, and build runs the guard before next build", () => {
  assert.match(readFileSync(".gitignore", "utf8"), /^\.preview-isolation-ok\.json$/m);
  const tracked = spawnSync("git", ["ls-files", marker.MARKER_FILE], { encoding: "utf8" }).stdout.trim();
  assert.equal(tracked, "");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(pkg.scripts.build.indexOf("check-preview-isolation.mjs") < pkg.scripts.build.indexOf("next build"));
  assert.match(readFileSync("next.config.js", "utf8"), /assertPreviewIsolationRan\(phase/);
  assert.ok(marker.GUARDED_ENV_NAMES.includes("PAYMENT_PROCESSOR_SECRET_KEY") && marker.GUARDED_ENV_NAMES.includes("SUPABASE_SERVICE_ROLE_KEY"));
});
