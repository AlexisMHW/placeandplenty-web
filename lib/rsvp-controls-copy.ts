// Pure copy/mapping for host RSVP controls. Kept out of the "use server"
// module (which may only export async functions) so it can be unit-tested.
// Native counterpart: features/invitations/services/rsvpControlsService.ts.

export function friendlyRsvpError(error: { message?: string; status?: number } | null): string {
  const raw = error?.message ?? "";
  if (error?.status === 429 || raw.includes("rate_limited")) return "Too many changes in a short time. Please wait a moment and try again.";
  if (raw.includes("not_authorized")) return "You don’t have access to change RSVP settings for this gathering.";
  if (raw.includes("gathering_not_editable")) return "This gathering is finished or archived, so RSVP settings can’t be changed.";
  if (raw.includes("deadline_in_past")) return "Choose a deadline that is still in the future.";
  if (raw.includes("invalid_request")) return "Choose a deadline date first.";
  if (raw.includes("not_found")) return "We couldn’t find that gathering.";
  return "That didn’t save. Please try again.";
}
