"use client";

// One canonical client-side analytics wrapper. Keep event payloads free of
// names, emails, invitation content, guest data, or other private content.
// GA4 and PostHog receive the same business events so acquisition and product
// behavior can be reconciled without maintaining two vocabularies.
export type AnalyticsEvent =
  | "checklist_requested"
  | "checklist_signup_completed"
  | "checklist_downloaded"
  | "checklist_account_clicked"
  | "homepage_view"
  | "search_landing_view"
  | "guest_list_signup_started"
  | "guest_list_signup_completed"
  | "founding_host_clicked"
  | "founding_host_application_completed"
  | "pricing_viewed"
  | "support_viewed"
  | "signup_started"
  | "account_created"
  | "app_store_click"
  | "play_store_click"
  | "gathering_started"
  | "gathering_created"
  | "paywall_viewed"
  | "checkout_started"
  | "purchase_completed"
  | "paper_suite_viewed"
  | "paper_suite_preview_generated"
  | "paper_suite_quote_received"
  | "paper_suite_checkout_started";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsMeta = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    posthog?: {
      capture?: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

export function track(event: AnalyticsEvent, meta: AnalyticsMeta = {}) {
  if (typeof window === "undefined") return;

  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined)
  );

  window.gtag?.("event", event, cleanMeta);
  window.posthog?.capture?.(event, cleanMeta);

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, cleanMeta);
  }
}
