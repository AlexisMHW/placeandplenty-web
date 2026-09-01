"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

function message(error: { message?: string } | null): string {
  const raw = error?.message ?? "";
  if (raw.includes("gathering_archived_read_only")) return "This gathering is archived, so it can’t be changed.";
  if (raw.includes("not_authorized")) return "You don’t have access to change that.";
  if (raw.includes("invalid_menu_category")) return "Choose one of the menu categories shown.";
  if (raw.includes("menu_name_required")) return "Give the dish a name.";
  if (raw.includes("invalid_servings")) return "Enter a valid serving amount.";
  if (raw.includes("menu_item_not_found")) return "That dish is no longer on the table.";
  return "That didn’t save. Please try again.";
}

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/table`);
  revalidatePath(`/host/g/${gatheringId}`);
}

export async function addCanonicalMenuItemWeb(gatheringId: string, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_add_item", {
    p_gathering_id: gatheringId,
    p_name: name,
    p_category: category,
    p_notes: notes,
  });
  if (error) return { ok: false, message: message(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function setCanonicalMenuServingsWeb(
  gatheringId: string,
  itemId: string,
  servings: number
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_update_servings", {
    p_gathering_id: gatheringId,
    p_menu_item_id: itemId,
    p_servings: servings,
  });
  if (error) return { ok: false, message: message(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function deleteCanonicalMenuItemWeb(gatheringId: string, itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_delete_item", {
    p_gathering_id: gatheringId,
    p_menu_item_id: itemId,
  });
  if (error) return { ok: false, message: message(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function setCanonicalLeftoversWeb(
  gatheringId: string,
  preference: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_set_leftover_preference", {
    p_gathering_id: gatheringId,
    p_preference: preference,
  });
  if (error) return { ok: false, message: message(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function seedCanonicalMenuWeb(gatheringId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_seed_from_last_plan", {
    p_gathering_id: gatheringId,
  });
  if (error) return { ok: false, message: message(error) };
  refresh(gatheringId);
  return { ok: true };
}
