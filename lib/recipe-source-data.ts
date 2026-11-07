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
    supabase.rpc("gathering_menu_guest_restrictions", { p_gathering_id: gatheringId }),
  ]);

  if (recipesResult.error) throw recipesResult.error;
  if (guestRestrictionsResult.error) throw guestRestrictionsResult.error;

  // This restricted RPC returns only applicable notes, never saved contact details.
  // It enforces gathering ownership or accepted co-host membership server-side.
  const dietaryNeeds = new Set<string>();
  const allergyNeeds = new Set<string>();
  for (const row of guestRestrictionsResult.data ?? []) {
    if (row.dietary_note) dietaryNeeds.add(row.dietary_note);
    if (row.allergy_note) allergyNeeds.add(row.allergy_note);
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
