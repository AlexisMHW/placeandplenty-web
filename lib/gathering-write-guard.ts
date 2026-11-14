// D2 (founder decision 2026-11-14): completed and cancelled gatherings are READ-ONLY with NO exceptions;
// archived stays read-only. This is the SERVER-SIDE gate for web server actions. It is deliberately
// independent of who is calling: an owner, a co-host with any capability level, or a direct caller of the
// action all hit the same check, so a co-host cannot edit indirectly what the owner cannot.
// Fails CLOSED: if the effective status cannot be read, the write is refused.
// Lifecycle operations (finish, cancel, gather again, archive/unarchive) are NOT routed through this guard.
// The database remains the final enforcer (RLS/RPC/trigger work is owned by the DB workstream); this is
// defense in depth so no web code path writes to a read-only gathering.
import { isReadOnlyStatus } from "./gathering-readonly.ts";

export const GATHERING_READ_ONLY_MESSAGE = "This gathering is finished or archived, so it can’t be changed.";
export const GATHERING_STATUS_UNKNOWN_MESSAGE = "We couldn’t confirm this gathering’s status, so nothing was changed. Please try again.";

export interface WriteBlock {
  ok: false;
  message: string;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

/** Returns a failure result when the gathering must not be written, or null when the write may proceed. */
export async function gatheringWriteBlock(supabase: RpcClient, gatheringId: string): Promise<WriteBlock | null> {
  if (!gatheringId) return { ok: false, message: GATHERING_STATUS_UNKNOWN_MESSAGE };
  let result: { data: unknown; error: { message?: string } | null };
  try {
    result = await supabase.rpc("effective_gathering_status", { p_gathering_id: gatheringId });
  } catch {
    return { ok: false, message: GATHERING_STATUS_UNKNOWN_MESSAGE };
  }
  const { data, error } = result;
  if (error || typeof data !== "string" || data === "") return { ok: false, message: GATHERING_STATUS_UNKNOWN_MESSAGE };
  if (isReadOnlyStatus(data)) return { ok: false, message: GATHERING_READ_ONLY_MESSAGE };
  return null;
}
