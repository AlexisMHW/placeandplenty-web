// Store destinations for the app, and the one URL a QR code should ever
// encode.
//
// NOTHING HERE MAY BE A PLACEHOLDER. Founder instruction, 28 Aug 2026:
// no dead store links. A badge pointing at a listing that does not exist
// is worse than no badge — it reads as a live product, and the person who
// taps it lands on an App Store error.
//
// So both constants below are `null` until the real listings exist, and
// every download surface asks `hasAnyStoreLink()` before rendering an
// action. The layout is built and tested; only the links are withheld.
//
// TO GO LIVE: paste the two URLs in. That is the entire change — the
// badges, the QR code and the /get route all switch on by themselves, and
// the "not yet" copy disappears.
//
// WHY THE QR POINTS AT OUR OWN /get AND NOT AT A STORE.
//
// One QR cannot serve two stores, and a QR that resolves to whichever
// store the founder happened to pick sends half the people who scan it to
// the wrong place. /get reads the platform and forwards, so a single code
// works on both — and because the destination is ours, the printed or
// on-screen code never needs regenerating if a store URL changes.
//
// It is also deliberately NOT the homepage: someone scanning a code
// labelled "scan to download" has asked for the app, not for marketing.
//
// /get is deliberately absent from the AASA (which claims only /invite/*),
// so a phone that ALREADY has the app does not deep-link into it and
// swallow the download request.

/** The live App Store listing. Null until it exists. */
export const APP_STORE_URL: string | null = null;

/** The live Google Play listing. Null until it exists. */
export const PLAY_STORE_URL: string | null = null;

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
  apple: null as string | null, // e.g. "/images/badge-app-store.svg"
  google: null as string | null, // e.g. "/images/badge-google-play.png"
};
