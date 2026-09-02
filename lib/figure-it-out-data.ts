import { createClient } from "@/lib/supabase-server";

export interface FigureItOutOverviewState {
  dietaryNotes: string;
  accessibilityNotes: string;
  hasPlan: boolean;
  readOnly: boolean;
}

export async function getFigureItOutOverviewState(
  gatheringId: string
): Promise<FigureItOutOverviewState> {
  const supabase = createClient();
  const [{ data: gathering, error: gatheringError }, { data: status, error: statusError }] =
    await Promise.all([
      supabase
        .from("gatherings")
        .select("dietary_notes,accessibility_notes,last_plan_input_hash")
        .eq("id", gatheringId)
        .maybeSingle(),
      supabase.rpc("effective_gathering_status", { p_gathering_id: gatheringId }),
    ]);

  if (gatheringError || statusError || !gathering) {
    return {
      dietaryNotes: "",
      accessibilityNotes: "",
      hasPlan: false,
      readOnly: true,
    };
  }

  return {
    dietaryNotes: gathering.dietary_notes ?? "",
    accessibilityNotes: gathering.accessibility_notes ?? "",
    hasPlan: Boolean(gathering.last_plan_input_hash),
    readOnly: ["completed", "cancelled", "archived"].includes(String(status)),
  };
}
