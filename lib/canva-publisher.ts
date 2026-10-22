// Injected dependencies let tests exercise authorization and failure ordering.
import {
  artworkObjectPath,
  INVITATION_ARTWORK_BUCKET,
  MAX_ARTWORK_BYTES,
} from "./invitations.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
export function isGatheringId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}
export function eligibleGathering(row: Record<string, unknown>): boolean {
  return (
    isGatheringId(row.id) &&
    ["draft", "active"].includes(String(row.effective_status)) &&
    ["single_day", "multi_day"].includes(String(row.duration_type))
  );
}
export function validatePng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    bytes.length > MAX_ARTWORK_BYTES ||
    !signature.every((b, i) => bytes[i] === b) ||
    Buffer.from(bytes.subarray(12, 16)).toString() !== "IHDR"
  )
    throw new Error("Invalid invitation PNG");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (
    !width ||
    !height ||
    width > 16384 ||
    height > 16384 ||
    width * height > 40000000
  )
    throw new Error("Invitation dimensions too large");
}
export async function persistCanvaArtwork(
  client: SupabaseClient,
  gatheringId: string,
  bytes: Uint8Array,
) {
  if (!isGatheringId(gatheringId)) throw new Error("Invalid gathering");
  // Read the existing lifecycle RPC as the host. Never use a service role.
  const { data: row, error: readError } = await client
    .rpc("list_my_gatherings_with_lifecycle")
    .eq("id", gatheringId)
    .maybeSingle();
  if (readError || !row || !eligibleGathering(row as Record<string, unknown>))
    throw new Error("Gathering unavailable");
  validatePng(bytes);
  const path = artworkObjectPath(
    gatheringId,
    "canva-invitation.png",
    randomUUID(),
  );
  const bucket = client.storage.from(INVITATION_ARTWORK_BUCKET);
  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) throw new Error("Artwork upload failed");
  const { error: saveError } = await client.rpc("save_invitation_artwork", {
    p_gathering_id: gatheringId,
    p_storage_path: path,
    p_mime_type: "image/png",
    p_original_filename: "canva-invitation.png",
  });
  if (saveError) {
    // Only the uncommitted new object is removed. Never delete existing artwork.
    await bucket.remove([path]);
    throw new Error("Artwork save failed");
  }
  // A retry can replace with a fresh key, as the existing native uploader does.
  // Do not claim cross-request idempotency; this needs staging concurrency QA.
  return { gatheringId, path };
}
