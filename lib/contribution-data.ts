import { createClient } from "@/lib/supabase-server";

export interface ContributionWorkspaceRow {
  id: string;
  item_name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  status: string;
  contributor_type: string;
  gathering_member_id: string | null;
  guest_id: string | null;
  invitation_party_id: string | null;
  host_must_supply_if_unfulfilled: boolean;
  linked_menu_item_id: string | null;
  linked_shopping_item_id: string | null;
  notes: string | null;
  assigned_at: string | null;
  responded_at: string | null;
  needs_host_attention: boolean;
  attention_reason: string | null;
}

export interface ContributionMessageRow {
  id: string;
  contribution_id: string;
  sender_type: "host" | "co_host" | "guest";
  message: string;
  created_at: string;
}

/**
 * Who's Bringing What reads the canonical contribution row directly.
 * Menu/Shopping links are provenance only: this surface never duplicates
 * those records or invents a second assignment model.
 */
export async function getContributionWorkspace(
  gatheringId: string
): Promise<ContributionWorkspaceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contributions")
    .select(
      "id, item_name, category, quantity, unit, status, contributor_type, gathering_member_id, guest_id, invitation_party_id, host_must_supply_if_unfulfilled, linked_menu_item_id, linked_shopping_item_id, notes, assigned_at, responded_at, needs_host_attention, attention_reason"
    )
    .eq("gathering_id", gatheringId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContributionWorkspaceRow[];
}

/**
 * Guest replies are append-only history, not contribution.notes. Reading
 * them separately preserves every "I can bring X instead" message and
 * matches the native service contract.
 */
export async function getContributionMessages(
  gatheringId: string
): Promise<ContributionMessageRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contribution_messages")
    .select("id, contribution_id, sender_type, message, created_at")
    .eq("gathering_id", gatheringId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContributionMessageRow[];
}
