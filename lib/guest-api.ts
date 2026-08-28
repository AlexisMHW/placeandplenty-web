// Client for the deployed Supabase Edge Functions backing the public
// guest pages. Publishable key only — never the service-role key.
// Base URL is derived from NEXT_PUBLIC_SUPABASE_URL so this file has
// no hardcoded project reference.
//
// Guest surfaces never touch Postgres and never call an RPC directly.
// Every action goes through a token-resolving Edge Function. If
// something is missing from these responses, the fix belongs in the
// Edge Function in the app repo — not in a workaround here.
//
// TWO DIFFERENT TOKENS, deliberately not interchangeable:
//   invitation_parties.public_token       -> /invite/[token]
//   gathering_guest_page.gallery_token    -> /gallery/[token]
// The gallery is separate so a host can share photos with someone who
// was never invited, and can revoke the gallery without breaking
// anyone's RSVP link. Do not conflate them.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

async function call<T>(
  path: string,
  body: Record<string, unknown>,
  init?: { cache?: RequestCache }
): Promise<ApiResult<T>> {
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    // Invitations render live. An edited invitation must never be served
    // from a frozen copy, or guest web and the app will disagree.
    cache: init?.cache ?? "no-store",
  });
  let data: T | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/* ------------------------------------------------------------------ */
/* Guest page                                                          */
/* ------------------------------------------------------------------ */

export type RsvpStatus = "invited" | "no_response" | "yes" | "maybe" | "no";

export interface PartyMember {
  gatheringGuestId: string;
  guestId: string;
  firstName: string;
  // The server returns guests.last_name, which is nullable.
  lastName: string | null;
  rsvpStatus: RsvpStatus;
  dietaryNotes: string | null;
  allergyNotes: string | null;
  accessibilityNotes: string | null;
}

/** An open item anyone in the gathering can pick up. */
export interface Contribution {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string | null;
  status: "needed" | "claimed" | "confirmed";
  claimedByThisParty: boolean;
  notes: string | null;
}

export interface ContributionMessage {
  id: string;
  senderType: "host" | "guest";
  message: string;
  createdAt: string;
}

/**
 * Something the host asked THIS party for by name. Different from an
 * open claim: it is already assigned, and the guest answers rather than
 * volunteers. The server returns these separately for that reason.
 */
export interface AssignedContribution {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string | null;
  status: "asked" | "confirmed" | "declined";
  assignedToName: string | null;
  assignedToGuestId: string | null;
  hostNote: string | null;
  fromMenu: boolean;
  fromShoppingList: boolean;
  messages: ContributionMessage[];
}

/**
 * A gift/registry link the host added. Read server-side through
 * guest-page-lookup only — the guest_registry_links RPC is revoked for
 * anon and authenticated, and must not be called from a browser.
 * Always present in the response; empty when the host has the registry
 * switched off, so a missing key never has to be guessed at.
 */
export interface RegistryLink {
  id: string;
  label: string;
  url: string;
  note: string | null;
}

export interface GuestPageData {
  partyName: string;
  plusOneAllowed: boolean;
  plusOneLimit: number;
  contactEmail: { has: boolean; masked: string | null };
  rsvpDeadline: string | null;
  invitationMode: "p_and_p" | "uploaded" | "details_only";
  invitationStyle: string | null;
  invitationArtwork: { url: string; mimeType: string } | null;
  displayName: string;
  hostDisplayName: string;
  displayDate: string;
  displayTime: string;
  displayLocation: string | null;
  displayDescription: string | null;
  showGiftsRegistry: boolean;
  registryLinks: RegistryLink[];
  showPotluck: boolean;
  showSongRequest: boolean;
  showPhotoContributions: boolean;
  showSchedule: boolean;
  contributions: Contribution[];
  assignedContributions: AssignedContribution[];
  gatheringStatus: string;
  isArchived: boolean;
  archivedMessage: string | null;
  cancellationMessage: string | null;
  partyMembers: PartyMember[];
}

export async function lookupGuestPage(token: string) {
  return call<GuestPageData>("guest-page-lookup", { token });
}

/**
 * Registry URLs are host-supplied free text. Anything that is not plain
 * http(s) is dropped rather than rendered — a `javascript:` href on a
 * page shown to a stranger's guests is not a risk worth carrying for a
 * gift link.
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* RSVP                                                                */
/* ------------------------------------------------------------------ */

export interface RsvpResponseInput {
  gatheringGuestId: string;
  status: "yes" | "maybe" | "no";
  dietaryNotes?: string;
  allergyNotes?: string;
  accessibilityNotes?: string;
}

export async function submitRsvp(
  token: string,
  responses: RsvpResponseInput[],
  plusOneName?: string,
  contactEmail?: string
) {
  return call<{ success: boolean }>("guest-rsvp-submit", {
    token,
    responses,
    ...(plusOneName ? { plusOneName } : {}),
    ...(contactEmail ? { contactEmail } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Contributions                                                       */
/* ------------------------------------------------------------------ */

/**
 * Claim or release an open contribution, at HOUSEHOLD level.
 *
 * We deliberately do NOT send gatheringGuestId. The server supports it
 * — it writes guest_id and nulls invitation_party_id — but
 * guest-page-lookup only marks a row `claimedByThisParty` when
 * invitation_party_id matches, and its open-items list excludes rows
 * belonging to this party by guest_id. So a per-guest claim made from
 * the web disappeared from the list on the very next refresh and could
 * never be released.
 *
 * A household claim round-trips correctly, and a household is one RSVP
 * unit anyway, so this is also the honest model for a guest page. If
 * per-person attribution is ever wanted here, the server projection has
 * to change first — do not paper over it on the client.
 */
export async function claimContribution(
  token: string,
  contributionId: string,
  action: "claim" | "release"
) {
  return call<{ success: boolean; reason?: string }>(
    "guest-contribution-claim",
    { token, contributionId, action }
  );
}

/** Answer a contribution the host assigned to this party by name. */
export async function respondToContribution(
  token: string,
  contributionId: string,
  action: "yes" | "no" | "message",
  message?: string
) {
  return call<{ success: boolean; status?: string }>(
    "guest-contribution-respond",
    { token, contributionId, action, ...(message ? { message } : {}) }
  );
}

/* ------------------------------------------------------------------ */
/* Song requests                                                       */
/* ------------------------------------------------------------------ */

export async function submitSongRequest(
  token: string,
  songTitle: string,
  artist?: string,
  gatheringGuestId?: string
) {
  return call<{ success: boolean }>("guest-song-request-submit", {
    token,
    songTitle,
    ...(artist ? { artist } : {}),
    ...(gatheringGuestId ? { gatheringGuestId } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Photo contributions                                                 */
/* ------------------------------------------------------------------ */

// Two steps by design: the function issues a one-time signed upload URL
// and the browser sends the bytes straight to storage, so image data
// never passes through the Edge Function.
//
// Contributing a photo grants NO right to browse the gallery. That is a
// separate capability behind a separate token. Never infer one from the
// other.

export interface PreparedUpload {
  storagePath: string;
  token: string;
  signedUrl: string;
}

export async function preparePhotoUpload(token: string) {
  return call<PreparedUpload>("guest-photo-upload", {
    token,
    action: "prepare",
  });
}

/** PUTs the bytes to the signed URL storage handed back from prepare. */
export async function uploadPhotoBytes(
  signedUrl: string,
  file: Blob
): Promise<boolean> {
  try {
    const res = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function registerPhoto(
  token: string,
  storagePath: string,
  caption?: string,
  gatheringGuestId?: string
) {
  return call<{ success: boolean }>("guest-photo-upload", {
    token,
    action: "register",
    storagePath,
    ...(caption ? { caption } : {}),
    ...(gatheringGuestId ? { gatheringGuestId } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Gallery — separate token, separate capability                       */
/* ------------------------------------------------------------------ */

export interface GalleryPhoto {
  id: string;
  url: string;
  caption: string | null;
}

export type GalleryResult =
  | { state: "ok"; gatheringName: string | null; expiresAt: string | null; photoCount: number; photos: GalleryPhoto[] }
  | { state: "expired"; gatheringName: string | null; expiresAt: string | null }
  | { state: "not_found" };

export async function lookupGallery(token: string) {
  return call<GalleryResult>("guest-gallery-lookup", { token });
}
