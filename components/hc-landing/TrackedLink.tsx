"use client";

import type { ReactNode } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

// A plain link that records an OBSERVABLE click through the existing consent-aware analytics wrapper.
// Only allowlisted, non-personal properties are passed (entry_point, store). A click is not a membership, install or application.
export default function TrackedLink({
  href, event, meta, className, children, external = false, ariaLabel,
}: {
  href: string;
  event?: AnalyticsEvent;
  meta?: Record<string, string>;
  className?: string;
  children: ReactNode;
  external?: boolean;
  ariaLabel?: string;
}) {
  const onClick = () => { if (event) track(event, meta); };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return <a href={href} onClick={onClick} className={className} aria-label={ariaLabel}>{children}</a>;
}
