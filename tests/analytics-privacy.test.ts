import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_POLICY_VERSION,
  decideAnalytics,
  ga4ConfigParams,
  isAnalyticsExcludedPath,
  parseStoredConsent,
  postHogInitOptions,
  resolveMode,
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

test("scrubEventProperties removes personal keys and sanitizes URLs", () => {
  const out = scrubEventProperties({
    client_platform: "web",
    product: "gathering_pass",
    email: "a@b.com",
    guest_name: "Sam",
    referrer: "https://placeandplenty.com/invite/SECRET",
    count: 2,
  });
  assert.deepEqual(out, { client_platform: "web", product: "gathering_pass", referrer: "https://placeandplenty.com/invite/[redacted]", count: 2 });
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
    assert.equal(scrubPostHogEvent({ event, properties: { current_url: "https://x.test/invite/abc" } }), null);
  }
  assert.equal(scrubPostHogEvent(null), null);
});

test("PostHog before_send sanitizes automatic URL properties and drops personal keys", () => {
  const out = scrubPostHogEvent({
    event: "$pageview",
    properties: {
      $current_url: "https://x.test/login?next=%2Fhost%2Fco-host-invite%2FSECRET&utm_source=a",
      $session_entry_url: "https://x.test/pricing?email=betsy@example.com&name=Betsy%20Hughes&ref=c1",
      $referrer: "https://x.test/auth/callback?code=ABC#frag",
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
