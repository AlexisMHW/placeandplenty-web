// Safe cleanup of invitation-artwork storage objects when artwork is replaced or an upload half-fails.
//
// THE RULE (migration 207000, QA-INV-02): a file is deleted only when
// `invitation_artwork_cleanup_allowed(gathering, path)` returns exactly `true`, meaning the object sits in THIS
// gathering's own folder and no gathering row references it. Everything else (shared, Canva-owned, default or foreign
// objects, a missing function on an older schema, any error) is KEPT. Orphaned bytes are cheap; a deleted file that
// another gathering still shows is not.
//
// Replacement order is therefore: upload new -> save new (RPC) -> only then consider deleting the OLD object.
// If the save fails after the upload succeeded, the NEW object is unreferenced and is the one considered for cleanup.
// Native has an identical copy (features/invitations/services/invitationArtworkCleanup.ts); keep them in step.

export interface ArtworkCleanupClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from(bucket: string): {
      remove(paths: string[]): PromiseLike<{ error: unknown }>;
    };
  };
}

export type CleanupOutcome = "deleted" | "kept" | "skipped";

export async function cleanupArtworkObject(
  client: ArtworkCleanupClient,
  bucket: string,
  gatheringId: string,
  path: string | null | undefined
): Promise<CleanupOutcome> {
  if (!path) return "skipped";
  try {
    const { data, error } = await client.rpc("invitation_artwork_cleanup_allowed", {
      p_gathering_id: gatheringId,
      p_path: path,
    });
    if (error || data !== true) return "kept"; // fail closed: older schema, not permitted, or still referenced
    const { error: removeError } = await client.storage.from(bucket).remove([path]);
    return removeError ? "kept" : "deleted";
  } catch {
    return "kept";
  }
}
