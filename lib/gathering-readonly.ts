// D4: one client rule for read-only gatherings. Terminal lifecycle states are read-only on web today
// (music, style, co-hosts, invitations, find-help, figure-it-out, weather); this centralises that rule.
// Always pass the EFFECTIVE status (time-derived), never the raw stored status.
// Exceptions (post-event photos, archive/unarchive, "gather again", co-host leave, RSVP after completion)
// are NOT decided; they remain per-screen until the owner confirms them (D4_READONLY_GATING_SPEC.md).
export const READ_ONLY_STATES = ["completed", "cancelled", "archived"] as const;

export function isReadOnlyStatus(effectiveStatus: unknown): boolean {
  return (READ_ONLY_STATES as readonly string[]).includes(String(effectiveStatus ?? ""));
}
