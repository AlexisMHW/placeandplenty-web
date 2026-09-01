"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

// Phase 3 lifecycle convergence.
//
// This file deliberately contains NO lifecycle rules, entitlement counts,
// date arithmetic, or status derivation. Host Web calls the same canonical
// RPCs as native and lets Postgres decide whether the transition is allowed.
// The browser is only an interface to the existing authority.

export type LifecycleActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type LifecycleValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function lifecycleMessage(error: { message?: string } | null): string {
  const raw = error?.message ?? "";

  if (raw.includes("not_authorized")) {
    return "Only the gathering owner can do that.";
  }
  if (raw.includes("gathering_not_started")) {
    return "This gathering has not started yet.";
  }
  if (raw.includes("gathering_lifecycle_completed")) {
    return "This gathering is part of your finished history and can’t be restored. Use Gather Again instead.";
  }
  if (raw.includes("free_open_gathering_limit_reached")) {
    return "Free includes one open gathering at a time. Close the current one before restoring this gathering.";
  }
  if (raw.includes("plus_open_gathering_limit_reached")) {
    return "Plus includes up to 6 open gatherings at one time. Finish, archive, or cancel one before restoring this gathering.";
  }
  if (raw.includes("gather_again_source_not_locked_in")) {
    return "An unfinished draft should be resumed instead of gathered again.";
  }
  if (raw.includes("gather_again_schedule_required")) {
    return "Choose the new date and arrival time.";
  }
  if (raw.includes("gather_again_schedule_must_be_future")) {
    return "Choose a future date and arrival time.";
  }
  if (raw.includes("gathering_cannot_be_cancelled")) {
    return "This gathering can no longer be cancelled from this stage.";
  }
  return "That change didn’t go through. Please try again.";
}

function refreshGathering(gatheringId: string): void {
  revalidatePath("/host");
  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath(`/host/g/${gatheringId}/settings`);
}

export async function archiveGathering(
  gatheringId: string
): Promise<LifecycleActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("archive_gathering", {
    p_gathering_id: gatheringId,
  });
  if (error) return { ok: false, message: lifecycleMessage(error) };
  refreshGathering(gatheringId);
  return { ok: true };
}

export async function restoreGathering(
  gatheringId: string
): Promise<LifecycleActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("unarchive_gathering", {
    p_gathering_id: gatheringId,
  });
  if (error) return { ok: false, message: lifecycleMessage(error) };
  refreshGathering(gatheringId);
  return { ok: true };
}

export async function finishGathering(
  gatheringId: string
): Promise<LifecycleActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_gathering_complete", {
    p_gathering_id: gatheringId,
  });
  if (error) return { ok: false, message: lifecycleMessage(error) };
  refreshGathering(gatheringId);
  return { ok: true };
}

export async function cancelGathering(
  gatheringId: string,
  message: string
): Promise<LifecycleActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_gathering", {
    p_gathering_id: gatheringId,
    p_cancellation_message: message.trim(),
  });
  if (error) return { ok: false, message: lifecycleMessage(error) };
  refreshGathering(gatheringId);
  return { ok: true };
}

export async function gatherAgain(
  sourceGatheringId: string,
  date: string,
  arrivalTime: string
): Promise<LifecycleValueResult<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("gather_again", {
    p_source_gathering_id: sourceGatheringId,
    p_gathering_date: date,
    p_arrival_time: arrivalTime,
  });
  if (error) return { ok: false, message: lifecycleMessage(error) };
  if (!data) return { ok: false, message: "The new draft wasn’t created. Please try again." };

  revalidatePath("/host");
  return { ok: true, value: data as string };
}
