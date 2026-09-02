import { createClient } from "@/lib/supabase-server";

/**
 * Creation is only for a true draft that has not already become a real
 * planning workspace. Once feature data exists, the gathering itself is
 * the canonical place to continue — sending it back through creation can
 * overwrite setup answers that were already settled on another platform.
 */
export async function hasEstablishedPlanningData(
  gatheringId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "gathering_has_established_planning_data",
    { p_gathering_id: gatheringId }
  );

  // Fail closed: if the guard cannot be evaluated, do not send an existing
  // gathering through creation. The workspace is the non-destructive path.
  if (error) return true;
  return data === true;
}
