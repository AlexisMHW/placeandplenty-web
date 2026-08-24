// Minimal analytics wrapper. Swap the `track` implementation for
// Plausible/Fathom/PostHog (privacy-conscious options) at deploy time —
// every call site in the app already goes through this one function.

export type AnalyticsEvent =
  | "homepage_view"
  | "guest_list_signup_started"
  | "guest_list_signup_completed"
  | "founding_host_clicked"
  | "founding_host_application_completed"
  | "app_store_clicked"
  | "google_play_clicked"
  | "pricing_viewed"
  | "support_viewed";

export function track(event: AnalyticsEvent, meta?: Record<string, string>) {
  if (typeof window === "undefined") return;
  // No sensitive form content (names, emails) ever passed here — only
  // event name + non-identifying metadata (e.g. gathering type category).
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, meta ?? {});
    return;
  }
  // window.plausible?.(event, { props: meta });
}
