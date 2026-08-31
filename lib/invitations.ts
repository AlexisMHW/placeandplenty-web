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

// THIS IS THE WEB'S COPY OF features/invitations/services/
// invitationArtworkRules.ts IN THE NATIVE REPO, AND IT IS A COPY.
//
// That module was written to be import-free precisely so a single
// definition could serve both clients, and its header says the web
// "can import exactly this file rather than keeping a second copy."
// It cannot: the two clients are separate repositories with separate
// dependency graphs, and nothing here resolves a path into the app.
// Until the rules are published as a package both surfaces depend on,
// the honest description is two copies that must be kept identical by
// hand — so the values below are mirrored exactly, and the tests
// assert the behaviour rather than trusting the intention.
//
// KEEPING THEM THE SAME IS THE WHOLE REQUIREMENT. A file that uploads
// from the phone and is refused by the browser is the failure both
// files exist to prevent.

/** `ALLOWED_MIME_TYPES` in the native rules module. */
export const ALLOWED_ARTWORK_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

/** `ALLOWED_EXTENSIONS` in the native rules module. */
export const ALLOWED_ARTWORK_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
] as const;

/**
 * The `accept` value for the file input.
 *
 * BOTH MIME TYPES AND EXTENSIONS, because some desktop browsers filter
 * on one and some on the other — a picker that greys out a valid PDF is
 * the same refusal as a validator that rejects it, just earlier and with
 * no explanation. Mirrors `ACCEPT_ATTRIBUTE`.
 */
export const ARTWORK_ACCEPT_ATTRIBUTE = [
  ...ALLOWED_ARTWORK_MIME_TYPES,
  ...ALLOWED_ARTWORK_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

/**
 * Types that mean "I don't know", not "this is binary rubbish".
 *
 * Several Android document providers hand back a perfectly good PDF or
 * PNG labelled octet-stream, and browsers report an empty type for a
 * drag-and-dropped file or one with an unregistered extension. Native
 * resolves those by extension; before this, web did not — so the same
 * PDF was accepted on the phone and refused in the browser, which is
 * exactly the divergence the rules are supposed to rule out.
 */
const GENERIC_MIME_TYPES = ["", "application/octet-stream", "binary/octet-stream"];

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

/**
 * The type the file should actually be STORED as, or null when it is not
 * an accepted kind at all.
 *
 * Resolving rather than trusting matters after the upload as well as
 * before it: an octet-stream-labelled PNG stored under its reported type
 * downloads as a blob instead of rendering, so the gathering loses its
 * face on both surfaces. A genuinely disallowed type is never rescued by
 * a matching extension — only a *generic* label is resolved, so
 * `evil.exe` renamed `evil.png` still arrives as its real reported type
 * and is refused.
 */
export function resolveArtworkMimeType(
  mimeType: string | null | undefined,
  filename: string
): string | null {
  const reported = (mimeType ?? "").trim().toLowerCase();

  if ((ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(reported)) {
    return reported;
  }
  if (GENERIC_MIME_TYPES.includes(reported)) {
    return EXTENSION_MIME_TYPES[extensionOf(filename)] ?? null;
  }
  return null;
}

/**
 * The bucket's own `file_size_limit`, mirrored so the host is told
 * before a ten-megabyte upload rather than after it. This is not a
 * web-side policy — it is the same number, checked earlier.
 */
export const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

/**
 * WHAT THE HOST IS TOLD BEFORE THEY CHOOSE, on both surfaces, sitting
 * directly beneath the control that opens the file browser.
 *
 * It is a constant rather than a phrase typed into a component because
 * the two numbers in it are the two rules below, and a hint that drifts
 * from the rule it describes is worse than no hint: it teaches a host
 * something the upload will then contradict. The native side carries the
 * same sentence as `detail.invitations.uploadHint`.
 */
export const ARTWORK_LIMITS_HINT = "PDF, JPG or PNG · Max 10 MB";

/** A PDF is real artwork, and cannot be put in an <img>. */
export function isRenderableArtwork(mimeType: string | null): boolean {
  return !!mimeType && mimeType !== "application/pdf";
}

/**
 * THE THREE WAYS A FILE CAN BE REFUSED, named the way the native picker
 * names them (`InvitationFilePickerError`'s message is one of these) so
 * the two surfaces reject the same file for the same stated reason.
 *
 * They are distinct because "too big" and "wrong kind" are different
 * problems with different fixes, and a host told only "that file
 * didn't work" has to guess which one they have.
 */
export type ArtworkRejectionCode =
  | "unsupported_file_type"
  | "file_too_large"
  | "empty_file";

export const ARTWORK_REJECTION_MESSAGES: Record<ArtworkRejectionCode, string> =
  {
    unsupported_file_type:
      "That file type isn't supported. Use a PDF, JPG or PNG.",
    file_too_large: "That file is larger than 10 MB. Try a smaller export.",
    empty_file: "That file is empty. Choose another one.",
  };

/**
 * Why the bucket would refuse this file, or null when it would not.
 *
 * CHECKED BEFORE A SINGLE BYTE IS SENT. The bucket enforces both rules
 * itself and remains the authority — this exists so a host on a slow
 * connection is told in the moment they pick the file rather than after
 * watching ten megabytes upload into a rejection.
 */
export function artworkRejectionCode(file: {
  /** The browser's reported type, which is not always the real one. */
  type: string;
  size: number;
  /** Needed to resolve a generic type. Mirrors the native signature. */
  name?: string;
}): ArtworkRejectionCode | null {
  // Judged on the RESOLVED type, so the browser and the phone reach the
  // same verdict about the same file. Type before size, so a host with a
  // 30MB GIF is not sent off to shrink something they cannot use anyway.
  if (resolveArtworkMimeType(file.type, file.name ?? "") === null) {
    return "unsupported_file_type";
  }
  if (file.size <= 0) {
    return "empty_file";
  }
  if (file.size > MAX_ARTWORK_BYTES) {
    return "file_too_large";
  }
  return null;
}

/** The same answer, as the sentence the host actually reads. */
export function artworkRejectionReason(file: {
  type: string;
  size: number;
}): string | null {
  const code = artworkRejectionCode(file);
  return code ? ARTWORK_REJECTION_MESSAGES[code] : null;
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
