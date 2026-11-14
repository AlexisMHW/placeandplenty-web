// Pure decision logic for replacing / removing invitation artwork (P1-INV-02). No imports on purpose: it is
// unit-tested directly with node:test, and shared by the server actions. (Mirror of the native
// features/invitations/artworkService.ts rules; the two repos cannot share a module.)

export const MANAGE_INVITATIONS_CAPABILITY = "manage_invitations" as const;
export type GatheringRole = "owner" | "co_host" | "none";

/**
 * UI hint ONLY. The server (RPC can_manage_invitations) is the authority.
 * Owner: yes. Accepted co-host: yes while co-hosts are owner-equivalent (capabilities == null), and only with the
 * named capability once COHOST-PERMS supplies a capability list. Everyone else: no.
 */
export function canManageInvitationArtwork(
  role: GatheringRole,
  capabilities?: readonly string[] | null
): boolean {
  if (role === "owner") return true;
  if (role === "co_host") return capabilities == null || capabilities.includes(MANAGE_INVITATIONS_CAPABILITY);
  return false;
}

export type CleanupReason =
  | "ok"
  | "no_old_path"
  | "same_as_new"
  | "foreign_folder"
  | "still_referenced"
  | "check_unavailable";

/** May the previously stored object be deleted? `allowedByServer` is the RPC answer; null = unknown (older backend). */
export function decideCleanup(args: {
  gatheringId: string;
  oldPath: string | null | undefined;
  newPath?: string | null;
  allowedByServer: boolean | null;
}): { delete: boolean; reason: CleanupReason } {
  const { gatheringId, oldPath, newPath, allowedByServer } = args;
  if (!oldPath) return { delete: false, reason: "no_old_path" };
  if (newPath && newPath === oldPath) return { delete: false, reason: "same_as_new" };
  if (oldPath.split("/")[0] !== gatheringId) return { delete: false, reason: "foreign_folder" };
  if (allowedByServer === null) return { delete: false, reason: "check_unavailable" };
  if (!allowedByServer) return { delete: false, reason: "still_referenced" };
  return { delete: true, reason: "ok" };
}

export const ALREADY_SENT_NOTE =
  "Guests who already received an invitation won't see the new artwork unless you resend.";

export function artworkFailureMessage(error: { message?: string } | null | undefined, action: "replace" | "remove"): string {
  const m = (error?.message ?? "").toLowerCase();
  if (m.includes("not authorized") || m.includes("not_authorized") || m.includes("row-level security") || m.includes("permission denied")) {
    return "You don't have permission to change this invitation's artwork.";
  }
  return action === "remove"
    ? "Couldn't remove the artwork. It's still in place — please try again."
    : "That file didn't save. Your current artwork is unchanged.";
}
