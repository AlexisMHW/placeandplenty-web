import { createClient } from "@/lib/supabase-server";
import type { GuestLivingData, GuestLivingResult } from "@/lib/guest-living-api";

export async function lookupGuestLivingPage(
  token: string
): Promise<GuestLivingResult<GuestLivingData>> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("guest-living-page-lookup", {
    method: "POST",
    body: { token },
  });

  if (error) {
    const status =
      (error as unknown as { context?: { status?: number } }).context?.status ?? 500;
    return { ok: false, status, data: null };
  }

  return { ok: true, status: 200, data: (data ?? null) as GuestLivingData | null };
}
