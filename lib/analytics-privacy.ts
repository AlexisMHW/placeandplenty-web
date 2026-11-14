// Pure, dependency-free privacy helpers for web analytics (GA4 + PostHog).
// PROPOSAL ONLY - not wired into app/layout.tsx until the owner approves.
// Nothing here loads a script, sets a cookie or sends an event; it only decides
// WHETHER something may happen and WHAT it may contain, so it is unit-testable.
//
// Mode (NEXT_PUBLIC_ANALYTICS_MODE):
//   "off"      - no analytics script is ever loaded.
//   "consent"  - DEFAULT. Nothing loads until the visitor accepts. Global Privacy
//                Control (GPC) is treated as a refusal. Safer than today's behavior.
//   "legacy"   - today's behavior (load for everyone). Exists only so the owner can
//                keep current behavior deliberately; it is never the default.
// Unknown values fall back to "consent".

export type AnalyticsMode = "off" | "consent" | "legacy";
export type ConsentChoice = "granted" | "denied";

export const CONSENT_STORAGE_KEY = "pp_analytics_consent_v1";
export const CONSENT_POLICY_VERSION = "2026-11-13";

export function resolveMode(raw: string | undefined | null): AnalyticsMode {
  if (raw === "off" || raw === "legacy" || raw === "consent") return raw;
  return "consent";
}

// Paths whose URL contains a bearer secret, or that belong to the private,
// signed-in host surface or the auth flow. Analytics must never load or capture
// here (a guest invitation link is a credential: anyone holding it can RSVP).
const EXCLUDED_PREFIXES = [
  "/invite",
  "/gallery",
  "/host/co-host-invite",
  "/auth",
  "/reset-password",
  "/command-center",
  "/admin",
  "/api",
  "/creator",
];

export function isAnalyticsExcludedPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return EXCLUDED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

const SENSITIVE_QUERY_KEYS = new Set([
  "token", "code", "access_token", "refresh_token", "id_token", "token_hash", "t", "key",
  "email", "e", "phone", "name", "invite", "rsvp", "session_id", "next", "state",
]);

// Strip anything secret/personal from a URL before it can reach a third party.
// Keeps marketing parameters (utm_*, ref/creator code handled by first-party attribution).
export function sanitizeUrlForAnalytics(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw, "https://placeandplenty.com");
  } catch {
    return "";
  }
  if (isAnalyticsExcludedPath(url.pathname)) {
    const first = `/${url.pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return `${url.origin}${first}/[redacted]`;
  }
  for (const key of Array.from(url.searchParams.keys())) {
    const k = key.toLowerCase();
    if (SENSITIVE_QUERY_KEYS.has(k) || (!k.startsWith("utm_") && k !== "ref" && k !== "via")) {
      url.searchParams.delete(key);
    }
  }
  url.hash = "";
  url.pathname = url.pathname.replace(UUID_SEGMENT, "/[id]");
  return url.toString().replace("%5Bid%5D", "[id]");
}

export function scrubEventProperties(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v)) out[k] = sanitizeUrlForAnalytics(v);
    else if (/email|phone|name|token|address|message/i.test(k)) continue;
    else out[k] = v;
  }
  return out;
}

// Events we never want to leave the browser at all, whatever the SDK or a remote
// config tries to enable. $web_vitals carries an unsanitized `current_url`; the others
// can carry text, element names or screen content.
const BLOCKED_POSTHOG_EVENTS = new Set([
  "$web_vitals", "$autocapture", "$snapshot", "$performance_event", "$exception",
  "$dead_click", "$rageclick", "$heatmap", "$pageleave", "$survey shown", "$survey sent",
]);

// Keys PostHog itself requires. `token` is the public project key (not a user token);
// dropping it makes PostHog reject every event.
const POSTHOG_REQUIRED_KEYS = new Set(["token", "distinct_id", "$device_id", "$session_id", "$window_id"]);

function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) ? sanitizeUrlForAnalytics(value) : value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!(depth === 0 && POSTHOG_REQUIRED_KEYS.has(k)) &&
          /email|phone|(^|_)name($|_)|token|address|message|\$el_text|\$elements/i.test(k)) continue;
      out[k] = scrubDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

// PostHog before_send hook: runs on EVERY event after the SDK adds its automatic
// properties ($current_url, $session_entry_url, $referrer, $initial_*, ...), so those
// are sanitized too. Returning null drops the event.
export function scrubPostHogEvent<T extends { event?: string; properties?: Record<string, unknown> } | null>(
  evt: T,
): T | null {
  if (!evt) return null;
  if (evt.event && BLOCKED_POSTHOG_EVENTS.has(evt.event)) return null;
  if (evt.properties) evt.properties = scrubDeep(evt.properties) as Record<string, unknown>;
  const rest = evt as unknown as Record<string, unknown>;
  for (const key of ["$set", "$set_once"]) {
    if (rest[key]) rest[key] = scrubDeep(rest[key]);
  }
  return evt;
}

export interface BrowserSignals {
  globalPrivacyControl?: boolean;
  doNotTrack?: string | null;
  stored?: string | null;
}

export function parseStoredConsent(stored: string | null | undefined): ConsentChoice | null {
  if (!stored) return null;
  try {
    const v = JSON.parse(stored) as { choice?: string; version?: string };
    if (v.version !== CONSENT_POLICY_VERSION) return null; // re-ask when the policy changes
    return v.choice === "granted" || v.choice === "denied" ? v.choice : null;
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice, now: Date = new Date()): string {
  return JSON.stringify({ choice, version: CONSENT_POLICY_VERSION, at: now.toISOString() });
}

export type AnalyticsDecision =
  | { load: false; reason: "mode_off" | "excluded_path" | "gpc_refusal" | "dnt_refusal" | "denied" | "no_choice_yet" }
  | { load: true; reason: "granted" | "legacy" };

export function decideAnalytics(input: {
  mode: AnalyticsMode;
  pathname: string;
  signals: BrowserSignals;
}): AnalyticsDecision {
  const { mode, pathname, signals } = input;
  if (mode === "off") return { load: false, reason: "mode_off" };
  if (isAnalyticsExcludedPath(pathname)) return { load: false, reason: "excluded_path" };
  if (signals.globalPrivacyControl === true) return { load: false, reason: "gpc_refusal" };
  if (mode === "legacy") return { load: true, reason: "legacy" };
  if (signals.doNotTrack === "1") return { load: false, reason: "dnt_refusal" };
  const choice = parseStoredConsent(signals.stored);
  if (choice === "granted") return { load: true, reason: "granted" };
  if (choice === "denied") return { load: false, reason: "denied" };
  return { load: false, reason: "no_choice_yet" };
}

// Whether the banner should be shown: only when a choice is still needed and nothing
// already refuses analytics (GPC/DNT/off/excluded paths need no banner).
export function shouldShowBanner(input: { mode: AnalyticsMode; pathname: string; signals: BrowserSignals }): boolean {
  return decideAnalytics(input).reason === "no_choice_yet";
}

// PostHog init options. Replay, autocapture, surveys and person profiles are OFF.
// Verify each key against the installed posthog-js version before enabling (see plan).
export function postHogInitOptions(apiHost = "https://us.i.posthog.com") {
  return {
    api_host: apiHost,
    autocapture: false,
    capture_pageview: false, // pageviews sent manually with sanitized URLs
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_dead_clicks: false,
    capture_performance: false, // no web-vitals / network timing events (they carry raw URLs)
    before_send: scrubPostHogEvent,
    person_profiles: "identified_only" as const, // we never call identify()
    persistence: "localStorage" as const, // first-party storage only after consent
    respect_dnt: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
  };
}

// GA4 config. No Google signals, no ad personalization, no automatic page_view
// (we send one with a sanitized location). Consent Mode is set to "denied" by default
// as defence in depth, but the script is not loaded at all without consent.
export function ga4ConfigParams(pageLocation: string) {
  return {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: sanitizeUrlForAnalytics(pageLocation),
  };
}

export const GA4_CONSENT_DEFAULT_DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;
