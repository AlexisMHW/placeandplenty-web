import { PRIMARY_PATH } from "@/lib/conversion";

// Site-wide CTA and section visibility, in one place.
//
// THE PRIMARY CONVERSION IS NOW "START FREE", NOT "JOIN THE GUEST LIST".
// Founder instruction, 28 Aug 2026: make Start Free the primary
// conversion where web signup already works. It does — /signup creates
// the same canonical account the app creates, and it is the only
// conversion this website completes end to end.
//
// That reordering matters more than it looks. A waitlist asks someone to
// wait for a product that is already usable in the tab they are looking
// at, and every "join the guest list" button was a working product
// pointing at its own mailing list. The Guest List still exists and is
// still the right thing for people who want the APPS — it is the
// secondary action now rather than the only one.
//
// The label and href come from lib/conversion.ts so the header, the
// closing bands and this file cannot drift into promising different
// things.
//
// WHAT `showPricing` STILL GATES. The pricing SECTION on the homepage,
// not /pricing itself — that page is published and indexed regardless
// (§5 lists it as a minimum V1 destination). The separation is
// deliberate: /pricing always answers "what will this cost", while the
// homepage decides whether to raise the subject.

export type LaunchState = "pre-launch" | "beta" | "public";

export const LAUNCH_STATE: LaunchState = "pre-launch";

export interface CtaConfig {
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  showAppStoreBadges: boolean;
  showPricing: boolean;
}

export const CTA_BY_STATE: Record<LaunchState, CtaConfig> = {
  "pre-launch": {
    primaryLabel: PRIMARY_PATH.shortLabel ?? PRIMARY_PATH.label,
    primaryHref: PRIMARY_PATH.href,
    secondaryLabel: "Join the Guest List",
    secondaryHref: "#guest-list",
    showAppStoreBadges: false,
    showPricing: false,
  },
  beta: {
    primaryLabel: PRIMARY_PATH.shortLabel ?? PRIMARY_PATH.label,
    primaryHref: PRIMARY_PATH.href,
    secondaryLabel: "Become a Founding Host",
    secondaryHref: "/founding-host",
    showAppStoreBadges: false,
    showPricing: false,
  },
  public: {
    primaryLabel: PRIMARY_PATH.shortLabel ?? PRIMARY_PATH.label,
    primaryHref: PRIMARY_PATH.href,
    secondaryLabel: "Join the Guest List",
    secondaryHref: "#guest-list",
    showAppStoreBadges: true,
    showPricing: true,
  },
};

export function getCurrentCta(): CtaConfig {
  return CTA_BY_STATE[LAUNCH_STATE];
}
