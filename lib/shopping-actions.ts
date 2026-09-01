"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  revalidatePath(`/host/g/${gatheringId}`);
}

function fail(error: { message?: string } | null): ActionResult {
  const raw = error?.message ?? "";
  if (raw.includes("not_authorized")) return { ok: false, message: "You don’t have access to change that." };
  if (raw.includes("shopping_item_not_found")) return { ok: false, message: "That item is no longer on the list." };
  if (raw.includes("provider_required")) return { ok: false, message: "Add the rental or service provider first." };
  if (raw.includes("assignee_")) return { ok: false, message: "That person can’t be assigned to this gathering." };
  return { ok: false, message: "That didn’t save. Please try again." };
}

export async function addCanonicalShoppingItemWeb(gatheringId: string, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the item a name." };
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const costRaw = String(formData.get("estimated_cost") ?? "").trim();
  const quantity = quantityRaw ? Number(quantityRaw) : null;
  const estimatedCost = costRaw ? Number(costRaw) : null;
  if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) return { ok: false, message: "Enter a valid quantity." };
  if (estimatedCost !== null && (!Number.isFinite(estimatedCost) || estimatedCost < 0)) return { ok: false, message: "Enter a valid estimated cost." };

  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_add_item", {
    p_gathering_id: gatheringId,
    p_name: name,
    p_category: String(formData.get("category") ?? "").trim() || "Other",
    p_quantity: quantity,
    p_unit: String(formData.get("unit") ?? "").trim() || null,
    p_estimated_cost: estimatedCost,
    p_linked_menu_item_id: null,
    p_source: "web",
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function setCanonicalShoppingStatusWeb(gatheringId: string, itemId: string, status: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_set_status", {
    p_gathering_id: gatheringId,
    p_shopping_item_id: itemId,
    p_status: status,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function deleteCanonicalShoppingItemWeb(gatheringId: string, itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_delete_item", {
    p_gathering_id: gatheringId,
    p_shopping_item_id: itemId,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function seedCanonicalShoppingWeb(gatheringId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_seed_from_last_plan", { p_gathering_id: gatheringId });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function assignCanonicalBorrowWeb(
  gatheringId: string,
  itemId: string,
  assigneeType: "guest" | "co_host",
  assigneeId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_assign_borrow", {
    p_gathering_id: gatheringId,
    p_shopping_item_id: itemId,
    p_assignee_type: assigneeType,
    p_guest_id: assigneeType === "guest" ? assigneeId : null,
    p_gathering_member_id: assigneeType === "co_host" ? assigneeId : null,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function setCanonicalProviderWeb(
  gatheringId: string,
  itemId: string,
  status: "rent" | "hire",
  provider: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_set_provider", {
    p_gathering_id: gatheringId,
    p_shopping_item_id: itemId,
    p_status: status,
    p_provider: provider,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function setCanonicalBorrowReturnedWeb(
  gatheringId: string,
  itemId: string,
  returned: boolean
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("shopping_set_returned", {
    p_gathering_id: gatheringId,
    p_shopping_item_id: itemId,
    p_returned: returned,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}
