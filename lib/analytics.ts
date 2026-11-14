"use client";

import { ANALYTICS_EVENT_NAMES, isAnalyticsExcludedPath, routeTrackCall, scrubEventProperties, type AnalyticsWindowState } from "./analytics-privacy";

// One canonical client-side analytics wrapper. Only allowlisted, plain-text event
// properties are sent (see SAFE_EVENT_PROPERTY_KEYS); names, emails, invitation
// content and guest data cannot be added by accident.
// GA4 and PostHog receive the same business events so acquisition and product
// behavior can be reconciled without maintaining two vocabularies.
export type AnalyticsEvent = (typeof ANALYTICS_EVENT_NAMES)[number];

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsMeta = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    posthog?: {
      init?: (...args: unknown[]) => void;
      capture?: (event: string, properties?: Record<string, unknown>) => void;
      opt_out_capturing?: () => void;
      opt_in_capturing?: () => void;
      has_opted_out_capturing?: () => boolean;
    };
  }
}

export function track(event: AnalyticsEvent, meta: AnalyticsMeta = {}) {
  if (typeof window === "undefined") return;

  // Consent gate: nothing is sent unless AnalyticsConsent has loaded analytics for this visitor,
  // and never from bearer-token routes (see lib/analytics-privacy.ts). A call that arrives before
  // the first consent decision is held in memory and replayed or discarded by AnalyticsConsent.
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  const route = routeTrackCall(window as unknown as AnalyticsWindowState, event, meta);
  if (route !== "send") return;

  const cleanMeta = scrubEventProperties(
    Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined))
  );

  window.gtag?.("event", event, cleanMeta);
  window.posthog?.capture?.(event, cleanMeta);

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, cleanMeta);
  }
}
