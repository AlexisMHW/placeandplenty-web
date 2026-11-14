// Single mount point for website analytics, so app/layout.tsx needs one line.
// ORDER RULE: AnalyticsConsent MUST render before AnalyticsTracker. Sibling effects run
// in order, and track() is a no-op until AnalyticsConsent has loaded analytics, so the
// other order would drop first-load conversion events. Keep the order here, not in the layout.
import { Suspense } from "react";
import AnalyticsConsent from "@/components/AnalyticsConsent";
import AnalyticsTracker from "@/components/AnalyticsTracker";

export default function AnalyticsRoot() {
  return (
    <>
      <Suspense fallback={null}>
        <AnalyticsConsent />
      </Suspense>
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
    </>
  );
}
