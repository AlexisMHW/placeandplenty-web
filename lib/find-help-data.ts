import { createClient } from "@/lib/supabase-server";

/**
 * Find Help only needs the gathering's weather city as a suggested search
 * area. It deliberately does NOT reuse location_name: that field may be a
 * private street address or "my house" and should never be silently sent to
 * an external maps search.
 */
export async function getFindHelpContext(gatheringId: string): Promise<{
  weatherCity: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gatherings")
    .select("weather_city")
    .eq("id", gatheringId)
    .maybeSingle();
  if (error) throw error;
  return { weatherCity: data?.weather_city ?? null };
}
