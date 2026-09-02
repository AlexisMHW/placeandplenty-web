import { createClient } from "@/lib/supabase-server";

export interface GatheringCreationProgress {
  step: number;
  furthestStep: number;
}

function clampStep(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.round(n)));
}

/**
 * Reads the shared create-gathering wizard position from the canonical
 * gathering row. RLS is the ownership/permission boundary, exactly as it
 * is for every other host-web gathering read.
 */
export async function getGatheringCreationProgress(
  gatheringId: string
): Promise<GatheringCreationProgress> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gatherings")
    .select("creation_step, creation_furthest_step")
    .eq("id", gatheringId)
    .maybeSingle();

  if (error || !data) return { step: 1, furthestStep: 1 };

  const step = clampStep(data.creation_step);
  const furthestStep = Math.max(step, clampStep(data.creation_furthest_step));
  return { step, furthestStep };
}
