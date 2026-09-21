"use server";

import { createClient } from "@/lib/supabase-server";
import type { GuestLivingResult } from "@/lib/guest-living-api";

export async function acknowledgeGuestUpdate(
  token: string,
  updateId: string
): Promise<GuestLivingResult<{ acknowledgedAt: string }>> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("guest-update-acknowledge", {
    method: "POST",
    body: { token, updateId },
  });

  if (error) {
    const status =
      (error as unknown as { context?: { status?: number } }).context?.status ?? 500;
    return { ok: false, status, data: null };
  }

  return {
    ok: true,
    status: 200,
    data: (data ?? null) as { acknowledgedAt: string } | null,
  };
}
