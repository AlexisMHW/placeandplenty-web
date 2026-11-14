// CI-style guard for the integration branch: later (non-privacy) work must not weaken the RC-P2 privacy invariants.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const sources = ["app", "lib", "components"].flatMap((d) => walk(d));
const PRIVACY_OWNED = new Set([
  "lib/analytics-privacy.ts",
  "lib/analytics.ts",
  "lib/posthog-loader.ts",
  "components/AnalyticsConsent.tsx",
  "components/AnalyticsRoot.tsx",
  "components/AnalyticsTracker.tsx",
]);

test("only the privacy-owned files talk to analytics vendors", () => {
  const vendor = /googletagmanager|google-analytics|i\.posthog\.com|posthog-js|gtag\(|window\.dataLayer|posthog\.(init|capture|identify)/;
  const offenders = sources.filter((f) => !PRIVACY_OWNED.has(f.replace(/\\/g, "/")) && vendor.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});

test("no source outside the privacy files identifies users or starts recording", () => {
  const bad = /\.identify\(|\.setPersonProperties|startSessionRecording|session_recording|opt_in_capturing/;
  const offenders = sources.filter((f) => !PRIVACY_OWNED.has(f.replace(/\\/g, "/")) && bad.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});

test("layout still mounts exactly one AnalyticsRoot and does not mount analytics components directly", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.equal((layout.match(/<AnalyticsRoot\s*\/>/g) ?? []).length, 1);
  assert.ok(!/<AnalyticsConsent|<AnalyticsTracker/.test(layout));
});

test("AnalyticsRoot renders AnalyticsConsent before AnalyticsTracker", () => {
  const root = readFileSync("components/AnalyticsRoot.tsx", "utf8");
  assert.ok(root.indexOf("<AnalyticsConsent") > -1 && root.indexOf("<AnalyticsConsent") < root.indexOf("<AnalyticsTracker"));
});

test("analytics-off mode, GPC, DNT and replay-off remain wired", () => {
  const p = readFileSync("lib/analytics-privacy.ts", "utf8");
  assert.ok(/NEXT_PUBLIC_ANALYTICS_MODE|resolveMode/.test(p));
  assert.ok(/gpc_refusal/.test(p) && /dnt_refusal/.test(p));
  assert.ok(/disable_session_recording:\s*true/.test(p));
});

test("referral cookie handling stays behind the NEXT_PUBLIC_HC_REFERRALS flag (off by default)", () => {
  for (const f of ["app/r/[code]/route.ts", "app/auth/callback/route.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(/HC_REFERRALS/.test(src), `${f} must check the HC_REFERRALS flag`);
  }
});
