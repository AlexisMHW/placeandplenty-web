"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase-server";

const AVATAR_BUCKET = "profile-avatars";
const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type ProfilePhotoActionResult =
  | { ok: true }
  | { ok: false; message: string };

function revalidateAvatarSurfaces() {
  revalidatePath("/host/account");
  revalidatePath("/host/guest-book");
}

export async function uploadProfileAvatar(
  formData: FormData
): Promise<ProfilePhotoActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a photo first." };
  }
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    return { ok: false, message: "Use a JPEG, PNG or WebP image." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "Choose a photo smaller than 5MB." };
  }

  const supabase = createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return { ok: false, message: "That photo couldn't be saved." };

  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${user.id}/${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, message: "That photo didn't upload. Try again." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path, share_avatar_with_guest_books: true })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { ok: false, message: "That photo couldn't be saved." };
  }

  const oldPath = profile?.avatar_path as string | null | undefined;
  if (oldPath && oldPath !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
  }

  revalidateAvatarSurfaces();
  return { ok: true };
}

export async function removeProfileAvatar(): Promise<ProfilePhotoActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Please log in again." };
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);
  if (error) return { ok: false, message: "That photo couldn't be removed." };

  const path = data?.avatar_path as string | null | undefined;
  if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);

  revalidateAvatarSurfaces();
  return { ok: true };
}

export async function setProfileAvatarSharing(
  enabled: boolean
): Promise<ProfilePhotoActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Please log in again." };
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ share_avatar_with_guest_books: enabled })
    .eq("id", user.id);
  if (error) return { ok: false, message: "That preference couldn't be saved." };

  revalidateAvatarSurfaces();
  return { ok: true };
}
