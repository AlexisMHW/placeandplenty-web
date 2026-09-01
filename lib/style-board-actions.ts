"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { StyleSwatch } from "@/lib/style-board-data";

export type StyleActionResult = { ok: true } | { ok: false; message: string };
export type StyleSuggestionResult =
  | {
      ok: true;
      value: {
        theme: string;
        palette: StyleSwatch[];
        moodDescriptors: string[];
        ideas?: string;
      };
    }
  | { ok: false; message: string };

export interface StyleClosetMatch {
  componentId: string;
  found: boolean;
  closetItemId?: string;
  name?: string;
  quantityOwned?: number;
}

async function ensureEditable(gatheringId: string): Promise<StyleActionResult> {
  const supabase = createClient();
  const [{ data: entitled, error: entitlementError }, { data: status, error: statusError }] =
    await Promise.all([
      supabase.rpc("resolve_gathering_is_premium", { p_gathering_id: gatheringId }),
      supabase.rpc("effective_gathering_status", { p_gathering_id: gatheringId }),
    ]);
  if (entitlementError || statusError) return { ok: false, message: "We couldn't verify this Style Board." };
  if (entitled !== true) return { ok: false, message: "My Style Board is available with a Gathering Pass or Plus." };
  if (["completed", "cancelled", "archived"].includes(String(status))) {
    return { ok: false, message: "This gathering is finished, so its Style Board is read-only." };
  }
  return { ok: true };
}

export async function saveStyleBoardWeb(
  gatheringId: string,
  input: {
    theme: string;
    palette: StyleSwatch[];
    moodDescriptors: string[];
    visionNotes: string;
  }
): Promise<StyleActionResult> {
  const allowed = await ensureEditable(gatheringId);
  if (!allowed.ok) return allowed;

  const palette = input.palette
    .filter((swatch) => /^#[0-9a-f]{6}$/i.test(swatch.hex))
    .slice(0, 8)
    .map((swatch) => ({ hex: swatch.hex.toUpperCase(), label: swatch.label?.trim() || undefined }));
  const moods = input.moodDescriptors.map((mood) => mood.trim()).filter(Boolean).slice(0, 10);

  const supabase = createClient();
  const { error } = await supabase.from("gathering_style").upsert(
    {
      gathering_id: gatheringId,
      theme: input.theme.trim() || null,
      palette,
      mood_descriptors: moods,
      vision_notes: input.visionNotes.trim() || null,
    },
    { onConflict: "gathering_id" }
  );
  if (error) return { ok: false, message: error.message.includes("gathering_archived_read_only") ? "This gathering is read-only." : "That Style Board didn't save." };

  revalidatePath(`/host/g/${gatheringId}/style`);
  return { ok: true };
}

export async function uploadStyleImageWeb(
  gatheringId: string,
  formData: FormData
): Promise<StyleActionResult> {
  const allowed = await ensureEditable(gatheringId);
  if (!allowed.ok) return allowed;

  const file = formData.get("image");
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 160) || null;
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an inspiration image first." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "Keep inspiration images under 10 MB." };

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension) return { ok: false, message: "Use a JPG, PNG, or WebP image." };

  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from("gathering_style_images")
    .select("display_order")
    .eq("gathering_id", gatheringId)
    .order("display_order", { ascending: false })
    .limit(1);
  if (existingError) return { ok: false, message: "That image couldn't be added." };

  const path = `${gatheringId}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("style-images")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, message: "That image couldn't be uploaded." };

  const nextOrder = Number(existing?.[0]?.display_order ?? -1) + 1;
  const { error: rowError } = await supabase.from("gathering_style_images").insert({
    gathering_id: gatheringId,
    storage_path: path,
    caption,
    display_order: nextOrder,
  });
  if (rowError) {
    await supabase.storage.from("style-images").remove([path]);
    return { ok: false, message: "That image couldn't be added to the board." };
  }

  revalidatePath(`/host/g/${gatheringId}/style`);
  return { ok: true };
}

export async function deleteStyleImageWeb(
  gatheringId: string,
  imageId: string,
  storagePath: string
): Promise<StyleActionResult> {
  const allowed = await ensureEditable(gatheringId);
  if (!allowed.ok) return allowed;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_style_images")
    .delete()
    .eq("id", imageId)
    .eq("gathering_id", gatheringId)
    .eq("storage_path", storagePath)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "That image is already off the board." };
  await supabase.storage.from("style-images").remove([storagePath]);
  revalidatePath(`/host/g/${gatheringId}/style`);
  return { ok: true };
}

/**
 * Style analysis names pieces; Smart Hosting Closet answers whether the
 * gathering owner already owns something like them. This deliberately
 * does not expose the owner's reusable inventory to a co-host. A co-host
 * can see the Style Board, but only the owner can probe their private
 * account-level Closet.
 */
export async function matchStyleComponentsToClosetWeb(
  gatheringId: string,
  components: Array<{
    id: string;
    name: string;
    category: string | null;
    searchTerms: string[];
  }>
): Promise<
  | { ok: true; matches: StyleClosetMatch[] }
  | { ok: false; message: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const { data: gathering, error: gatheringError } = await supabase
    .from("gatherings")
    .select("owner_user_id")
    .eq("id", gatheringId)
    .maybeSingle();
  if (gatheringError || !gathering) return { ok: false, message: "That gathering is no longer available." };
  if (gathering.owner_user_id !== user.id) {
    return { ok: false, message: "Only the gathering owner can check their private Hosting Closet." };
  }

  const matches: StyleClosetMatch[] = [];
  for (const component of components.slice(0, 30)) {
    const searchName = [component.name, ...(component.searchTerms ?? [])]
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);
    const { data, error } = await supabase.rpc("match_hosting_closet", {
      p_user_id: user.id,
      p_need_name: searchName || component.name,
      p_need_quantity: 1,
      p_need_category: component.category,
      p_gathering_id: gatheringId,
    });
    if (error) {
      const raw = error.message ?? "";
      if (raw.includes("smart_closet_requires_pass_or_plus")) {
        return { ok: false, message: "Smart Hosting Closet matching needs a Gathering Pass or Plus." };
      }
      continue;
    }
    const row = (data ?? {}) as Record<string, unknown>;
    matches.push({
      componentId: component.id,
      found: row.entitled === true && row.found === true,
      closetItemId: row.found === true ? String(row.closetItemId ?? "") : undefined,
      name: row.found === true && typeof row.name === "string" ? row.name : undefined,
      quantityOwned: row.found === true ? Number(row.quantityOwned ?? 0) : undefined,
    });
  }

  return { ok: true, matches };
}

async function callStyleFunction<T>(
  name: "help-me-style-it" | "analyze-style-images",
  body: Record<string, unknown>
): Promise<{ ok: true; value: T } | { ok: false; code: string }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: "not_authenticated" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, code: "server_misconfigured" };

  try {
    const response = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || payload?.error) {
      return { ok: false, code: String(payload?.error ?? `http_${response.status}`) };
    }
    return { ok: true, value: payload as T };
  } catch {
    return { ok: false, code: "network_error" };
  }
}

function styleAiMessage(code: string): string {
  if (code.includes("not_entitled") || code.includes("style_board_not_entitled"))
    return "My Style Board is available with a Gathering Pass or Plus.";
  if (code.includes("quota")) return "You've used the Style Board AI allowance for this period.";
  if (code.includes("rate")) return "Give Style Board a moment before asking again.";
  if (code.includes("no_images")) return "Add at least one inspiration image first.";
  if (code.includes("archived") || code.includes("completed")) return "This gathering is finished, so no new Style Board analysis can run.";
  return "Style Board couldn't finish that just now. Please try again.";
}

export async function requestStyleSuggestionWeb(
  gatheringId: string,
  input: { occasion: string; theme: string; moodDescriptors: string[]; visionNotes: string }
): Promise<StyleSuggestionResult> {
  const result = await callStyleFunction<{
    theme: string;
    palette: StyleSwatch[];
    moodDescriptors: string[];
    ideas?: string;
  }>("help-me-style-it", {
    gatheringId,
    occasion: input.occasion,
    themeSoFar: input.theme.trim() || undefined,
    moodSoFar: input.moodDescriptors.length ? input.moodDescriptors : undefined,
    visionNotes: input.visionNotes.trim() || undefined,
  });
  if (!result.ok) return { ok: false, message: styleAiMessage(result.code) };
  return { ok: true, value: result.value };
}

export async function analyzeStyleImagesWeb(gatheringId: string): Promise<StyleActionResult> {
  const result = await callStyleFunction<Record<string, unknown>>("analyze-style-images", { gatheringId });
  if (!result.ok) return { ok: false, message: styleAiMessage(result.code) };
  revalidatePath(`/host/g/${gatheringId}/style`);
  return { ok: true };
}
