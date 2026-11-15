// Pure helpers for the gathering-wide invitation link (/i/[token]).
// Kept free of network and React so they can be unit tested.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShareToken(value: string): boolean {
  return UUID.test(value);
}

/** Formats a YYYY-MM-DD date without timezone drift. */
export function formatShareDate(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShareTime(time: string | null | undefined): string | null {
  if (!time || !/^\d{2}:\d{2}/.test(time)) return null;
  const [h, min] = time.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * Text for link previews. Deliberately contains the date and time only:
 * never the location, even when the page shows it, and never anything
 * about guests. A preview is copied into group chats and social apps.
 */
export function buildPreviewDescription(input: {
  hostDisplayName?: string | null;
  displayDate?: string | null;
  displayTime?: string | null;
}): string {
  const when = [formatShareDate(input.displayDate), formatShareTime(input.displayTime)].filter(Boolean).join(" at ");
  const host = input.hostDisplayName?.trim();
  const parts = [host ? `${host} invited you.` : "You're invited.", when ? `${when}.` : null, "Open for details and to RSVP."];
  return parts.filter(Boolean).join(" ");
}

/**
 * The preview image is fetched server-side. Only fetch it if it is on
 * our own Supabase storage host and over https, so the route can never
 * be turned into a way to make the server fetch arbitrary URLs.
 */
export function isTrustedArtworkUrl(url: string, supabaseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    return u.protocol === "https:" && u.host === base.host;
  } catch {
    return false;
  }
}

export const PREVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PREVIEW_MAX_BYTES = 8 * 1024 * 1024;
