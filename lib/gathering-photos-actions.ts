"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type PhotoActionResult = { ok: true } | { ok: false; message: string };

function photoError(raw: string): string {
  if (raw.includes("photo_gallery_read_only") || raw.includes("archived")) {
    return "This gallery is preserved now and no longer accepts changes.";
  }
  if (raw.includes("not_authorized")) return "You no longer have access to change this gallery.";
  return "That photo change didn't finish. Please try again.";
}

async function ensurePhotoEditable(gatheringId: string): Promise<PhotoActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("gathering_photo_workspace", { p_gathering_id: gatheringId });
  if (error) return { ok: false, message: photoError(error.message ?? "") };
  const workspace = (data ?? {}) as Record<string, unknown>;
  if (workspace.editable !== true) return { ok: false, message: "This gallery is preserved now and no longer accepts changes." };
  return { ok: true };
}

export async function uploadGatheringPhotoWeb(gatheringId: string, formData: FormData): Promise<PhotoActionResult> {
  const allowed = await ensurePhotoEditable(gatheringId);
  if (!allowed.ok) return allowed;

  const file = formData.get("photo");
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 300);
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo first." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "Keep each photo under 10 MB." };

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension) return { ok: false, message: "Use a JPG, PNG, or WebP image." };

  const supabase = createClient();
  const path = `${gatheringId}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("gathering-photos")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, message: photoError(uploadError.message ?? "") };

  const { error: rowError } = await supabase.rpc("add_gathering_photo", {
    p_gathering_id: gatheringId,
    p_storage_path: path,
    p_mime_type: file.type,
    p_caption: caption || null,
  });
  if (rowError) {
    await supabase.storage.from("gathering-photos").remove([path]);
    return { ok: false, message: photoError(rowError.message ?? "") };
  }

  revalidatePath(`/host/g/${gatheringId}/photos`);
  return { ok: true };
}

export async function setGatheringPhotoHiddenWeb(gatheringId: string, photoId: string, hidden: boolean): Promise<PhotoActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_gathering_photo_hidden", { p_photo_id: photoId, p_hidden: hidden });
  if (error) return { ok: false, message: photoError(error.message ?? "") };
  revalidatePath(`/host/g/${gatheringId}/photos`);
  return { ok: true };
}

export async function deleteGatheringPhotoWeb(gatheringId: string, photoId: string): Promise<PhotoActionResult> {
  const supabase = createClient();
  const { data: path, error } = await supabase.rpc("delete_gathering_photo", { p_photo_id: photoId });
  if (error) return { ok: false, message: photoError(error.message ?? "") };
  if (typeof path === "string" && path) {
    await supabase.storage.from("gathering-photos").remove([path]);
  }
  revalidatePath(`/host/g/${gatheringId}/photos`);
  return { ok: true };
}
