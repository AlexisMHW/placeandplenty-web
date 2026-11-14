import { createClient } from "@/lib/supabase-server";
import {
  isMissingRpc,
  LEGACY_ALL_CAPABILITIES,
  normalizeLevel,
  parseMyCapabilities,
  type CoHostPermissionLevel,
  type MyCapabilities,
} from "@/lib/cohost-permissions";

export interface CoHostWorkspaceMember {
  id: string;
  gathering_id: string;
  user_id: string | null;
  invited_email: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  removed_at: string | null;
  /** Present only for the owner's list on a backend that has permission levels. */
  permission_level?: CoHostPermissionLevel | null;
}

/**
 * One safe shared read for My Co-Hosts. The RPC validates accepted
 * gathering membership and deliberately excludes invitation credentials.
 */
export async function getCoHostWorkspace(gatheringId: string): Promise<CoHostWorkspaceMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_gathering_members_shared", {
    p_gathering_id: gatheringId,
  });
  if (error) throw error;
  return (data ?? []) as CoHostWorkspaceMember[];
}

/**
 * Owner-only list that includes each person's level. A backend without permission levels (or a non-owner) falls back
 * to the shared list, with levels left undefined.
 */
export async function getCoHostWorkspaceWithLevels(gatheringId: string): Promise<CoHostWorkspaceMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_gathering_members_with_permissions", {
    p_gathering_id: gatheringId,
  });
  if (error) {
    if (isMissingRpc(error) || error.code === "P0001") return getCoHostWorkspace(gatheringId);
    throw error;
  }
  return ((data ?? []) as CoHostWorkspaceMember[]).map((m) => ({ ...m, permission_level: normalizeLevel(m.permission_level) }));
}

/** What the signed-in person may do here. Backend missing or call failed -> legacy "everything" (known=false). */
export async function getMyCapabilities(gatheringId: string): Promise<MyCapabilities> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_gathering_capabilities", { p_gathering_id: gatheringId });
  if (error) return LEGACY_ALL_CAPABILITIES;
  return parseMyCapabilities(data);
}
