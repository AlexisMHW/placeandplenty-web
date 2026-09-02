import { createClient } from "@/lib/supabase-server";

export type NextUpKey =
  | "overdue_critical"
  | "weather_risk"
  | "invite_people"
  | "confirm_rsvps"
  | "category_gap"
  | "review_host_mode"
  | "ready";

export type NextUpTarget =
  | "overview"
  | "hub"
  | "table"
  | "shopping"
  | "people"
  | "space_mode"
  | "host_mode";

export interface CanonicalNextUpAction {
  key: NextUpKey;
  target: NextUpTarget | null;
  count?: number;
  category?: string;
}

export async function getCanonicalNextUp(
  gatheringId: string
): Promise<CanonicalNextUpAction[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("next_up_compute", {
    p_gathering_id: gatheringId,
  });

  if (error) throw new Error(error.message);
  const result = (data ?? {}) as { actions?: unknown };
  if (!Array.isArray(result.actions)) return [];

  return result.actions.filter(
    (action): action is CanonicalNextUpAction =>
      !!action && typeof action === "object" && typeof action.key === "string"
  );
}
