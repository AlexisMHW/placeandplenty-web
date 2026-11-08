// Verified public store destinations. Each platform QR encodes its store URL.
// The /get route remains the platform-aware fallback for existing printed links.

/** The live App Store listing. */
export const APP_STORE_URL: string | null = "https://apps.apple.com/us/app/place-and-plenty/id6806853614";

/** The live Google Play listing. Null until it exists. */
export const PLAY_STORE_URL: string | null = "https://play.google.com/store/apps/details?id=com.placeandplenty.app";

/** Platform-aware forwarder on our own domain. What a QR encodes. */
export const APP_DOWNLOAD_PATH = "/get";

export const APP_DOWNLOAD_URL = `https://placeandplenty.com${APP_DOWNLOAD_PATH}`;

/** True once at least one store listing is real. Gates every action. */
export function hasAnyStoreLink(): boolean {
  return Boolean(APP_STORE_URL || PLAY_STORE_URL);
}

/** True once both exist — the point at which /get can serve either. */
export function hasAllStoreLinks(): boolean {
  return Boolean(APP_STORE_URL && PLAY_STORE_URL);
}

/**
 * Official Apple and Google badge artwork, once the founder has supplied
 * it. Both are trademarked and have written presentation guidelines, so
 * they are dropped in as the vendors' own files rather than redrawn:
 *
 *   Apple  — "Download on the App Store" SVG, Apple marketing resources
 *   Google — "Get it on Google Play" PNG, Google Play brand guidelines
 *
 * Until the files are present the download component renders accessible
 * text buttons in the Place & Plenty visual language instead, which is
 * allowed where the official badge is unavailable and avoids shipping an
 * approximation of someone else's trademark.
 */
export const STORE_BADGES = {
  apple: "/images/badge-app-store.svg" as string | null,
  google: "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" as string | null,
};
