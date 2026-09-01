import { createClient } from "@/lib/supabase-server";

export interface CoHostWorkspaceMember {
  id: string;
  gathering_id: string;
  user_id: string | null;
  invited_email: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  removed_at: string | null;
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
