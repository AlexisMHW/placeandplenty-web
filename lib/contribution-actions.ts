"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

function failure(error: unknown): ActionResult {
  const message = String((error as { message?: string } | null)?.message ?? "");
  if (message.includes("gathering_archived_read_only")) {
    return { ok: false, message: "This gathering is archived, so it can't be changed." };
  }
  if (message.includes("not_authorized")) {
    return { ok: false, message: "You don't have access to change that." };
  }
  if (message.includes("assignee_not_in_gathering") || message.includes("assignee_not_accepted_cohost")) {
    return { ok: false, message: "That person is no longer available for this gathering." };
  }
  return { ok: false, message: "That assignment didn't save. Please try again." };
}

export async function setContributionAssignmentWeb(
  gatheringId: string,
  contributionId: string,
  value: string
): Promise<ActionResult> {
  let assignmentType = value;
  let guestId: string | null = null;
  let memberId: string | null = null;

  if (value.startsWith("guest:")) {
    assignmentType = "guest";
    guestId = value.slice(6);
  } else if (value.startsWith("cohost:")) {
    assignmentType = "co_host";
    memberId = value.slice(7);
  }

  if (!["unassigned", "owner", "guest", "co_host"].includes(assignmentType)) {
    return { ok: false, message: "Choose someone from this gathering." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("set_contribution_assignment", {
    p_gathering_id: gatheringId,
    p_contribution_id: contributionId,
    p_assignment_type: assignmentType,
    p_guest_id: guestId,
    p_gathering_member_id: memberId,
  });
  if (error) return failure(error);

  revalidatePath(`/host/g/${gatheringId}/contributions`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}
