// D2 (founder, 2026-11-14): completed and cancelled gatherings follow production-intended lifecycle restrictions with NO new
// exceptions. For communications that means: no new invitations, no co-host invitations, no guest updates, no guest-page edits,
// no invitation artwork changes. Archived is read-only too (existing rule). The gate is ON by design (not behind a flag).
// FAIL CLOSED: if the effective status cannot be read, the action is refused rather than allowed.
import { isReadOnlyStatus } from "../gathering-readonly.ts";

export const READ_ONLY_COMMS_MESSAGE = "This gathering is finished, so invitations and guest updates can’t be changed.";
export interface StatusReader { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/** Returns null when the action may proceed, otherwise the user-facing refusal message. */
export async function commsReadOnlyBlock(db: StatusReader, gatheringId: string): Promise<string | null> {
  try {
    const { data, error } = await db.rpc("effective_gathering_status", { p_gathering_id: gatheringId });
    if (error || typeof data !== "string" || !data) return "We couldn’t confirm this gathering’s status, so that change wasn’t made. Please try again.";
    return isReadOnlyStatus(data) ? READ_ONLY_COMMS_MESSAGE : null;
  } catch {
    return "We couldn’t confirm this gathering’s status, so that change wasn’t made. Please try again.";
  }
}
