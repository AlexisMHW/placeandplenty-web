"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

export interface SuggestedRecipeDraft {
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  instructions?: string;
  baseServings?: number;
}

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/table`);
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  revalidatePath(`/host/g/${gatheringId}`);
}

function fail(error: { message?: string } | null): ActionResult {
  const raw = error?.message ?? "";
  if (raw.includes("not_authorized")) return { ok: false, message: "You don’t have access to change that." };
  if (raw.includes("recipe_not_found")) return { ok: false, message: "That recipe is no longer available." };
  if (raw.includes("prepared_item_description_required")) return { ok: false, message: "Tell us what prepared item you’re using." };
  if (raw.includes("assignee_")) return { ok: false, message: "That person can’t be assigned to this gathering." };
  return { ok: false, message: "That didn’t save. Please try again." };
}

export async function applySavedRecipeSourceWeb(
  gatheringId: string,
  menuItemId: string,
  recipeId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_apply_recipe_source", {
    p_gathering_id: gatheringId,
    p_menu_item_id: menuItemId,
    p_recipe_source: "saved_recipe",
    p_recipe_id: recipeId,
    p_prepared_item_description: null,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function applyPreparedRecipeSourceWeb(
  gatheringId: string,
  menuItemId: string,
  description: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_apply_recipe_source", {
    p_gathering_id: gatheringId,
    p_menu_item_id: menuItemId,
    p_recipe_source: "prepared_item",
    p_recipe_id: null,
    p_prepared_item_description: description.trim(),
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function applySelfManagedRecipeSourceWeb(
  gatheringId: string,
  menuItemId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_apply_recipe_source", {
    p_gathering_id: gatheringId,
    p_menu_item_id: menuItemId,
    p_recipe_source: "self_managed",
    p_recipe_id: null,
    p_prepared_item_description: null,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function assignBringingRecipeSourceWeb(
  gatheringId: string,
  menuItemId: string,
  assigneeType: "guest" | "co_host",
  assigneeId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_assign_bringing_person", {
    p_gathering_id: gatheringId,
    p_menu_item_id: menuItemId,
    p_assignee_type: assigneeType,
    p_guest_id: assigneeType === "guest" ? assigneeId : null,
    p_gathering_member_id: assigneeType === "co_host" ? assigneeId : null,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function createRecipeAndApplyWeb(
  gatheringId: string,
  menuItemId: string,
  input: {
    name: string;
    baseServings: number;
    instructions?: string;
    ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  }
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_create_recipe_and_apply", {
    p_gathering_id: gatheringId,
    p_menu_item_id: menuItemId,
    p_name: input.name,
    p_base_servings: input.baseServings,
    p_source: "user",
    p_instructions: input.instructions ?? null,
    p_ingredients: input.ingredients,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function suggestRecipeWeb(input: {
  gatheringId: string;
  dishName: string;
  targetServings: number;
  dietaryNeeds?: string[];
  accessibilityNeeds?: string[];
}): Promise<{ ok: true; value: SuggestedRecipeDraft } | { ok: false; message: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("suggest-recipe", {
    body: input,
  });
  if (error || !data) {
    return { ok: false, message: "We couldn’t suggest a recipe right now. Try again in a moment." };
  }
  return { ok: true, value: data as SuggestedRecipeDraft };
}

export async function approveSuggestedRecipeWeb(
  gatheringId: string,
  menuItemId: string,
  dishName: string,
  input: SuggestedRecipeDraft
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("menu_create_recipe_and_apply", {
    p_gathering_id: gatheringId,
    p_menu_item_id: menuItemId,
    p_name: dishName,
    p_base_servings: input.baseServings ?? 1,
    p_source: "ai_suggested",
    p_instructions: input.instructions ?? null,
    p_ingredients: input.ingredients,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}
