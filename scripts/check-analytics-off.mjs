#!/usr/bin/env node
// Verifies a build made with NEXT_PUBLIC_ANALYTICS_MODE=off ships no GA4 /
// PostHog loader. Scans .next/static (client JS) and prerendered HTML.
// Run after `next build`. Exits non-zero on any hit.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const targets = [".next/static", ".next/server/app", ".next/server/pages"].map((p) => join(root, p));

// A bare api-host string (us.i.posthog.com) is config, not a loader, so it is not banned.
// Patterns that mean an analytics loader is present in shipped output.
// The hardcoded IDs live in the source (GA_MEASUREMENT_ID / POSTHOG_PROJECT_KEY);
// with mode=off they must be dead-code-eliminated from client bundles AND
// no <script src> may be emitted in HTML.
const sources = new Map();
for (const [file, re] of [
  ["components/AnalyticsConsent.tsx", /GA_MEASUREMENT_ID\s*=\s*["']([^"']+)["']/],
  ["lib/posthog-loader.ts", /POSTHOG_PROJECT_KEY\s*=\s*["']([^"']+)["']/],
]) {
  try {
    const m = readFileSync(join(root, file), "utf8").match(re);
    if (m) sources.set(file, m[1]);
  } catch {}
}

const bannedLiterals = [...sources.values()];
const bannedPatterns = [
  /googletagmanager\.com\/gtag\/js/,
  /google-analytics\.com\/(g\/)?collect/,
  /\/static\/array\.js/,
  /posthog-js\/dist/,
  /\.__SV\b|__SV=1/, // PostHog snippet stub marker
];

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(js|html|rsc|json)$/.test(name)) yield p;
  }
}

if (!existsSync(join(root, ".next"))) {
  console.error("check-analytics-off: no .next directory; run next build first");
  process.exit(2);
}

const hits = [];
let scanned = 0;
for (const t of targets) {
  for (const f of walk(t)) {
    scanned++;
    const txt = readFileSync(f, "utf8");
    for (const lit of bannedLiterals) if (txt.includes(lit)) hits.push(`${f}: contains ID ${lit.slice(0, 4)}…`);
    for (const re of bannedPatterns) if (re.test(txt)) hits.push(`${f}: matches ${re}`);
  }
}

console.log(`check-analytics-off: scanned ${scanned} files; ${bannedLiterals.length} hardcoded IDs + ${bannedPatterns.length} loader patterns checked`);
if (hits.length) {
  console.error("FAIL: analytics loader present in mode=off build:\n" + hits.slice(0, 30).join("\n"));
  process.exit(1);
}
console.log("PASS: no GA4/PostHog loader or IDs in built output (mode=off)");
