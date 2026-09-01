import { createClient } from "@/lib/supabase-server";

export interface WebMenuItem {
  id: string;
  name: string;
  category: string;
  servings_planned: number | null;
  servings_recommended: number | null;
  user_override: boolean;
  notes: string | null;
  recipe_source: string;
  recipe_id: string | null;
  prepared_item_description: string | null;
}

export interface MenuContext {
  leftover_preference: "just_enough" | "a_little_extra" | "send_home_with_plates" | null;
  dietary_notes: string | null;
  accessibility_notes: string | null;
  last_plan_output: { menuRecommendations?: Array<{ name?: string }> } | null;
}

export async function getMyTableData(gatheringId: string): Promise<{
  items: WebMenuItem[];
  context: MenuContext;
}> {
  const supabase = createClient();
  const [itemsResult, gatheringResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select(
        "id, name, category, servings_planned, servings_recommended, user_override, notes, recipe_source, recipe_id, prepared_item_description"
      )
      .eq("gathering_id", gatheringId)
      .order("created_at", { ascending: true }),
    supabase
      .from("gatherings")
      .select("leftover_preference, dietary_notes, accessibility_notes, last_plan_output")
      .eq("id", gatheringId)
      .single(),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (gatheringResult.error) throw gatheringResult.error;

  return {
    items: (itemsResult.data ?? []) as WebMenuItem[],
    context: gatheringResult.data as MenuContext,
  };
}
