import { createClient, getUser } from "@/lib/supabase-server";
import { getCoHosts, getGatheringGuests } from "@/lib/host-data";

export interface SavedRecipeOption {
  id: string;
  name: string;
  base_servings: number | null;
  source: "user" | "ai_suggested";
}

export async function getRecipeSourceOptions(gatheringId: string) {
  const user = await getUser();
  if (!user) throw new Error("not_authenticated");

  const supabase = createClient();
  const [recipesResult, guests, coHosts, guestRestrictionsResult] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, name, base_servings, source")
      .eq("owner_user_id", user.id)
      .order("name", { ascending: true }),
    getGatheringGuests(gatheringId),
    getCoHosts(gatheringId),
    supabase.from("gathering_guests")
      .select("rsvp_status, guest_dietary_notes, guest_allergy_notes, guest:guests(dietary_notes, allergy_notes)")
      .eq("gathering_id", gatheringId),
  ]);

  if (recipesResult.error) throw recipesResult.error;
  if (guestRestrictionsResult.error) throw guestRestrictionsResult.error;

  // A gathering-specific note takes precedence over the reusable contact note.
  // Declined guests do not influence the active menu. Keep allergy notes
  // distinct from dietary preferences; neither is a safety certification.
  const dietaryNeeds = new Set<string>();
  const allergyNeeds = new Set<string>();
  for (const row of guestRestrictionsResult.data ?? []) {
    if (row.rsvp_status === "no") continue;
    const contact = Array.isArray(row.guest) ? row.guest[0] : row.guest;
    const dietary = row.guest_dietary_notes?.trim() || contact?.dietary_notes?.trim();
    const allergy = row.guest_allergy_notes?.trim() || contact?.allergy_notes?.trim();
    if (dietary) dietaryNeeds.add(dietary);
    if (allergy) allergyNeeds.add(allergy);
  }

  return {
    recipes: (recipesResult.data ?? []) as SavedRecipeOption[],
    dietaryNeeds: [...dietaryNeeds],
    allergyNeeds: [...allergyNeeds],
    guests: guests.map((row) => ({
      id: row.guest?.id ?? "",
      label: row.guest
        ? `${row.guest.first_name} ${row.guest.last_name ?? ""}`.trim()
        : "Guest",
    })).filter((row) => row.id),
    coHosts: coHosts
      .filter((row) => row.status === "accepted" && row.user_id)
      .map((row) => ({ id: row.id, label: row.invited_email })),
  };
}
