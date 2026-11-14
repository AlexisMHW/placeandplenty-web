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

function runGuard(env: Record<string, string>) {
  const clean = { PATH: process.env.PATH } as unknown as NodeJS.ProcessEnv;
  return spawnSync(process.execPath, ["scripts/check-preview-isolation.mjs"], { env: { ...clean, ...env }, encoding: "utf8" });
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
  for (const m of [undefined, "", "consent", "legacy", "OFF", "on"]) assert.equal(checkPreviewIsolation({ ...base, analyticsMode: m }).ok, false, String(m));
  assert.equal(checkPreviewIsolation({ ...base, analyticsMode: "off" }).ok, true);
});

test("preview fails closed for any project other than QA, and for a missing anon key", () => {
  const other = "abcdefghij0123456789";
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${other}.supabase.co`, anonKey: jwt(other), analyticsMode: "off" }).ok, false);
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: "https://example.com", anonKey: jwt(QA), analyticsMode: "off" }).ok, false);
  assert.equal(checkPreviewIsolation({ vercelEnv: "preview", supabaseUrl: `https://${QA}.supabase.co`, analyticsMode: "off" }).ok, false);
  assert.equal(QA_SUPABASE_REF, QA);
});
