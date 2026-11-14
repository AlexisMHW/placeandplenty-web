// Pure, dependency-free privacy helpers for web analytics (GA4 + PostHog).
// Release candidate (Phase 2): consent gating + URL/property allowlists. Not merged or deployed.
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

// Normalise before matching so an encoded ("/%63ommand-center"), double-slashed ("//command-center") or
// differently-cased request can never slip past the exclusion that protects bearer-token and private areas.
function normalizeForExclusion(pathname: string): string {
  let p = String(pathname ?? "").split(/[?#]/)[0];
  for (let i = 0; i < 3; i++) {
    let decoded = p;
    try { decoded = decodeURIComponent(p); } catch { /* keep as-is; malformed escapes are still matched below */ }
    if (decoded === p) break;
    p = decoded;
  }
  p = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
  return p.startsWith("/") ? p : `/${p}`;
}

export function isAnalyticsExcludedPath(pathname: string): boolean {
  const p = normalizeForExclusion(pathname);
  return EXCLUDED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

// Private administrative / creator / bearer areas: even if a path ever reached a sanitiser, its segments
// (ids, applicant names, tokens) are never reported.
const PRIVATE_AREA_ROOTS = new Set(["command-center", "creator", "admin", "invite", "gallery"]);

// ---------------------------------------------------------------------------
// Business events. This list is the ONLY set of custom events that may leave the
// browser (plus PostHog's "$pageview"). Anything else - $identify, $autocapture,
// $set, $web_vitals, $snapshot, ... - is dropped by scrubPostHogEvent.
export const ANALYTICS_EVENT_NAMES = [
  "checklist_requested", "checklist_signup_completed", "checklist_downloaded", "checklist_account_clicked",
  "homepage_view", "search_landing_view", "guest_list_signup_started", "guest_list_signup_completed",
  "founding_host_clicked", "founding_host_application_completed", "pricing_viewed", "support_viewed",
  "signup_started", "account_created", "app_store_click", "play_store_click", "gathering_started",
  "gathering_created", "paywall_viewed", "checkout_started", "purchase_completed", "paper_suite_viewed",
  "paper_suite_preview_generated", "paper_suite_quote_received", "paper_suite_checkout_started",
] as const;

// Custom event properties that may be sent (allowlist). Values must also pass isSafeValue.
export const SAFE_EVENT_PROPERTY_KEYS = new Set([
  "client_platform", "product", "topic", "entry_point", "gathering_type", "piece_type", "size_id",
  "matched_invitation", "quantity", "email_confirmation_required", "edition",
]);

// Hosts treated as "ours". Anything else (a referrer such as google.com) is reduced to its origin.
const OWN_HOSTS = new Set(["placeandplenty.com", "www.placeandplenty.com", "localhost", "127.0.0.1"]);

const MARKETING_QUERY_KEYS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "via"]);

// A marketing value is short, plain text. Anything that could be an email, token or name-like
// free text is dropped rather than trusted.
function isSafeMarketingValue(v: string): boolean {
  return /^[A-Za-z0-9._~ +\-]{1,64}$/.test(v) && !v.includes("@");
}

function isSafeValue(v: unknown): boolean {
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") return /^[A-Za-z0-9._:+ \-]{0,64}$/.test(v) && !v.includes("@");
  return false;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Long unbroken id-like segment (base64/hex/nanoid tokens, Stripe cs_/pi_ ids, slugs with digits are shorter).
const TOKENISH_RE = /^[A-Za-z0-9_-]{24,}$/;

const HOST_STATIC_PAGES = new Set(["account", "closet", "create", "guest-book", "invited", "notifications"]);
const HOST_GATHERING_SECTIONS = new Set([
  "co-hosts", "contributions", "find-help", "guest-experience", "hub", "invitations", "music",
  "paper-suite", "people", "photos", "schedule", "settings", "shopping", "style", "table",
]);

function safeDecode(seg: string): string {
  try { return decodeURIComponent(seg); } catch { return seg; }
}

// Path templating. The signed-in host area is reduced to a fixed set of route shapes so no
// gathering id, name or slug can appear in a page address; other paths only lose id-like segments.
export function sanitizePathForAnalytics(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  const norm = normalizeForExclusion(pathname).split("/").filter(Boolean);
  if (norm.length && PRIVATE_AREA_ROOTS.has(norm[0])) return norm.length === 1 ? `/${norm[0]}` : `/${norm[0]}/[private]`;
  if (segs[0]?.toLowerCase() === "host") {
    if (segs.length === 1) return "/host";
    const second = segs[1].toLowerCase();
    if (segs.length === 2 && HOST_STATIC_PAGES.has(second)) return `/host/${second}`;
    if (second === "g") {
      if (segs.length === 2) return "/host/g/[other]";
      if (segs.length === 3) return "/host/g/[id]";
      const section = segs[3].toLowerCase();
      return segs.length === 4 && HOST_GATHERING_SECTIONS.has(section) ? `/host/g/[id]/${section}` : "/host/g/[id]/[other]";
    }
    return "/host/[other]";
  }
  const out = segs.map((seg) => {
    const d = safeDecode(seg);
    if (UUID_RE.test(d)) return "[id]";
    if (d.includes("@") || d.length > 80) return "[redacted]";
    if (TOKENISH_RE.test(d)) return "[id]";
    return seg;
  });
  return "/" + out.join("/");
}

// Strip anything secret/personal from a URL before it can reach a third party.
// Keeps only marketing parameters (utm_*, ref, via) with plain-text values.
export function sanitizeUrlForAnalytics(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw, "https://placeandplenty.com");
  } catch {
    return "";
  }
  if (!OWN_HOSTS.has(url.hostname.toLowerCase())) return `${url.origin}/`; // external referrer: origin only
  if (isAnalyticsExcludedPath(url.pathname)) {
    const first = `/${url.pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return `${url.origin}${first}/[redacted]`;
  }
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (MARKETING_QUERY_KEYS.has(key.toLowerCase()) && isSafeMarketingValue(value)) kept.append(key.toLowerCase(), value);
  });
  const qs = kept.toString();
  return `${url.origin}${sanitizePathForAnalytics(url.pathname)}${qs ? `?${qs}` : ""}`;
}

// Custom event properties: allowlist of keys AND plain-text values only.
export function scrubEventProperties(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (SAFE_EVENT_PROPERTY_KEYS.has(k) && isSafeValue(v)) out[k] = v;
  }
  return out;
}

// PostHog events allowed out of the browser at all. Everything else is dropped.
const ALLOWED_POSTHOG_EVENTS = new Set<string>(["$pageview", ...ANALYTICS_EVENT_NAMES]);

// Keys PostHog itself requires. `token` is the public project key (not a user token);
// dropping it makes PostHog reject every event.
const POSTHOG_REQUIRED_KEYS = new Set(["token", "distinct_id", "$device_id", "$session_id", "$window_id"]);

// Automatic, non-identifying PostHog properties we keep (allowlist). URL-bearing ones are sanitized.
const POSTHOG_URL_KEYS = new Set(["$current_url", "$referrer", "$session_entry_url", "$session_entry_referrer"]);
const POSTHOG_PATH_KEYS = new Set(["$pathname", "$session_entry_pathname"]);
const POSTHOG_SAFE_AUTO_KEYS = new Set([
  "$lib", "$lib_version", "$browser", "$browser_version", "$os", "$os_version", "$device_type",
  "$screen_height", "$screen_width", "$viewport_height", "$viewport_width", "$timezone", "$timezone_offset",
  "$time", "$insert_id", "$is_identified", "$process_person_profile", "$host", "$referring_domain",
  "$session_entry_host", "$session_entry_referring_domain",
]);

function currentPathname(): string | null {
  const loc = (globalThis as { location?: { pathname?: string } }).location;
  return typeof loc?.pathname === "string" ? loc.pathname : null;
}

// PostHog before_send hook: runs on EVERY event after the SDK adds its automatic properties.
// Returning null drops the event. Defence in depth, in this order:
//   1. only business events and $pageview may be sent (no $identify/$autocapture/$set/$snapshot/...)
//   2. nothing is sent while paused or while the browser is on a secret-bearing route
//   3. only allowlisted properties survive; URLs and paths are sanitized; $set/$set_once are removed
export function scrubPostHogEvent<T extends { event?: string; properties?: Record<string, unknown> } | null>(
  evt: T,
): T | null {
  if (!evt) return null;
  if (!evt.event || !ALLOWED_POSTHOG_EVENTS.has(evt.event)) return null;
  if ((globalThis as { __ppAnalyticsPaused?: boolean }).__ppAnalyticsPaused === true) return null;
  const here = currentPathname();
  if (here !== null && isAnalyticsExcludedPath(here)) return null;
  const rest = evt as unknown as Record<string, unknown>;
  delete rest["$set"];
  delete rest["$set_once"];
  const props = (evt.properties ?? {}) as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (POSTHOG_REQUIRED_KEYS.has(k) || POSTHOG_SAFE_AUTO_KEYS.has(k)) {
      clean[k] = v;
    } else if (POSTHOG_URL_KEYS.has(k)) {
      if (typeof v === "string" && v) clean[k] = sanitizeUrlForAnalytics(v);
    } else if (POSTHOG_PATH_KEYS.has(k)) {
      if (typeof v === "string") clean[k] = sanitizePathForAnalytics(v);
    } else if (SAFE_EVENT_PROPERTY_KEYS.has(k)) {
      if (isSafeValue(v)) clean[k] = v;
    } else if (/^utm_(source|medium|campaign|term|content)$/.test(k) || k === "ref" || k === "via") {
      if (typeof v === "string" && isSafeMarketingValue(v)) clean[k] = v;
    }
  }
  evt.properties = clean;
  return evt;
}

// ---------------------------------------------------------------------------
// First-load ordering. React does not guarantee that sibling effects in different <Suspense>
// boundaries run in tree order in a PRODUCTION build (found by the production-mode browser
// check: `pricing_viewed` was lost on a static page although it worked in dev). So track()
// must not depend on effect order. Calls made BEFORE the first consent decision exists are held
// in memory (never sent), then replayed if the decision is "load" or discarded otherwise.
// Calls made after a decision that says "don't send" are simply dropped; nothing is ever held
// waiting for a future "Accept".
export interface AnalyticsWindowState {
  __ppAnalyticsLoaded?: boolean;
  __ppAnalyticsPaused?: boolean;
  __ppAnalyticsDecided?: boolean;
  __ppAnalyticsQueue?: Array<[string, Record<string, unknown>]>;
}
export const ANALYTICS_QUEUE_LIMIT = 20;

export function routeTrackCall(state: AnalyticsWindowState, event: string, meta: Record<string, unknown>): "send" | "queued" | "drop" {
  if (state.__ppAnalyticsLoaded && !state.__ppAnalyticsPaused) return "send";
  if (!state.__ppAnalyticsDecided && !state.__ppAnalyticsPaused) {
    const q = (state.__ppAnalyticsQueue ??= []);
    if (q.length < ANALYTICS_QUEUE_LIMIT) q.push([event, meta]);
    return "queued";
  }
  return "drop";
}

export function takeQueue(state: AnalyticsWindowState): Array<[string, Record<string, unknown>]> {
  const q = state.__ppAnalyticsQueue ?? [];
  state.__ppAnalyticsQueue = [];
  return q;
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
    capture_heatmaps: false,
    capture_exceptions: false,
    advanced_disable_flags: true, // no feature-flag/remote-config round trip; we use no flags
    disable_external_dependency_loading: true, // never lazy-load the session recorder, surveys, toolbar or exception scripts
    disable_product_tours: true,
    disable_conversations: true,
    enable_recording_console_log: false,
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
// The page title is replaced by a constant because host-area titles can contain a gathering name.
export const GA4_STATIC_PAGE_TITLE = "Place & Plenty";

export function ga4PageParams(pageLocation: string, referrer = "") {
  return {
    page_location: sanitizeUrlForAnalytics(pageLocation),
    page_referrer: referrer ? sanitizeUrlForAnalytics(referrer) : "",
    page_title: GA4_STATIC_PAGE_TITLE,
  };
}

export function ga4ConfigParams(pageLocation: string, referrer = "") {
  return {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ads_data_redaction: true,
    url_passthrough: false,
    ...ga4PageParams(pageLocation, referrer),
  };
}

export const GA4_CONSENT_DEFAULT_DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;
