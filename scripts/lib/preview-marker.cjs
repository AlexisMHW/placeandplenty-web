// Preview isolation marker (A8 n5). The isolation guard (scripts/check-preview-isolation.mjs) writes this marker
// only when it ran on a Vercel Preview build and PASSED. next.config.js verifies it at the start of `next build`.
// So a Preview build whose Build Command was overridden (guard never ran), or whose environment changed after the
// guard ran, fails instead of silently skipping the check. CommonJS on purpose: next.config.js is CJS and this must
// run on any Node version without TypeScript support. The marker holds a hash of the guarded environment, never values.
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MARKER_FILE = ".preview-isolation-ok.json";
const MARKER_VERSION = 1;
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // a Vercel build never legitimately takes this long between guard and next build

// Every variable the guard looks at. The fingerprint covers all of them, so any change after the guard ran invalidates the marker.
const GUARDED_ENV_NAMES = [
  "VERCEL_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_ANALYTICS_MODE",
  "PAYMENT_PROCESSOR_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "GELATO_API_KEY",
  "MAILERLITE_API_KEY",
  "BREVO_API_KEY",
  "PREVIEW_QA_ALLOW_THIRD_PARTY_KEYS",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WEB_CHECKOUT_TESTER_USER_IDS",
];

function fingerprint(env) {
  const h = crypto.createHash("sha256");
  for (const n of GUARDED_ENV_NAMES) {
    const v = env[n];
    h.update(n + "=" + (typeof v === "string" ? "S" + v.length + ":" + v : "U") + "\n");
  }
  return h.digest("hex");
}

function markerPath(root) {
  return path.join(root || process.cwd(), MARKER_FILE);
}

function writeMarker(env, root, now) {
  const body = { v: MARKER_VERSION, at: (now ?? Date.now()), fp: fingerprint(env) };
  fs.writeFileSync(markerPath(root), JSON.stringify(body) + "\n", { mode: 0o600 });
}

function clearMarker(root) {
  try { fs.rmSync(markerPath(root), { force: true }); } catch { /* ignore */ }
}

/** Returns null when fine, otherwise a short reason string (no values). Applies only to Preview builds. */
function verifyMarker(env, root, now) {
  if (String(env.VERCEL_ENV ?? "").toLowerCase() !== "preview") return null;
  let raw;
  try { raw = fs.readFileSync(markerPath(root), "utf8"); } catch { return `${MARKER_FILE} is missing: the preview isolation check did not run before this build (is the Vercel Build Command overridden? It must be "npm run build")`; }
  let m;
  try { m = JSON.parse(raw); } catch { return `${MARKER_FILE} is unreadable`; }
  if (!m || m.v !== MARKER_VERSION || typeof m.at !== "number" || typeof m.fp !== "string") return `${MARKER_FILE} has an unexpected format`;
  const t = now ?? Date.now();
  if (t - m.at > MAX_AGE_MS || m.at - t > 60 * 1000) return `${MARKER_FILE} is stale; the isolation check must run in the same build`;
  if (m.fp !== fingerprint(env)) return "the build environment changed after the preview isolation check ran";
  return null;
}

/** Throws when a Preview production build is about to run without a passing isolation check. Call from next.config.js. */
function assertPreviewIsolationRan(phase, env, root, now) {
  if (phase !== "phase-production-build") return;
  const why = verifyMarker(env ?? process.env, root, now);
  if (why) throw new Error(`preview-isolation self-check FAILED: ${why}. Refusing to build this Preview.`);
}

module.exports = { MARKER_FILE, MARKER_VERSION, MAX_AGE_MS, GUARDED_ENV_NAMES, fingerprint, writeMarker, clearMarker, verifyMarker, assertPreviewIsolationRan };
