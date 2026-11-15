// D4: one client rule for read-only gatherings. Terminal lifecycle states are read-only on web today
// (music, style, co-hosts, invitations, find-help, figure-it-out, weather); this centralises that rule.
// Always pass the EFFECTIVE status (time-derived), never the raw stored status.
// The ONLY planning exception (founder decision B) is photo upload/management on a COMPLETED gathering inside the existing photo-sharing window
// (lib/gathering-photo-window.ts and the photo write guard in lib/gathering-write-guard.ts). Lifecycle operations (archive/unarchive, "gather again", co-host leave) are not edits.
export const READ_ONLY_STATES = ["completed", "cancelled", "archived"] as const;

export function isReadOnlyStatus(effectiveStatus: unknown): boolean {
  return (READ_ONLY_STATES as readonly string[]).includes(String(effectiveStatus ?? ""));
}
