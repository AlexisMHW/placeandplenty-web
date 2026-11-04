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
  guestSafetyNotes: Array<{ category: "allergy" | "dietary"; note: string }>;

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
  const [itemsResult, gatheringResult, guestResult] = await Promise.all([
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
    supabase
      .from("gathering_guests")
      .select("rsvp_status, guest_dietary_notes, guest_allergy_notes, guest:guests(dietary_notes, allergy_notes)")
      .eq("gathering_id", gatheringId)
      .or("rsvp_status.is.null,rsvp_status.neq.no"),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (gatheringResult.error) throw gatheringResult.error;
  if (guestResult.error) throw guestResult.error;

  const guestSafetyNotes: MenuContext["guestSafetyNotes"] = [];
  const seen = new Set<string>();
  for (const row of guestResult.data ?? []) {
    const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;
    for (const [category, value] of [
      ["allergy", row.guest_allergy_notes],
      ["allergy", guest?.allergy_notes],
      ["dietary", row.guest_dietary_notes],
      ["dietary", guest?.dietary_notes],
    ] as const) {
      const note = typeof value === "string" ? value.trim() : "";
      const key = `${category}:${note.toLowerCase()}`;
      if (!note || seen.has(key)) continue;
      seen.add(key);
      guestSafetyNotes.push({ category, note });
    }
  }

  return {
    items: (itemsResult.data ?? []) as WebMenuItem[],
    context: { ...(gatheringResult.data as Omit<MenuContext, "guestSafetyNotes">), guestSafetyNotes },
  };
}
