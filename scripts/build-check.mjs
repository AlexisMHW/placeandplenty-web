#!/usr/bin/env node
// Reproducible, credential-free, production-equivalent build check.
//
//   node scripts/build-check.mjs            # full check (Tina local build + next build)
//   node scripts/build-check.mjs --skip-tina  # reuse an existing tina/__generated__
//
// What it does (same order as `npm run build`, minus anything needing secrets):
//   1. tinacms build --local --skip-cloud-checks   (no Tina Cloud credentials)
//   2. fix-tina-cache-path, check-tina-codegen, check-app-links
//   3. next build with DUMMY env (never a real project) and
//      NEXT_PUBLIC_ANALYTICS_MODE=off
//   4. scripts/check-analytics-off.mjs against the built output
//
// Fonts: next/font/google needs fonts.googleapis.com at build time. In offline
// or proxied sandboxes that returns 403. Set BUILD_CHECK_MOCK_FONTS=1 (default
// when the network probe fails) to use Next's built-in
// NEXT_FONT_GOOGLE_MOCKED_RESPONSES hook with e2e/fixtures/google-fonts-mock.cjs.
// That file is only referenced here and by playwright.config.ts, never by the real `npm run build`.
//
// Side effects restored: the Tina build deletes the tracked
// public/admin/README.md; this script restores it with `git checkout`.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const root = process.cwd();

// Inner mode: invoked by `tinacms dev -c`, which forces NODE_ENV=development.
// next build must run as production or prerender fails (<Html> / useContext).
if (args.has("--inner-next-build")) {
  const r = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  process.exit(r.status ?? 1);
}

function run(cmd, cmdArgs, env = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    console.error(`\nbuild-check FAILED at: ${cmd} ${cmdArgs.join(" ")}`);
    restoreTinaSideEffects();
    process.exit(r.status ?? 1);
  }
}

function restoreTinaSideEffects() {
  spawnSync("git", ["checkout", "--", "public/admin/README.md"], {
    cwd: root,
    stdio: "ignore",
  });
}

async function fontsReachable() {
  try {
    const res = await fetch(
      "https://fonts.googleapis.com/css2?family=Lato&display=swap",
      { signal: AbortSignal.timeout(8000) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

function writeFontMock() {
  return join(root, "e2e/fixtures/google-fonts-mock.cjs");
}

const DUMMY_ENV = {
  // Obviously-fake, non-production values. Never a real Supabase ref.
  NEXT_PUBLIC_SUPABASE_URL: "https://build-check-dummy.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "build-check-dummy-anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_ANALYTICS_MODE: "off",
  NEXT_TELEMETRY_DISABLED: "1",
};

if (!args.has("--skip-tina")) {
  run("npx", ["tinacms", "build", "--local", "--skip-cloud-checks"]);
  restoreTinaSideEffects();
}
run("node", ["scripts/fix-tina-cache-path.mjs"]);
run("node", ["scripts/check-tina-codegen.mjs"]);
run("node", ["scripts/check-app-links.mjs"]);

const env = { ...DUMMY_ENV };
const wantMock =
  process.env.BUILD_CHECK_MOCK_FONTS === "1" ||
  (process.env.BUILD_CHECK_MOCK_FONTS !== "0" && !(await fontsReachable()));
if (wantMock) {
  env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = writeFontMock();
  console.log(`\n[build-check] Google Fonts unreachable: using offline font mock (${env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES})`);
} else {
  console.log("\n[build-check] Google Fonts reachable: using real fonts");
}

// Page-data collection queries the Tina content API. With the local (no
// credential) build that is http://localhost:4001, so run next build inside
// `tinacms dev --noWatch`, which serves it for the duration of the command.
run("npx", ["tinacms", "dev", "--noWatch", "--noTelemetry", "-c", "node scripts/build-check.mjs --inner-next-build"], env);

if (existsSync(join(root, "scripts/check-analytics-off.mjs"))) {
  run("node", ["scripts/check-analytics-off.mjs"]);
}
restoreTinaSideEffects();
console.log("\nbuild-check PASSED");
