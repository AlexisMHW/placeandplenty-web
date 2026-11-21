// Link-preview (Open Graph / Twitter card) text for invitation links: /invite/[token] (one household's link, used by email + text) and
// /i/[token] (the gathering-wide share link). Pure: no network, no React.
//
// A preview is copied into group chats and social apps and can be read by anyone the link is forwarded to, so it carries only what a guest
// needs to RECOGNISE the invitation: the host's name, the gathering title and (when the host uploaded one) the invitation artwork.
// Never the address, the time of day, the host's private notes, guest names or anything about the household. When the gathering is
// completed, cancelled or archived, or the link is unknown / revoked, the preview is generic and does not name the gathering at all.
import { cleanHostName, cleanText } from "./share-by-text.ts";
import { formatShareDate } from "./share-invite.ts";

export const PREVIEW_TITLE_MAX = 70;
export const PREVIEW_CLOSED_STATUSES = ["completed", "cancelled", "archived"] as const;

export type InvitePreviewKind = "open" | "closed" | "unknown";

export interface InvitePreviewInput {
  /** False when the lookup failed, the token is unknown / revoked / disabled. */
  found: boolean;
  displayName?: string | null;
  hostDisplayName?: string | null;
  /** YYYY-MM-DD. Only the calendar date is ever used. */
  displayDate?: string | null;
  gatheringStatus?: string | null;
  isArchived?: boolean | null;
  /** Whether the host has uploaded artwork that the preview-image route may serve. */
  hasArtwork?: boolean;
}

export interface InvitePreview {
  kind: InvitePreviewKind;
  title: string;
  description: string;
  /** Serve the host's artwork (via our own image route) instead of the branded default image. */
  showArtwork: boolean;
}

function clip(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

export function isClosedStatus(status: string | null | undefined, isArchived?: boolean | null): boolean {
  return isArchived === true || (PREVIEW_CLOSED_STATUSES as readonly string[]).includes(String(status ?? "").toLowerCase());
}

export function buildInvitePreview(input: InvitePreviewInput): InvitePreview {
  if (!input.found) {
    return { kind: "unknown", title: "You're Invited", description: "A private invitation on Place & Plenty. Open the link you were sent.", showArtwork: false };
  }
  if (isClosedStatus(input.gatheringStatus, input.isArchived)) {
    return { kind: "closed", title: "Invitation on Place & Plenty", description: "This invitation is no longer open.", showArtwork: false };
  }
  const name = cleanText(input.displayName);
  const host = cleanHostName(input.hostDisplayName);
  const date = formatShareDate(input.displayDate);
  const opening = host ? `You have received an invitation from ${host} on Place & Plenty.` : "You have received an invitation on Place & Plenty.";
  return {
    kind: "open",
    title: name ? clip(name, PREVIEW_TITLE_MAX) : "You're Invited",
    description: [opening, date ? `${date}.` : null, "Open it to view the invitation and RSVP."].filter(Boolean).join(" "),
    showArtwork: input.hasArtwork === true,
  };
}
