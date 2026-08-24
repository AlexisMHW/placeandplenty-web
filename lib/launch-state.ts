// Single config value controlling site-wide CTA and section visibility.
// Change LAUNCH_STATE to move the whole site between phases without
// touching individual page/component code (PRD §38).

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
    primaryLabel: "Join the Guest List",
    primaryHref: "#guest-list",
    showAppStoreBadges: false,
    showPricing: false,
  },
  beta: {
    primaryLabel: "Become a Founding Host",
    primaryHref: "/founding-host",
    secondaryLabel: "Join the Guest List",
    secondaryHref: "#guest-list",
    showAppStoreBadges: false,
    showPricing: false,
  },
  public: {
    primaryLabel: "Download Place & Plenty",
    primaryHref: "#download",
    showAppStoreBadges: true,
    showPricing: true,
  },
};

export function getCurrentCta(): CtaConfig {
  return CTA_BY_STATE[LAUNCH_STATE];
}
