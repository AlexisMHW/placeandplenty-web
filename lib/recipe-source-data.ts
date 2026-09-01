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
  const [recipesResult, guests, coHosts] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, name, base_servings, source")
      .eq("owner_user_id", user.id)
      .order("name", { ascending: true }),
    getGatheringGuests(gatheringId),
    getCoHosts(gatheringId),
  ]);

  if (recipesResult.error) throw recipesResult.error;

  return {
    recipes: (recipesResult.data ?? []) as SavedRecipeOption[],
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
