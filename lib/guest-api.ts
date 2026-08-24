// Client for the deployed Supabase Edge Functions backing the public
// guest page. Anon-key only — never expose the service-role key here.
// Base URL is derived from NEXT_PUBLIC_SUPABASE_URL so this file has
// no hardcoded project reference.

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

async function call<T>(path: string, body: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
}> {
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  let data: T | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

export interface PartyMember {
  gatheringGuestId: string;
  guestId: string;
  firstName: string;
  lastName: string;
  rsvpStatus: "invited" | "no_response" | "yes" | "maybe" | "no";
  dietaryNotes: string | null;
  allergyNotes: string | null;
  accessibilityNotes: string | null;
}

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
  showPotluck: boolean;
  showSongRequest: boolean;
  showSchedule: boolean;
  contributions: Contribution[];
  gatheringStatus: string;
  isArchived: boolean;
  archivedMessage: string | null;
  cancellationMessage: string | null;
  partyMembers: PartyMember[];
}

export async function lookupGuestPage(token: string) {
  return call<GuestPageData>("guest-page-lookup", { token });
}

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

export async function claimContribution(
  token: string,
  contributionId: string,
  action: "claim" | "release",
  gatheringGuestId?: string
) {
  return call<{ success: boolean; reason?: string }>(
    "guest-contribution-claim",
    { token, contributionId, action, ...(gatheringGuestId ? { gatheringGuestId } : {}) }
  );
}

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
