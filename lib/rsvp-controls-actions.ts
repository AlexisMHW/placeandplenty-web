"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { friendlyRsvpError } from "@/lib/rsvp-controls-copy";

// Host RSVP controls. Every call runs as the signed-in host through the
// SECURITY DEFINER RPCs get_rsvp_controls / set_rsvp_controls /
// set_invitations_published, which re-check membership and lock the row.
// Nothing here bypasses RLS and nothing is written directly to gatherings.

export type RsvpControlsState = {
  open: boolean;
  reason: string | null;
  deadline: string | null;
  timezone: string | null;
  manualOverride: "open" | "closed" | null;
  status: string;
  invitationsPublished: boolean;
};

export type RsvpControlsResult =
  | { ok: true; state: RsvpControlsState }
  | { ok: false; message: string };

export type RsvpAction = "set_deadline" | "clear_deadline" | "reopen" | "close";

const friendly = friendlyRsvpError;

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/invitations`);
  revalidatePath(`/host/g/${gatheringId}/people`);
}

export async function getRsvpControlsWeb(gatheringId: string): Promise<RsvpControlsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_rsvp_controls", { p_gathering_id: gatheringId });
  if (error || !data) return { ok: false, message: friendly(error as { message?: string; status?: number } | null) };
  return { ok: true, state: data as RsvpControlsState };
}

export async function setRsvpControlsWeb(
  gatheringId: string,
  action: RsvpAction,
  deadlineDate?: string | null,
  deadlineTime?: string | null
): Promise<RsvpControlsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_rsvp_controls", {
    p_gathering_id: gatheringId,
    p_action: action,
    p_deadline_date: action === "set_deadline" ? deadlineDate || null : null,
    p_deadline_time: action === "set_deadline" ? deadlineTime || null : null,
  });
  if (error || !data) return { ok: false, message: friendly(error as { message?: string; status?: number } | null) };
  refresh(gatheringId);
  return { ok: true, state: data as RsvpControlsState };
}

export async function setInvitationsPublishedWeb(
  gatheringId: string,
  published: boolean
): Promise<RsvpControlsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_invitations_published", {
    p_gathering_id: gatheringId,
    p_published: published,
  });
  if (error || !data) return { ok: false, message: friendly(error as { message?: string; status?: number } | null) };
  refresh(gatheringId);
  return { ok: true, state: data as RsvpControlsState };
}
