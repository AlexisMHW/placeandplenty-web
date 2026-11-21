import { cleanHostName } from "./share-by-text.ts";

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
 * Text for link previews (kept for callers that only have the display fields): the host, the calendar date and a call to action.
 * Deliberately NO time of day, never the location, never anything about guests. A preview is copied into group chats and social apps.
 * See lib/invite-preview.ts for the full rule set (closed / unknown links get a generic preview).
 */
export function buildPreviewDescription(input: {
  hostDisplayName?: string | null;
  displayDate?: string | null;
  displayTime?: string | null;
}): string {
  const host = cleanHostName(input.hostDisplayName);
  const date = formatShareDate(input.displayDate);
  const opening = host ? `You have received an invitation from ${host} on Place & Plenty.` : "You have received an invitation on Place & Plenty.";
  return [opening, date ? `${date}.` : null, "Open it to view the invitation and RSVP."].filter(Boolean).join(" ");
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
