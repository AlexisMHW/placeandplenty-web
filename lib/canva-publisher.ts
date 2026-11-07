// Injected dependencies let tests exercise authorization and failure ordering.
import { INVITATION_ARTWORK_BUCKET, MAX_ARTWORK_BYTES } from "./invitations.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { CanvaControlError, requireCanvaQuota } from "./canva-controls.ts";
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
// Check chunk integrity without inflating untrusted compressed image data.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
export function validatePng(bytes: Uint8Array) {
  const invalid = () => {
    throw new Error("Invalid invitation PNG");
  };
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 57 ||
    bytes.length > MAX_ARTWORK_BYTES ||
    !signature.every((b, i) => bytes[i] === b)
  )
    invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8,
    hasData = false,
    dataEnded = false,
    hasPalette = false;
  let color = -1;
  while (offset < bytes.length) {
    if (bytes.length - offset < 12) invalid();
    const length = view.getUint32(offset);
    if (length > bytes.length - offset - 12) invalid();
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString(
      "latin1",
    );
    if (!/^[A-Za-z]{4}$/.test(type) || bytes[offset + 6] & 32) invalid();
    const end = offset + 8 + length;
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end; i++)
      crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end)) invalid();
    if (offset === 8) {
      if (type !== "IHDR" || length !== 13) invalid();
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
      color = bytes[25];
      const depths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        !depths[color]?.includes(bytes[24]) ||
        bytes[26] !== 0 ||
        bytes[27] !== 0 ||
        bytes[28] > 1
      )
        invalid();
    } else if (type === "IHDR") invalid();
    else if (type === "PLTE") {
      if (
        hasPalette ||
        hasData ||
        color === 0 ||
        color === 4 ||
        !length ||
        length % 3 ||
        length > 768 ||
        (color === 3 && length / 3 > 2 ** bytes[24])
      )
        invalid();
      hasPalette = true;
    } else if (type === "IDAT") {
      if (dataEnded || (color === 3 && !hasPalette)) invalid();
      if (length) hasData = true;
    } else if (type === "IEND") {
      if (length || !hasData || end + 4 !== bytes.length) invalid();
      return;
    } else if (!(bytes[offset + 4] & 32)) invalid();
    if (hasData && type !== "IDAT") dataEnded = true;
    offset = end + 4;
  }
  invalid();
}
export async function persistCanvaArtwork(
  client: SupabaseClient,
  gatheringId: string,
  bytes: Uint8Array,
  requestId: string,
) {
  if (!isGatheringId(gatheringId) || !isGatheringId(requestId))
    throw new Error("Invalid gathering");
  // Read the existing lifecycle RPC as the host. Never use a service role.
  const { data: row, error: readError } = await client
    .rpc("list_my_gatherings_with_lifecycle")
    .eq("id", gatheringId)
    .maybeSingle();
  if (readError || !row || !eligibleGathering(row as Record<string, unknown>))
    throw new Error("Gathering unavailable");
  validatePng(bytes);
  const { data: claim, error: claimError } = await client.rpc(
    "begin_canva_publish",
    {
      p_request_id: requestId,
      p_gathering_id: gatheringId,
      p_content_hash: createHash("sha256").update(bytes).digest("hex"),
    },
  );
  if (claimError || !claim)
    throw new CanvaControlError(503, "Artwork save unavailable");
  requireCanvaQuota(claim);
  if (claim.status === "conflict")
    throw new CanvaControlError(
      409,
      "Select the gathering and confirm the invitation again",
    );
  if (claim.status === "in_progress")
    throw new CanvaControlError(
      409,
      "This invitation is still being saved. Check your gathering before retrying.",
      claim.retry_after,
    );
  const path = claim.path;
  if (
    typeof path !== "string" ||
    !path.startsWith(`${gatheringId}/`) ||
    !isGatheringId(path.slice(gatheringId.length + 1, -4)) ||
    !path.endsWith(".png")
  )
    throw new CanvaControlError(503, "Artwork save unavailable");
  if (claim.status === "completed") return { gatheringId, path };
  if (claim.status !== "claimed" || !isGatheringId(claim.lease_id))
    throw new CanvaControlError(503, "Artwork save unavailable");
  const lease = { p_request_id: requestId, p_lease_id: claim.lease_id };
  const bucket = client.storage.from(INVITATION_ARTWORK_BUCKET);
  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) {
    await client.rpc("abandon_canva_publish", lease);
    throw new Error("Artwork upload failed");
  }
  const { data: saved, error: saveError } = await client.rpc(
    "complete_canva_publish",
    lease,
  );
  if (saveError || saved?.status !== "completed" || saved.path !== path) {
    // Only a PostgreSQL rejection confirms rollback. Retain the object after an
    // ambiguous response: the canonical save may already have committed.
    if (saveError && /^[0-9A-Z]{5}$/.test(saveError.code || "")) {
      await bucket.remove([path]);
      await client.rpc("abandon_canva_publish", lease);
    }
    throw new CanvaControlError(
      503,
      "Save unconfirmed. Check your gathering before retrying.",
    );
  }
  return { gatheringId, path };
}
