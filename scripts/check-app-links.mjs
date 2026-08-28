// Runs before `next build`, alongside the Tina codegen check.
//
// These two files tell iOS and Android that placeandplenty.com belongs
// to the Place & Plenty app. Apple fetches the AASA through its own CDN
// and caches the result, so a malformed or wrong-appID file poisons
// universal-link verification for hours after it is corrected —
// strictly worse than the 404 that was there before Phase B. A failed
// build is safe by comparison; Vercel keeps serving the previous
// deployment.
//
// Originally this only refused to ship the scaffold's placeholders.
// Those are now filled in, so that check alone would pass forever and
// catch nothing. The real ongoing risk is a typo in a credential that
// nothing else validates — both files are static JSON no test touches,
// and neither iOS nor Android reports a verification failure anywhere
// the website can see. So this checks their shape too.
//
// Deliberately NOT checked: whether the appID and fingerprint are the
// *correct* ones. Nothing in this repo can know that. See §26 and the
// app-side audit for where they came from.

import { readFileSync } from "node:fs";

const AASA = "public/.well-known/apple-app-site-association";
const ASSETLINKS = "public/.well-known/assetlinks.json";

// A Team ID is 10 uppercase alphanumerics; the bundle follows after a dot.
const APP_ID = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/;
// Play gives the fingerprint as 32 uppercase hex bytes, colon-separated.
const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

const problems = [];

const read = (file) => {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    problems.push(`${file} is missing.`);
    return null;
  }
  const placeholders = raw.match(/REPLACE_WITH_[A-Z0-9_]+/g);
  if (placeholders) {
    problems.push(`${file} still contains ${[...new Set(placeholders)].join(", ")}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    problems.push(`${file} is not valid JSON: ${e.message}`);
    return null;
  }
};

const aasa = read(AASA);
if (aasa) {
  const details = aasa?.applinks?.details;
  if (!Array.isArray(details) || details.length === 0) {
    problems.push(`${AASA}: applinks.details is missing or empty.`);
  } else {
    for (const [i, d] of details.entries()) {
      const at = `${AASA}: details[${i}]`;

      // iOS 13+ reads appIDs/components; iOS 12 and earlier read
      // appID/paths. Both are present on purpose — but if they ever
      // disagree, older and newer devices silently get different
      // behaviour, which is close to undebuggable from the outside.
      const ids = [...(d.appIDs ?? []), ...(d.appID ? [d.appID] : [])];
      if (ids.length === 0) problems.push(`${at} has neither appIDs nor appID.`);
      for (const id of ids) {
        if (!APP_ID.test(id)) {
          problems.push(`${at}: "${id}" is not TEAMID.bundle.id (10 uppercase alphanumerics, a dot, then the bundle).`);
        }
      }
      if (d.appID && d.appIDs && !d.appIDs.includes(d.appID)) {
        problems.push(`${at}: appID "${d.appID}" is not in appIDs — iOS 12 and iOS 13+ would claim different apps.`);
      }

      const modern = (d.components ?? []).map((c) => c["/"]).filter(Boolean);
      const legacy = d.paths ?? [];
      if (modern.length === 0 && legacy.length === 0) {
        problems.push(`${at} claims no paths at all.`);
      }
      if (modern.length > 0 && legacy.length > 0) {
        const only = (a, b) => a.filter((p) => !b.includes(p));
        const m = only(modern, legacy);
        const l = only(legacy, modern);
        if (m.length || l.length) {
          problems.push(
            `${at}: components and paths disagree` +
              (m.length ? ` — only in components: ${m.join(", ")}` : "") +
              (l.length ? ` — only in paths: ${l.join(", ")}` : "")
          );
        }
      }
    }
  }
}

const links = read(ASSETLINKS);
if (links) {
  if (!Array.isArray(links) || links.length === 0) {
    problems.push(`${ASSETLINKS} must be a non-empty array of statements.`);
  } else {
    for (const [i, s] of links.entries()) {
      const at = `${ASSETLINKS}: [${i}]`;
      if (!(s.relation ?? []).includes("delegate_permission/common.handle_all_urls")) {
        problems.push(`${at} is missing the delegate_permission/common.handle_all_urls relation.`);
      }
      if (s.target?.namespace !== "android_app") {
        problems.push(`${at}: target.namespace should be "android_app", got ${JSON.stringify(s.target?.namespace)}.`);
      }
      if (!s.target?.package_name) {
        problems.push(`${at}: target.package_name is missing.`);
      }
      const prints = s.target?.sha256_cert_fingerprints ?? [];
      if (prints.length === 0) {
        problems.push(`${at}: no sha256_cert_fingerprints — Android cannot verify the link.`);
      }
      for (const p of prints) {
        if (!SHA256.test(p)) {
          problems.push(`${at}: "${p}" is not a SHA-256 fingerprint (32 uppercase hex bytes, colon-separated).`);
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    [
      "",
      "App-link check FAILED — refusing to deploy broken association files.",
      "",
      ...problems.map((p) => `  - ${p}`),
      "",
      "  Where the real values come from:",
      "",
      "    Apple Team ID",
      "      Apple Developer -> Membership. Goes in the AASA as",
      '      "<TEAM_ID>.com.placeandplenty.app".',
      "",
      "    Android signing SHA-256",
      "      Play Console -> Release -> Setup -> App signing. Use the app",
      "      signing key fingerprint; add the upload key's too if internal",
      "      test builds need to verify.",
      "",
      "  Failing the build is the safe outcome: Apple caches the AASA it",
      "  fetched, so a wrong one outlives the deploy that shipped it.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

console.log("App-link check: association files present, populated, well-formed. OK.");
