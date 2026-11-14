"use client";

// PROPOSAL (not active until approved + merged). Replaces the unconditional GA4 and
// PostHog <Script> tags in app/layout.tsx. Loads nothing until lib/analytics-privacy.ts
// says it may; shows a small, equal-weight Accept / Decline banner only when a choice
// is needed. See recovery/privacy/CONSENT_IMPLEMENTATION_PLAN.md.

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CONSENT_STORAGE_KEY,
  GA4_CONSENT_DEFAULT_DENIED,
  decideAnalytics,
  ga4ConfigParams,
  ga4PageParams,
  postHogInitOptions,
  resolveMode,
  sanitizeUrlForAnalytics,
  serializeConsent,
  shouldShowBanner,
  type BrowserSignals,
  type ConsentChoice,
} from "@/lib/analytics-privacy";
import { POSTHOG_PROJECT_KEY, POSTHOG_STUB } from "@/lib/posthog-loader";

const GA_MEASUREMENT_ID = "G-1YEDLLVR34";
const MODE = resolveMode(process.env.NEXT_PUBLIC_ANALYTICS_MODE);

declare global {
  interface Window {
    __ppAnalyticsLoaded?: boolean; // analytics may send right now
    __ppAnalyticsPaused?: boolean; // on a secret-bearing route: scripts stay loaded, nothing is sent
    __ppScriptsInjected?: boolean; // vendor scripts were injected once this page load
    __ppLastPageView?: string; // last address sent, so one visit is not counted twice
    dataLayer?: unknown[];
  }
}

function readSignals(): BrowserSignals {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    stored = null; // storage blocked: treated as "no choice yet" => nothing loads
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return { stored, globalPrivacyControl: nav.globalPrivacyControl === true, doNotTrack: nav.doNotTrack ?? null };
}

function loadScriptsOnce() {
  if (window.__ppScriptsInjected) return;
  window.__ppScriptsInjected = true;

  // GA4
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => { window.dataLayer!.push(args); };
  (window as unknown as { gtag: typeof gtag }).gtag = gtag;
  gtag("consent", "default", GA4_CONSENT_DEFAULT_DENIED);
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, ga4ConfigParams(window.location.href, document.referrer));
  const ga = document.createElement("script");
  ga.async = true;
  ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(ga);

  // PostHog (replay/autocapture/surveys off; see postHogInitOptions)
  new Function(POSTHOG_STUB)();
  window.posthog?.init?.(POSTHOG_PROJECT_KEY, postHogInitOptions());
}

// Keep Google's page location/title/referrer defaults sanitized on every navigation, so any event
// Google builds itself (enhanced measurement) cannot carry a raw URL or a gathering name.
function pinGaPageParams(href: string) {
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("set", ga4PageParams(href, document.referrer));
}

export function sendPageView(href: string) {
  if (!window.__ppAnalyticsLoaded || window.__ppAnalyticsPaused) return;
  if (window.__ppLastPageView === href) return;
  window.__ppLastPageView = href;
  const location = sanitizeUrlForAnalytics(href);
  pinGaPageParams(href);
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", "page_view", { page_location: location });
  window.posthog?.capture?.("$pageview", { $current_url: location });
}

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  const evaluate = useCallback(() => {
    const signals = readSignals();
    const decision = decideAnalytics({ mode: MODE, pathname, signals });
    if (decision.load) {
      loadScriptsOnce();
      window.__ppAnalyticsLoaded = true;
      window.__ppAnalyticsPaused = false;
      if (window.posthog?.has_opted_out_capturing?.()) window.posthog.opt_in_capturing?.();
      sendPageView(window.location.href);
    } else if (window.__ppScriptsInjected) {
      if (decision.reason === "excluded_path") {
        // Moved (client-side) onto a secret-bearing route: pause. Nothing is sent from here,
        // and the SDK's own before_send guard drops anything that slips through. No persistent
        // opt-out is written, so the visitor's earlier choice still applies on other pages.
        window.__ppAnalyticsPaused = true;
        window.__ppLastPageView = undefined;
        pinGaPageParams(window.location.href); // sanitizes to /<first>/[redacted]
      } else {
        // Consent withdrawn / GPC / DNT / mode off: stop collection and remember the opt-out.
        window.__ppAnalyticsLoaded = false;
        window.posthog?.opt_out_capturing?.();
      }
    }
    setShowBanner(shouldShowBanner({ mode: MODE, pathname, signals }));
  }, [pathname]);

  useEffect(() => { evaluate(); }, [evaluate]);

  function choose(choice: ConsentChoice) {
    try { window.localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(choice)); } catch { /* no storage: choice not remembered */ }
    evaluate();
  }

  if (!showBanner) return null;
  return (
    <div role="dialog" aria-live="polite" aria-label="Analytics choice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white p-4 shadow-lg sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:rounded-lg sm:border">
      <p className="text-sm text-neutral-800">
        May we use privacy-limited analytics (Google Analytics and PostHog) to see which pages help people host? No ads, no session recording, and never on your invitation or RSVP links. <a className="underline" href="/privacy">Privacy details</a>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("denied")} className="min-h-11 flex-1 rounded border border-neutral-400 px-3 text-sm font-medium">No thanks</button>
        <button type="button" onClick={() => choose("granted")} className="min-h-11 flex-1 rounded border border-neutral-400 px-3 text-sm font-medium">Accept analytics</button>
      </div>
    </div>
  );
}
