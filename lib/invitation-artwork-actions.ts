"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { ALLOWED_ARTWORK_MIME_TYPES, INVITATION_ARTWORK_BUCKET } from "@/lib/invitations";
import { artworkFailureMessage, decideCleanup } from "@/lib/invitation-artwork-policy";

// Owner / accepted co-host artwork changes (P1-INV-02). Runs as the signed-in user; authorization is enforced in the
// database (RPCs call can_manage_invitations) and by storage RLS. Nothing here touches guest links, RSVP tokens, the
// guest list, responses or send records, and nothing writes the gatherings table directly.
//
// ORDER: reference changes FIRST (RPC), file deletion LAST and best-effort. A cleanup failure never fails the action.

type Result = { ok: true; oldFileRemoved: boolean } | { ok: false; message: string };

async function currentPath(gatheringId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("gatherings")
    .select("invitation_artwork_path")
    .eq("id", gatheringId)
    .maybeSingle();
  return (data as { invitation_artwork_path?: string | null } | null)?.invitation_artwork_path ?? null;
}

async function cleanupOld(gatheringId: string, oldPath: string | null, newPath: string | null): Promise<boolean> {
  try {
    if (!oldPath || oldPath === newPath || oldPath.split("/")[0] !== gatheringId) return false;
    const supabase = createClient();
    let allowed: boolean | null = null;
    try {
      const { data, error } = await supabase.rpc("invitation_artwork_cleanup_allowed", {
        p_gathering_id: gatheringId,
        p_path: oldPath,
      });
      allowed = error ? null : data === true;
    } catch {
      allowed = null;
    }
    if (!decideCleanup({ gatheringId, oldPath, newPath, allowedByServer: allowed }).delete) return false;
    const { error } = await supabase.storage.from(INVITATION_ARTWORK_BUCKET).remove([oldPath]);
    return !error;
  } catch {
    return false;
  }
}

/** The browser has already uploaded `storagePath`. Swap the reference, then best-effort delete the previous file. */
export async function replaceInvitationArtworkAction(
  gatheringId: string,
  storagePath: string,
  mimeType: string,
  originalFilename: string
): Promise<Result> {
  if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(mimeType) || storagePath.split("/")[0] !== gatheringId) {
    return { ok: false, message: "That file didn't save. Your current artwork is unchanged." };
  }
  const supabase = createClient();
  const oldPath = await currentPath(gatheringId);
  const { error } = await supabase.rpc("save_invitation_artwork", {
    p_gathering_id: gatheringId,
    p_storage_path: storagePath,
    p_mime_type: mimeType,
    p_original_filename: originalFilename.slice(0, 255) || null,
  });
  if (error) {
    // Reference unchanged: drop the unreferenced new upload so nothing dangles.
    try { await supabase.storage.from(INVITATION_ARTWORK_BUCKET).remove([storagePath]); } catch { /* best-effort */ }
    return { ok: false, message: artworkFailureMessage(error, "replace") };
  }
  const oldFileRemoved = await cleanupOld(gatheringId, oldPath, storagePath);
  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath(`/host/g/${gatheringId}/invitations`);
  revalidatePath("/host");
  return { ok: true, oldFileRemoved };
}

/** Clear the reference (restores the default Details Only presentation), then best-effort delete the file. */
export async function removeInvitationArtworkAction(gatheringId: string): Promise<Result> {
  const supabase = createClient();
  const oldPath = await currentPath(gatheringId);
  const { error } = await supabase.rpc("remove_invitation_artwork", { p_gathering_id: gatheringId });
  if (error) return { ok: false, message: artworkFailureMessage(error, "remove") };
  const oldFileRemoved = await cleanupOld(gatheringId, oldPath, null);
  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath(`/host/g/${gatheringId}/invitations`);
  revalidatePath("/host");
  return { ok: true, oldFileRemoved };
}
