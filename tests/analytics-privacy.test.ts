import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ANALYTICS_EVENT_NAMES,
  SAFE_EVENT_PROPERTY_KEYS,
  CONSENT_POLICY_VERSION,
  decideAnalytics,
  ga4ConfigParams,
  isAnalyticsExcludedPath,
  parseStoredConsent,
  postHogInitOptions,
  resolveMode,
  sanitizePathForAnalytics,
  sanitizeUrlForAnalytics,
  scrubEventProperties,
  scrubPostHogEvent,
  serializeConsent,
  shouldShowBanner,
} from "../lib/analytics-privacy.ts";

const none = { stored: null, globalPrivacyControl: false, doNotTrack: null };
const granted = serializeConsent("granted");
const denied = serializeConsent("denied");

test("mode defaults to consent; unknown values fall back to consent", () => {
  assert.equal(resolveMode(undefined), "consent");
  assert.equal(resolveMode(""), "consent");
  assert.equal(resolveMode("everything"), "consent");
  assert.equal(resolveMode("off"), "off");
  assert.equal(resolveMode("legacy"), "legacy");
});

test("no choice yet: nothing loads and the banner is shown", () => {
  const d = decideAnalytics({ mode: "consent", pathname: "/", signals: none });
  assert.deepEqual(d, { load: false, reason: "no_choice_yet" });
  assert.equal(shouldShowBanner({ mode: "consent", pathname: "/", signals: none }), true);
});

test("accepting loads analytics; declining does not and hides the banner", () => {
  assert.equal(decideAnalytics({ mode: "consent", pathname: "/pricing", signals: { ...none, stored: granted } }).load, true);
  const d = decideAnalytics({ mode: "consent", pathname: "/pricing", signals: { ...none, stored: denied } });
  assert.equal(d.load, false);
  assert.equal(shouldShowBanner({ mode: "consent", pathname: "/pricing", signals: { ...none, stored: denied } }), false);
});

test("Global Privacy Control overrides a stored grant, even in legacy mode", () => {
  const sig = { ...none, stored: granted, globalPrivacyControl: true };
  assert.equal(decideAnalytics({ mode: "consent", pathname: "/", signals: sig }).reason, "gpc_refusal");
  assert.equal(decideAnalytics({ mode: "legacy", pathname: "/", signals: sig }).reason, "gpc_refusal");
  assert.equal(shouldShowBanner({ mode: "consent", pathname: "/", signals: sig }), false);
});

test("Do Not Track is honored in consent mode", () => {
  assert.equal(decideAnalytics({ mode: "consent", pathname: "/", signals: { ...none, stored: granted, doNotTrack: "1" } }).reason, "dnt_refusal");
});

test("mode off never loads", () => {
  assert.equal(decideAnalytics({ mode: "off", pathname: "/", signals: { ...none, stored: granted } }).load, false);
});

test("legacy mode keeps today's behavior (loads with no choice) except on excluded paths", () => {
  assert.equal(decideAnalytics({ mode: "legacy", pathname: "/", signals: none }).load, true);
  assert.equal(decideAnalytics({ mode: "legacy", pathname: "/invite/abc123", signals: none }).load, false);
});

test("bearer-token and auth routes are always excluded, even with consent", () => {
  for (const p of ["/invite/SECRET", "/invite", "/gallery/SECRET", "/host/co-host-invite/SECRET", "/auth/callback", "/reset-password", "/command-center", "/command-center/overview", "/admin", "/api/checkout", "/creator/dashboard", "/INVITE/Secret"]) {
    assert.equal(isAnalyticsExcludedPath(p), true, p);
    assert.equal(decideAnalytics({ mode: "consent", pathname: p, signals: { ...none, stored: granted } }).reason, "excluded_path", p);
  }
  for (const p of ["/", "/pricing", "/host/create", "/host/g/1234", "/signup", "/invited-by-friends", "/inviteme"]) {
    assert.equal(isAnalyticsExcludedPath(p), false, p);
  }
});

test("stored consent from an older policy version is ignored (re-ask)", () => {
  const old = JSON.stringify({ choice: "granted", version: "2020-01-01", at: "2020-01-01T00:00:00Z" });
  assert.equal(parseStoredConsent(old), null);
  assert.equal(parseStoredConsent("not json"), null);
  assert.equal(parseStoredConsent(null), null);
  assert.equal(parseStoredConsent(granted), "granted");
  assert.equal(JSON.parse(granted).version, CONSENT_POLICY_VERSION);
});

test("sanitizeUrl redacts secret paths and strips non-marketing query/hash/ids", () => {
  assert.equal(sanitizeUrlForAnalytics("https://placeandplenty.com/invite/AbC123secret?x=1"), "https://placeandplenty.com/invite/[redacted]");
  assert.equal(sanitizeUrlForAnalytics("https://placeandplenty.com/host/co-host-invite/tok"), "https://placeandplenty.com/host/[redacted]");
  assert.equal(
    sanitizeUrlForAnalytics("https://placeandplenty.com/pricing?utm_source=ig&email=a@b.com&token=zzz#frag"),
    "https://placeandplenty.com/pricing?utm_source=ig",
  );
  assert.equal(
    sanitizeUrlForAnalytics("https://placeandplenty.com/host/g/3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/people?session_id=cs_1"),
    "https://placeandplenty.com/host/g/[id]/people",
  );
  assert.equal(sanitizeUrlForAnalytics("https://placeandplenty.com/?ref=creator1&foo=bar"), "https://placeandplenty.com/?ref=creator1");
  assert.equal(sanitizeUrlForAnalytics("http://"), "");
});

test("scrubEventProperties is an allowlist: unknown keys, URLs and free text are dropped", () => {
  const out = scrubEventProperties({
    client_platform: "web",
    product: "gathering_pass",
    email: "a@b.com",
    guest_name: "Sam",
    referrer: "https://placeandplenty.com/invite/SECRET",
    count: 2,
    topic: "Betsy Hughes betsy@example.com",
    entry_point: "guest_list",
    quantity: 3,
    matched_invitation: true,
  });
  assert.deepEqual(out, { client_platform: "web", product: "gathering_pass", entry_point: "guest_list", quantity: 3, matched_invitation: true });
});

test("PostHog options: replay, autocapture, surveys, person profiles are off", () => {
  const o = postHogInitOptions();
  assert.equal(o.autocapture, false);
  assert.equal(o.disable_session_recording, true);
  assert.equal(o.disable_surveys, true);
  assert.equal(o.capture_pageview, false);
  assert.equal(o.person_profiles, "identified_only");
  assert.equal(o.respect_dnt, true);
  assert.equal(o.mask_all_text, true);
});

test("GA4 config: no signals, no ad personalization, no auto page_view, sanitized location", () => {
  const c = ga4ConfigParams("https://placeandplenty.com/pricing?token=zzz&utm_campaign=fall");
  assert.equal(c.send_page_view, false);
  assert.equal(c.allow_google_signals, false);
  assert.equal(c.allow_ad_personalization_signals, false);
  assert.equal(c.page_location, "https://placeandplenty.com/pricing?utm_campaign=fall");
});

test("PostHog before_send drops web-vitals/autocapture/snapshot events", () => {
  for (const event of ["$web_vitals", "$autocapture", "$snapshot", "$exception"]) {
    assert.equal(scrubPostHogEvent({ event, properties: { current_url: "https://placeandplenty.com/invite/abc" } }), null);
  }
  assert.equal(scrubPostHogEvent(null), null);
});

test("PostHog before_send sanitizes automatic URL properties and drops personal keys", () => {
  const out = scrubPostHogEvent({
    event: "$pageview",
    properties: {
      $current_url: "https://placeandplenty.com/login?next=%2Fhost%2Fco-host-invite%2FSECRET&utm_source=a",
      $session_entry_url: "https://placeandplenty.com/pricing?email=betsy@example.com&name=Betsy%20Hughes&ref=c1",
      $referrer: "https://placeandplenty.com/auth/callback?code=ABC#frag",
      user_email: "betsy@example.com",
      $pathname: "/pricing",
    },
  });
  const json = JSON.stringify(out);
  for (const secret of ["SECRET", "betsy", "Hughes", "code=ABC", "frag"]) assert.ok(!json.includes(secret), secret);
  assert.ok(json.includes("utm_source=a"));
  assert.ok(json.includes("ref=c1"));
});

test("PostHog init options wire the scrubber and disable performance capture", () => {
  const o = postHogInitOptions();
  assert.equal(o.capture_performance, false);
  assert.equal(o.before_send, scrubPostHogEvent);
});

test("PostHog before_send keeps the project token and ids PostHog needs to accept the event", () => {
  const out = scrubPostHogEvent({
    event: "$pageview",
    properties: { token: "phc_public_project_key", distinct_id: "abc", $session_id: "s1", auth_token: "SECRET" },
  });
  assert.equal(out?.properties?.token, "phc_public_project_key");
  assert.equal(out?.properties?.distinct_id, "abc");
  assert.equal(out?.properties?.auth_token, undefined);
});


// ---------------------------------------------------------------------------
// Phase 2: /host and /login stay measurable, but only through sanitized, allowlisted data.

test("host area paths are templated: gathering ids (UUID or not) never appear", () => {
  const uuid = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
  assert.equal(sanitizePathForAnalytics("/host"), "/host");
  assert.equal(sanitizePathForAnalytics("/host/create"), "/host/create");
  assert.equal(sanitizePathForAnalytics(`/host/g/${uuid}`), "/host/g/[id]");
  assert.equal(sanitizePathForAnalytics("/host/g/betsys-fall-dinner"), "/host/g/[id]");
  assert.equal(sanitizePathForAnalytics("/host/g/abc123/people"), "/host/g/[id]/people");
  assert.equal(sanitizePathForAnalytics("/host/g/abc123/shopping"), "/host/g/[id]/shopping");
  assert.equal(sanitizePathForAnalytics("/host/g/abc123/not-a-section"), "/host/g/[id]/[other]");
  assert.equal(sanitizePathForAnalytics("/host/g/abc123/people/extra"), "/host/g/[id]/[other]");
  assert.equal(sanitizePathForAnalytics("/host/something-new/betsy@example.com"), "/host/[other]");
  assert.equal(sanitizePathForAnalytics("/HOST/G/Secret/People"), "/host/g/[id]/people");
});

test("non-host paths lose id-like, token-like and email-like segments", () => {
  assert.equal(sanitizePathForAnalytics("/pricing"), "/pricing");
  assert.equal(sanitizePathForAnalytics("/checkout/gathering_pass"), "/checkout/gathering_pass");
  assert.equal(sanitizePathForAnalytics("/x/cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoP"), "/x/[id]");
  assert.equal(sanitizePathForAnalytics("/x/betsy%40example.com"), "/x/[redacted]");
  assert.equal(sanitizePathForAnalytics("/x/3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/y"), "/x/[id]/y");
  assert.equal(sanitizePathForAnalytics("/gathering-ideas/cozy-fall-supper"), "/gathering-ideas/cozy-fall-supper");
});

test("login redirect URLs keep no next/token/email/name/hash; host URLs keep no ids", () => {
  const u = sanitizeUrlForAnalytics("https://placeandplenty.com/login?next=%2Fhost%2Fg%2F3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f%2Fpeople&email=betsy%40example.com&name=Betsy#access_token=SECRET");
  assert.equal(u, "https://placeandplenty.com/login");
  assert.equal(
    sanitizeUrlForAnalytics("https://placeandplenty.com/host/g/betsys-fall-dinner/people?guest=Betsy%20Hughes&purchase=success&utm_source=newsletter"),
    "https://placeandplenty.com/host/g/[id]/people?utm_source=newsletter",
  );
});

test("marketing query values must be short plain text (no emails, no free text)", () => {
  assert.equal(sanitizeUrlForAnalytics("https://placeandplenty.com/?utm_source=betsy@example.com&utm_medium=email&ref=creator_1"), "https://placeandplenty.com/?utm_medium=email&ref=creator_1");
  assert.equal(sanitizeUrlForAnalytics("https://placeandplenty.com/?utm_campaign=" + "a".repeat(65)), "https://placeandplenty.com/");
  assert.equal(sanitizeUrlForAnalytics("https://placeandplenty.com/?utm_campaign=Betsy%27s%20dinner%21"), "https://placeandplenty.com/");
});

test("external referrers are reduced to their origin (no path, query or search terms)", () => {
  assert.equal(sanitizeUrlForAnalytics("https://www.google.com/search?q=betsy+hughes+dinner&oq=x"), "https://www.google.com/");
  assert.equal(sanitizeUrlForAnalytics("https://l.facebook.com/l.php?u=https%3A%2F%2Fplaceandplenty.com%2Finvite%2FSECRET"), "https://l.facebook.com/");
});

test("PostHog before_send: only business events and $pageview may leave; identity events are dropped", () => {
  for (const event of ["$identify", "$create_alias", "$groupidentify", "$set", "$autocapture", "$web_vitals", "$snapshot", "$pageleave", "$exception", "some_new_event", "$feature_flag_called"]) {
    assert.equal(scrubPostHogEvent({ event, properties: { distinct_id: "x" } }), null, event);
  }
  for (const event of ["$pageview", ...ANALYTICS_EVENT_NAMES]) {
    assert.notEqual(scrubPostHogEvent({ event, properties: { distinct_id: "x" } }), null, event);
  }
});

test("PostHog before_send: unknown properties, $set and $set_once are removed (allowlist)", () => {
  const evt = {
    event: "$pageview",
    $set: { email: "betsy@example.com", $initial_current_url: "https://placeandplenty.com/invite/SECRET" },
    $set_once: { $initial_referrer: "https://placeandplenty.com/gallery/SECRET" },
    properties: {
      token: "phc_x", distinct_id: "d1", $browser: "Chrome", $device_type: "Desktop",
      $current_url: "https://placeandplenty.com/host/g/betsys-fall-dinner/people?guest=Betsy",
      $pathname: "/host/g/betsys-fall-dinner/people",
      $referrer: "https://www.google.com/search?q=betsy",
      title: "Betsy's Fall Dinner - Place & Plenty",
      $title: "Betsy's Fall Dinner",
      $el_text: "Betsy Hughes",
      email: "betsy@example.com",
      $feature_flag_response: true,
      client_platform: "web",
      utm_source: "newsletter",
      utm_campaign: "betsy@example.com",
    } as Record<string, unknown>,
  };
  const out = scrubPostHogEvent(evt) as typeof evt & Record<string, unknown>;
  assert.equal(out.$set, undefined);
  assert.equal(out.$set_once, undefined);
  const json = JSON.stringify(out);
  for (const secret of ["Betsy", "betsy", "SECRET", "betsys-fall-dinner", "q=betsy"]) assert.ok(!json.includes(secret), secret);
  assert.equal(out.properties.$current_url, "https://placeandplenty.com/host/g/[id]/people");
  assert.equal(out.properties.$pathname, "/host/g/[id]/people");
  assert.equal(out.properties.$referrer, "https://www.google.com/");
  assert.equal(out.properties.$browser, "Chrome");
  assert.equal(out.properties.client_platform, "web");
  assert.equal(out.properties.utm_source, "newsletter");
  assert.equal(out.properties.utm_campaign, undefined);
});

test("PostHog before_send: nothing is sent while paused or while the browser is on a secret-bearing route", () => {
  const g = globalThis as { __ppAnalyticsPaused?: boolean; location?: { pathname: string } };
  try {
    g.__ppAnalyticsPaused = true;
    assert.equal(scrubPostHogEvent({ event: "$pageview", properties: { distinct_id: "d" } }), null);
    g.__ppAnalyticsPaused = false;
    g.location = { pathname: "/invite/SECRET" };
    assert.equal(scrubPostHogEvent({ event: "$pageview", properties: { distinct_id: "d" } }), null);
    g.location = { pathname: "/host/g/abc/people" };
    assert.notEqual(scrubPostHogEvent({ event: "$pageview", properties: { distinct_id: "d" } }), null);
  } finally {
    delete g.__ppAnalyticsPaused;
    delete g.location;
  }
});

test("PostHog options keep replay, recorder loading, autocapture, flags, surveys and exceptions off", () => {
  const o = postHogInitOptions() as Record<string, unknown>;
  assert.equal(o.disable_session_recording, true);
  assert.equal(o.disable_external_dependency_loading, true);
  assert.equal(o.advanced_disable_flags, true);
  assert.equal(o.autocapture, false);
  assert.equal(o.capture_pageview, false);
  assert.equal(o.capture_pageleave, false);
  assert.equal(o.capture_heatmaps, false);
  assert.equal(o.capture_exceptions, false);
  assert.equal(o.capture_dead_clicks, false);
  assert.equal(o.enable_recording_console_log, false);
  assert.equal(o.disable_surveys, true);
});

test("GA4 page params: sanitized location and referrer, constant title, no signals", () => {
  const c = ga4ConfigParams("https://placeandplenty.com/host/g/betsys-fall-dinner?x=1", "https://placeandplenty.com/invite/SECRET");
  assert.equal(c.page_location, "https://placeandplenty.com/host/g/[id]");
  assert.equal(c.page_referrer, "https://placeandplenty.com/invite/[redacted]");
  assert.equal(c.page_title, "Place & Plenty");
  assert.equal(c.ads_data_redaction, true);
  assert.equal(c.url_passthrough, false);
});

test("/host and /login are measurable with consent (not blanket-excluded), co-host invites are not", () => {
  for (const p of ["/host", "/host/create", "/host/g/abc/people", "/login", "/signup"]) {
    assert.equal(decideAnalytics({ mode: "consent", pathname: p, signals: { ...none, stored: granted } }).load, true, p);
    assert.equal(decideAnalytics({ mode: "consent", pathname: p, signals: none }).load, false, p);
  }
  assert.equal(decideAnalytics({ mode: "consent", pathname: "/host/co-host-invite/T", signals: { ...none, stored: granted } }).load, false);
});

// --- source-tree guards: removing a safeguard makes these fail ---------------------------
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "tests" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const ROOT = join(import.meta.dirname ?? ".", "..");
const SOURCES = ["app", "components", "lib"].flatMap((d) => walk(join(ROOT, d)));

test("no source file identifies users, sets user properties or starts session recording", () => {
  const banned = [/posthog\??\.(identify|alias|people|setPersonProperties|startSessionRecording|group)\b/, /gtag\(\s*["']set["']\s*,\s*["']user_(id|properties)["']/, /gtag\(\s*["']config["'][^)]*user_id/];
  for (const f of SOURCES) {
    const text = readFileSync(f, "utf8");
    for (const re of banned) assert.ok(!re.test(text), `${f} matches ${re}`);
  }
});

test("every track() call in the source uses an event on the allowlist and never passes banned keys", () => {
  const names = new Set<string>(ANALYTICS_EVENT_NAMES);
  let calls = 0;
  for (const f of SOURCES) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/\btrack\(\s*["']([a-z_]+)["']/g)) {
      calls += 1;
      assert.ok(names.has(m[1]), `${f}: track("${m[1]}") is not in ANALYTICS_EVENT_NAMES`);
    }
    for (const m of text.matchAll(/\btrack\(\s*["'][a-z_]+["']\s*,\s*\{([^}]*)\}/g)) {
      assert.ok(!/\b(email|name|phone|token|address|message|guest\w*|invite\w*)\s*:/i.test(m[1]), `${f}: track() meta has a personal key: ${m[1]}`);
    }
  }
  assert.ok(calls >= 15, `expected to find track() calls, found ${calls}`);
});

test("AnalyticsConsent keeps replay off, never opts in to recording, and uses the sanitizers", () => {
  const text = readFileSync(join(ROOT, "components/AnalyticsConsent.tsx"), "utf8");
  assert.ok(text.includes("postHogInitOptions()"));
  assert.ok(text.includes("sanitizeUrlForAnalytics"));
  assert.ok(text.includes("ga4PageParams"));
  assert.ok(!/disable_session_recording\s*:\s*false/.test(text));
  assert.ok(!/session_recording\s*:/.test(text));
});

test("every property key passed to track() anywhere in the source is on the allowlist (no silent data loss)", () => {
  const seen = new Set<string>();
  for (const f of SOURCES) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/\btrack\(\s*["'][a-z_]+["']\s*,\s*\{([^}]*)\}/g)) {
      for (const entry of m[1].split(",")) {
        const k = entry.trim().match(/^([a-z_]+)\s*(?::|$)/);
        if (k) seen.add(k[1]);
      }
    }
  }
  assert.ok(seen.size >= 5, `parsed too few keys: ${[...seen]}`);
  for (const k of seen) assert.ok(SAFE_EVENT_PROPERTY_KEYS.has(k), `track() uses property "${k}" that scrubEventProperties would drop`);
});

test("analytics-off path: mode off never loads, shows no banner, and the consent component honors it", () => {
  const off = { mode: "off" as const, pathname: "/", signals: { stored: granted, globalPrivacyControl: false, doNotTrack: null } };
  assert.deepEqual(decideAnalytics(off), { load: false, reason: "mode_off" });
  assert.equal(shouldShowBanner(off), false);
  const text = readFileSync(join(ROOT, "components/AnalyticsConsent.tsx"), "utf8");
  assert.ok(text.includes("NEXT_PUBLIC_ANALYTICS_MODE") && text.includes("resolveMode("));
  assert.ok(!/https:\/\/www\.googletagmanager\.com/.test(readFileSync(join(ROOT, "app/layout.tsx"), "utf8")), "layout must not load Google directly");
  assert.ok(!/posthog/i.test(readFileSync(join(ROOT, "app/layout.tsx"), "utf8")), "layout must not embed the PostHog snippet");
});

test("layout mounts <AnalyticsRoot />, which renders AnalyticsConsent before AnalyticsTracker", () => {
  const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
  assert.ok(layout.includes("<AnalyticsRoot />"));
  assert.ok(!layout.includes("AnalyticsTracker") && !layout.includes("next/script"));
  const root = readFileSync(join(ROOT, "components/AnalyticsRoot.tsx"), "utf8");
  const a = root.indexOf("<AnalyticsConsent"), b = root.indexOf("<AnalyticsTracker");
  assert.ok(a > 0 && b > 0 && a < b);
});
