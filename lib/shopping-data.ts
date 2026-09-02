import { createClient } from "@/lib/supabase-server";
import { getCoHosts, getGatheringGuests } from "@/lib/host-data";

export interface ShoppingWorkspaceItem {
  id: string;
  name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  source: string | null;
  linked_menu_item_id: string | null;
  returned_at: string | null;
  fulfillment_provider: string | null;
  covered_by_closet_item_id: string | null;
  covered_from_closet_quantity: number | null;
}

export interface ShoppingContribution {
  id: string;
  linked_shopping_item_id: string | null;
  guest_id: string | null;
  gathering_member_id: string | null;
  status: string;
}

export async function getShoppingWorkspace(gatheringId: string) {
  const supabase = createClient();
  const [itemsResult, contributionsResult, gatheringResult, guests, coHosts] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, category, quantity, unit, status, estimated_cost, actual_cost, source, linked_menu_item_id, returned_at, fulfillment_provider, covered_by_closet_item_id, covered_from_closet_quantity")
      .eq("gathering_id", gatheringId)
      .order("created_at", { ascending: true }),
    supabase
      .from("contributions")
      .select("id, linked_shopping_item_id, guest_id, gathering_member_id, status")
      .eq("gathering_id", gatheringId)
      .not("linked_shopping_item_id", "is", null),
    supabase
      .from("gatherings")
      .select("owner_user_id, last_plan_output")
      .eq("id", gatheringId)
      .single(),
    getGatheringGuests(gatheringId),
    getCoHosts(gatheringId),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (contributionsResult.error) throw contributionsResult.error;
  if (gatheringResult.error) throw gatheringResult.error;

  return {
    items: (itemsResult.data ?? []) as ShoppingWorkspaceItem[],
    contributions: (contributionsResult.data ?? []) as ShoppingContribution[],
    ownerUserId: gatheringResult.data.owner_user_id as string,
    lastPlanOutput: gatheringResult.data.last_plan_output as { shoppingItems?: Array<{ name?: string }> } | null,
    guests: guests.map((row) => ({
      id: row.guest?.id ?? "",
      label: row.guest
        ? `${row.guest.first_name} ${row.guest.last_name ?? ""}`.trim()
        : "Guest",
    })).filter((row) => row.id),
    coHosts: coHosts
      .filter((row) => row.status === "accepted")
      .map((row) => ({ id: row.id, label: row.invited_email })),
  };
}
