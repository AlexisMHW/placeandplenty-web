import type { SupabaseClient } from "@supabase/supabase-js";
export class CanvaControlError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export function requireCanvaQuota(
  result: { status?: string; retry_after?: number } | null,
) {
  if (result?.status === "rate_limited")
    throw new CanvaControlError(
      429,
      "Please wait before trying again",
      Math.max(1, Math.min(3600, Math.ceil(Number(result.retry_after) || 60))),
    );
}
export async function checkCanvaGatheringQuota(client: SupabaseClient) {
  const { data, error } = await client.rpc("check_canva_gathering_quota");
  if (error || !data)
    throw new CanvaControlError(503, "Gatherings unavailable");
  requireCanvaQuota(data);
  if (data.status !== "allowed")
    throw new CanvaControlError(503, "Gatherings unavailable");
}
