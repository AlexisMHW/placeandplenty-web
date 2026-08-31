// THE CANONICAL INVITATION MODES, in one place, spelled the way the
// database spells them.
//
// `gatherings.invitation_mode` is a NOT NULL text column defaulting to
// 'details_only', and the only values it ever holds are the three below.
// Host Web compared it against `own_artwork`, which has never existed in
// any migration — so the branch that was meant to recognise a host's own
// artwork was dead, and every uploaded invitation was described with the
// generic copy.
//
// The lesson is the one this module encodes: a canonical enum value
// belongs in a named constant that can be grepped, not in a string
// literal typed from memory inside a JSX ternary.
//
// DO NOT CHANGE THE DATABASE VALUES to match old web copy. The column
// and its callers — set_invitation_mode(), the guest page projection in
// lib/guest-api.ts, and the native app — all agree on these three
// already. The web was the only thing that was wrong.

export const INVITATION_MODES = {
  /** A Place & Plenty invitation design. */
  PLACE_AND_PLENTY: "p_and_p",
  /** The host's own artwork, uploaded to the invitation-artwork bucket. */
  UPLOADED: "uploaded",
  /** No artwork — the details are the invitation. */
  DETAILS_ONLY: "details_only",
} as const;

export type InvitationMode =
  (typeof INVITATION_MODES)[keyof typeof INVITATION_MODES];

export function isInvitationMode(value: string): value is InvitationMode {
  return (Object.values(INVITATION_MODES) as string[]).includes(value);
}

/** True when the host brought their own invitation artwork. */
export function usesOwnArtwork(mode: string): boolean {
  return mode === INVITATION_MODES.UPLOADED;
}

/** How the host's chosen invitation approach is described back to them. */
export function invitationModeLabel(mode: string): string {
  switch (mode) {
    case INVITATION_MODES.UPLOADED:
      return "Your own artwork";
    case INVITATION_MODES.PLACE_AND_PLENTY:
      return "A Place & Plenty invitation";
    case INVITATION_MODES.DETAILS_ONLY:
      return "Just the details";
    default:
      return "Not chosen yet";
  }
}

/* ------------------------------------------------------------------ */
/* Where the gathering stands in the invitation process               */
/* ------------------------------------------------------------------ */

// `gatherings.invitation_status` is a separate column from
// `invitation_mode` and answers a different question: mode is HOW the
// host is inviting, status is WHERE THEY ARE. Both are set through
// SECURITY DEFINER RPCs (`set_invitation_mode`, `set_invitation_status`,
// `select_invitation_style`) rather than by updating the column, so the
// web never writes an invitation column directly.
//
// 'invited_elsewhere' specifically means the host said this was handled
// outside Place & Plenty. P&P then never fabricates sent/delivered/
// opened data it does not have for that gathering.

export const INVITATION_STATUSES = {
  NOT_STARTED: "not_started",
  INVITED_ELSEWHERE: "invited_elsewhere",
  IN_PROGRESS: "in_progress",
  SHARED: "shared",
} as const;

export type InvitationStatus =
  (typeof INVITATION_STATUSES)[keyof typeof INVITATION_STATUSES];

export function isInvitationStatus(value: string): value is InvitationStatus {
  return (Object.values(INVITATION_STATUSES) as string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* The six curated Simple P&P Invitation presets                      */
/* ------------------------------------------------------------------ */

/**
 * MIRRORED BY HAND, AND THAT IS THE ESTABLISHED ARRANGEMENT. This list
 * already exists three times — the native app's
 * features/invitations/services/invitationStyles.ts, the guest page's
 * own JS in guest-rsvp.html, and now here — because each runtime is
 * separate and none can import the others. The IDS are the contract:
 * `select_invitation_style()` stores the id and nothing else, and the
 * invitation is always rendered live from current gathering data, so a
 * later change of date or place is reflected everywhere by itself.
 *
 * If a style is ever added or changed, all three copies need the same
 * edit. Colours are the established P&P brand values, not new ones.
 */
export interface InvitationStyleConfig {
  id: string;
  label: string;
  background: string;
  textColor: string;
  accentColor: string;
  bordered: boolean;
}

export const INVITATION_STYLES: InvitationStyleConfig[] = [
  { id: "classic_green", label: "Classic Green", background: "#1E3A2E", textColor: "#F7F4EC", accentColor: "#C9A227", bordered: false },
  { id: "ivory_elegant", label: "Ivory Elegant", background: "#F7F4EC", textColor: "#142720", accentColor: "#C9A227", bordered: false },
  { id: "gold_accent", label: "Gold Accent", background: "#142720", textColor: "#F7F4EC", accentColor: "#C9A227", bordered: true },
  { id: "botanical_sage", label: "Botanical Sage", background: "#E8EDE4", textColor: "#1E3A2E", accentColor: "#1E3A2E", bordered: false },
  { id: "bold_block", label: "Bold Block", background: "#C9A227", textColor: "#142720", accentColor: "#F7F4EC", bordered: false },
  { id: "minimal_cream", label: "Minimal Cream", background: "#F7F4EC", textColor: "#1E3A2E", accentColor: "#1E3A2E", bordered: true },
];

export function isInvitationStyle(id: string): boolean {
  return INVITATION_STYLES.some((s) => s.id === id);
}

/* ------------------------------------------------------------------ */
/* The wizard's invitation question                                   */
/* ------------------------------------------------------------------ */

/**
 * Step 5 asks one question — "Have you invited your people yet?" — with
 * three answers, and only the middle one opens the three modes above.
 *
 *   already_invited  → invitation_status = 'invited_elsewhere'
 *   not_yet          → invitation_mode = the chosen mode,
 *                      invitation_status = 'in_progress'
 *   later            → nothing is written at all, so invitation_status
 *                      stays at its 'not_started' default, which is the
 *                      truthful record of a decision not yet made
 *
 * The third answer doing nothing is deliberate and must be preserved:
 * writing a mode for a host who explicitly deferred would invent a
 * choice they did not make.
 */
export type InvitationDecision = "already_invited" | "not_yet" | "later";

export function isInvitationDecision(
  value: string
): value is InvitationDecision {
  return value === "already_invited" || value === "not_yet" || value === "later";
}

/* ------------------------------------------------------------------ */
/* The host's own invitation artwork                                  */
/* ------------------------------------------------------------------ */

// ONE BUCKET, ONE PATH CONVENTION, ONE METADATA WRITE — the same ones
// the phone uses, because artwork uploaded on either surface has to be
// the same artwork.
//
// The bucket is PRIVATE and its RLS policies parse the FIRST PATH
// SEGMENT to decide who may write: `<gathering_id>/…`, accepted members
// of that gathering only. A path built any other way is rejected by
// Postgres, not by us, which is why `artworkObjectPath()` below is the
// only place a key is assembled.
//
// The metadata is NOT written by updating columns. `save_invitation_-
// artwork()` records the path, mime type and original filename and
// atomically sets `invitation_mode = 'uploaded'` in the same statement,
// so a gathering can never hold artwork while claiming another mode.
//
// THE BUCKET HAS NO UPDATE POLICY — only INSERT and DELETE. "Replacing"
// artwork therefore means uploading to a fresh key and pointing the
// gathering at it; overwriting in place is not a thing that can happen.

export const INVITATION_ARTWORK_BUCKET = "invitation-artwork";

/**
 * What the bucket itself accepts. Kept in step with the native picker's
 * allow-list — PDF is supported end to end and must not be quietly
 * dropped here, since a host who bought a PDF invitation from a designer
 * is exactly the person this feature is for.
 */
export const ALLOWED_ARTWORK_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

/**
 * The bucket's own `file_size_limit`, mirrored so the host is told
 * before a ten-megabyte upload rather than after it. This is not a
 * web-side policy — it is the same number, checked earlier.
 */
export const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

/** A PDF is real artwork, and cannot be put in an <img>. */
export function isRenderableArtwork(mimeType: string | null): boolean {
  return !!mimeType && mimeType !== "application/pdf";
}

/**
 * The one honest answer for a file the bucket would refuse, or null when
 * there is nothing wrong with it.
 */
export function artworkRejectionReason(file: {
  type: string;
  size: number;
}): string | null {
  if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "That needs to be a JPG, a PNG or a PDF.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_ARTWORK_BYTES) {
    return "That file is larger than 10MB. A smaller export usually looks identical.";
  }
  return null;
}

/**
 * The storage key for one upload.
 *
 * THE FIRST SEGMENT MUST BE THE GATHERING ID — the storage policy reads
 * it to decide access, so this is a correctness rule and not a
 * convention. The rest is unique per upload because the bucket has no
 * UPDATE policy: a second upload is a new object, never an overwrite.
 *
 * The name is reduced to characters that are unambiguous in a storage
 * key. The host's real filename is not lost — it is stored alongside, as
 * `original_filename`, which is what both surfaces display.
 */
export function artworkObjectPath(
  gatheringId: string,
  filename: string,
  uniqueId: string
): string {
  const safe =
    filename
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(-80) || "invitation";

  return `${gatheringId}/${uniqueId}-${safe}`;
}
