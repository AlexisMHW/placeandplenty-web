// Preview/non-prod isolation guards (web scripts/check-preview-isolation.mjs + lib, native scripts/check-nonprod-env.mjs + lib). Pure Node, no network, no DB.
// All keys below are FAKE strings that only match the guards' patterns; the CLI output is scanned to prove no value is ever printed.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
const WEB = "/home/claude/pp-work/EXEC/e4-verify/web", NAT = "/home/claude/pp-work/EXEC/e4-verify/native";
const OUT = process.env.E_OUT ?? "./out/results_preview.jsonl";
const rows = []; const check = (id, scenario, expected, observed, pass) => { const rec = { id, scenario, layer: "guard CLI + lib", expected, observed, result: pass ? "PASS" : "FAIL" }; rows.push(rec); appendFileSync(OUT, JSON.stringify(rec) + "\n"); console.log(`${rec.result} ${id} ${scenario}${pass ? "" : `\n   expected: ${expected}\n   observed: ${observed}`}`); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwtRef = (ref, role) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ref, role, iss: "supabase" })}.fakesignature`;
const QA = "gpzlytukyvshrrxrmooo", PROD = "iyvdxvotthwrerirdzwd", OTHER = "abcdefghijklmnopqrst";
const SECRET_MARKER = "ZZSECRETVALUE";
const run = (cwd, script, env, args = []) => { const r = spawnSync("node", [script, ...args], { cwd, env: { PATH: process.env.PATH, ...env }, encoding: "utf8" }); return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") }; };
// ---------------- WEB
const webClean = { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtRef(QA, "anon"), NEXT_PUBLIC_ANALYTICS_MODE: "off" };
const W = (extra) => run(WEB, "scripts/check-preview-isolation.mjs", { ...webClean, ...extra });
const wc = W({}); check("PG-W0", "web: clean QA preview config passes", "exit 0, OK", `exit ${wc.code}; ${wc.out.trim().slice(0, 100)}`, wc.code === 0 && /OK/.test(wc.out));
const wprod = run(WEB, "scripts/check-preview-isolation.mjs", { VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }); check("PG-W0b", "web: a PRODUCTION build (VERCEL_ENV=production) is not blocked by the preview guard", "exit 0, skipped", `exit ${wprod.code}`, wprod.code === 0 && /skipped/.test(wprod.out));
const cases = [
  ["PG-W1", "live Stripe secret key (PAYMENT_PROCESSOR_SECRET_KEY=sk_live_...)", { PAYMENT_PROCESSOR_SECRET_KEY: `sk_live_${SECRET_MARKER}` }, "PAYMENT_PROCESSOR_SECRET_KEY"],
  ["PG-W1b", "live Stripe key in STRIPE_SECRET_KEY (rk_live_)", { STRIPE_SECRET_KEY: `rk_live_${SECRET_MARKER}` }, "STRIPE_SECRET_KEY"],
  ["PG-W2", "Gelato API key", { GELATO_API_KEY: SECRET_MARKER }, "GELATO_API_KEY"],
  ["PG-W3", "MailerLite API key", { MAILERLITE_API_KEY: SECRET_MARKER }, "MAILERLITE_API_KEY"],
  ["PG-W4", "Brevo API key", { BREVO_API_KEY: SECRET_MARKER }, "BREVO_API_KEY"],
  ["PG-W5", "service-role key of the PRODUCTION project", { SUPABASE_SERVICE_ROLE_KEY: jwtRef(PROD, "service_role") }, "SUPABASE_SERVICE_ROLE_KEY"],
  ["PG-W5b", "service-role key of a non-QA, non-production project", { SUPABASE_SERVICE_ROLE_KEY: jwtRef(OTHER, "service_role") }, "SUPABASE_SERVICE_ROLE_KEY"],
  ["PG-W6", "non-empty WEB_CHECKOUT_TESTER_USER_IDS", { WEB_CHECKOUT_TESTER_USER_IDS: "11111111-1111-4111-8111-111111111111" }, "WEB_CHECKOUT_TESTER_USER_IDS"],
  ["PG-W7", "production Supabase URL", { NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }, "NEXT_PUBLIC_SUPABASE_URL"],
  ["PG-W7b", "production anon key with the QA URL", { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtRef(PROD, "anon") }, "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
];
for (const [id, name, env, varName] of cases) { const r = W(env); const leaked = Object.values(env).some(v => r.out.includes(v)) || r.out.includes(SECRET_MARKER); check(id, `web preview REJECTS ${name}; names the variable; prints no value`, `exit 1, mentions ${varName}, no value`, `exit ${r.code}; mentions=${r.out.includes(varName)}; leaked=${leaked}`, r.code === 1 && r.out.includes(varName) && !leaked); }
const wo = W({ GELATO_API_KEY: "qa_sandbox_key", MAILERLITE_API_KEY: "qa_ml", PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS: "true" }); check("PG-W8", "web: third-party keys pass ONLY with the explicit QA override (PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS=true)", "exit 0", `exit ${wo.code}`, wo.code === 0);
const wo2 = W({ GELATO_API_KEY: "qa_sandbox_key", PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS: "yes" }); check("PG-W8b", "web: override must be exactly 'true' ('yes' is rejected)", "exit 1", `exit ${wo2.code}`, wo2.code === 1);
const wo3 = W({ PAYMENT_PROCESSOR_SECRET_KEY: `sk_live_${SECRET_MARKER}`, PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS: "true" }); check("PG-W8c", "web: the override can never allow a live Stripe key", "exit 1", `exit ${wo3.code}`, wo3.code === 1);
const wq = W({ SUPABASE_SERVICE_ROLE_KEY: jwtRef(QA, "service_role"), PAYMENT_PROCESSOR_SECRET_KEY: "sk_test_fake", WEB_CHECKOUT_TESTER_USER_IDS: "" }); check("PG-W9", "web: a QA service-role key, a TEST Stripe key and empty tester ids still pass (clean QA config)", "exit 0", `exit ${wq.code}; ${wq.out.trim().slice(0, 80)}`, wq.code === 0);
// ---------------- NATIVE
const natClean = { EXPO_PUBLIC_SUPABASE_URL: `https://${QA}.supabase.co`, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwtRef(QA, "anon") };
const N = (extra, profile = "preview") => run(NAT, "scripts/check-nonprod-env.mjs", { ...natClean, EAS_BUILD: "true", ...extra }, [`--profile=${profile}`]);
for (const prof of ["development", "preview", "qa"]) { const r = N({}, prof); check(`PG-N0-${prof}`, `native: clean QA config passes for profile ${prof}`, "exit 0", `exit ${r.code}; ${r.out.trim().slice(0, 70)}`, r.code === 0); }
const rp = run(NAT, "scripts/check-nonprod-env.mjs", { EXPO_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, EAS_BUILD: "true" }, ["--profile=production"]); check("PG-N0b", "native: the production profile is not constrained by this guard", "exit 0, skipped", `exit ${rp.code}`, rp.code === 0 && /skipped/.test(rp.out));
const ncases = [
  ["PG-N1", "live Stripe key (sk_live_) in any variable", { SOME_PAYMENT_VAR: `sk_live_${SECRET_MARKER}` }, "SOME_PAYMENT_VAR"],
  ["PG-N1b", "live publishable Stripe key (pk_live_)", { EXPO_PUBLIC_STRIPE_PK: `pk_live_${SECRET_MARKER}` }, "EXPO_PUBLIC_STRIPE_PK"],
  ["PG-N2", "Gelato key", { GELATO_API_KEY: SECRET_MARKER }, "GELATO_API_KEY"],
  ["PG-N3", "MailerLite key", { MAILERLITE_API_KEY: SECRET_MARKER }, "MAILERLITE_API_KEY"],
  ["PG-N4", "Brevo key", { BREVO_API_KEY: SECRET_MARKER }, "BREVO_API_KEY"],
  ["PG-N5", "service-role key (any value, name says SERVICE_ROLE)", { SUPABASE_SERVICE_ROLE_KEY: jwtRef(OTHER, "service_role") }, "SUPABASE_SERVICE_ROLE_KEY"],
  ["PG-N5b", "production service-role key", { SUPABASE_SERVICE_ROLE_KEY: jwtRef(PROD, "service_role") }, "SUPABASE_SERVICE_ROLE_KEY"],
  ["PG-N7", "production Supabase URL", { EXPO_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }, "EXPO_PUBLIC_SUPABASE_URL"],
  ["PG-N7b", "production anon key", { EXPO_PUBLIC_SUPABASE_ANON_KEY: jwtRef(PROD, "anon") }, "EXPO_PUBLIC_SUPABASE_ANON_KEY"],
  ["PG-N7c", "production ref hidden in another variable", { SOME_OTHER_URL: `https://${PROD}.supabase.co/x` }, "SOME_OTHER_URL"],
  ["PG-N8", "RevenueCat secret key", { REVENUECAT_SECRET_KEY: `sk_${SECRET_MARKER}` }, "REVENUECAT_SECRET_KEY"],
];
for (const prof of ["preview", "qa", "development"]) for (const [id, name, env, varName] of ncases) { const r = N(env, prof); const leaked = r.out.includes(SECRET_MARKER) || Object.values(env).some(v => r.out.includes(v)); check(`${id}-${prof}`, `native ${prof} REJECTS ${name}; names the variable; prints no value`, `exit 1, mentions ${varName}, no value`, `exit ${r.code}; mentions=${r.out.includes(varName)}; leaked=${leaked}`, r.code === 1 && r.out.includes(varName) && !leaked); }
const ntester = N({ WEB_CHECKOUT_TESTER_USER_IDS: "11111111-1111-4111-8111-111111111111" }); check("PG-N6", "native: WEB_CHECKOUT_TESTER_USER_IDS is a web variable; native guard behaviour recorded (not part of the native rules)", "informational", `exit ${ntester.code}`, true);
const nthird = N({ GELATO_API_KEY: "qa_sandbox", PP_NONPROD_QA_ALLOW_THIRD_PARTY_KEYS: "true" }); check("PG-N9", "native: third-party keys only with PP_NONPROD_QA_ALLOW_THIRD_PARTY_KEYS=true", "exit 0", `exit ${nthird.code}`, nthird.code === 0);
const nprodAllow = N({ EXPO_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`, PP_NONPROD_ALLOWED_SUPABASE_REFS: PROD }); check("PG-N10", "native: the allowlist can never admit the production ref", "exit 1", `exit ${nprodAllow.code}`, nprodAllow.code === 1);
const nflag = run(NAT, "node_modules/.bin/../../scripts/verify-release-env.mjs", { EAS_BUILD: "true", EAS_BUILD_PROFILE: "preview", ...natClean, SUPABASE_SERVICE_ROLE_KEY: jwtRef(OTHER, "service_role") }); check("PG-N11", "native: verify-release-env (the eas-build-pre-install hook) runs the guard and fails a preview build with a service-role key", "exit != 0", `exit ${nflag.code}; ${nflag.out.trim().slice(0, 120)}`, nflag.code !== 0);
const nflagOk = run(NAT, "scripts/verify-release-env.mjs", { EAS_BUILD: "true", EAS_BUILD_PROFILE: "preview", ...natClean }); check("PG-N11b", "native: the same hook passes a clean QA preview environment", "exit 0 (or only unrelated required-var complaints)", `exit ${nflagOk.code}; ${nflagOk.out.trim().slice(0, 200)}`, nflagOk.code === 0);
const eas = JSON.parse((await import("node:fs")).readFileSync(`${NAT}/eas.json`, "utf8")); const pins = Object.fromEntries(["development", "preview", "qa", "production"].map(k => [k, eas.build?.[k]?.env?.EXPO_PUBLIC_SUPABASE_URL ?? "(unset)"]));
check("PG-N12", "native eas.json: development, preview and qa profiles pin the QA Supabase URL; none of them names the production ref", "QA url x3; no prod ref", JSON.stringify(pins), ["development", "preview", "qa"].every(k => pins[k].includes(QA)) && !["development", "preview", "qa"].some(k => JSON.stringify(eas.build[k]).includes(PROD)));
console.log("SUMMARY", JSON.stringify(rows.reduce((c, r) => (c[r.result] = (c[r.result] ?? 0) + 1, c), {})));
