"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/guest-experience`);
  revalidatePath(`/host/g/${gatheringId}/people`);
}

function fail(error: { message?: string } | null): ActionResult {
  const raw = error?.message ?? "";
  if (raw.includes("not_authorized")) return { ok: false, message: "You don’t have access to make that change." };
  if (raw.includes("gathering_archived_read_only")) return { ok: false, message: "This gathering is archived, so guest details can’t be changed." };
  if (raw.includes("no_recipients_selected")) return { ok: false, message: "Choose at least one household or guest." };
  return { ok: false, message: "That didn’t save. Please try again." };
}

export async function saveGuestExperienceSettingsWeb(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_guest_page_content", {
    p_gathering_id: gatheringId,
    p_attire_text: String(formData.get("attire_text") ?? "").trim() || null,
    p_arrival_parking_text: String(formData.get("arrival_parking_text") ?? "").trim() || null,
    p_transportation_text: String(formData.get("transportation_text") ?? "").trim() || null,
    p_what_to_bring_text: String(formData.get("what_to_bring_text") ?? "").trim() || null,
    p_important_details_text: String(formData.get("important_details_text") ?? "").trim() || null,
    p_show_song_request: formData.get("show_song_request") === "on",
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

const CATEGORIES = [
  "general", "weather_contingency", "location_change", "time_change",
  "parking_arrival", "food_menu", "reminder", "other",
] as const;
const AUDIENCES = ["all", "coming", "awaiting", "selected"] as const;

export async function publishGuestUpdateWeb(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { ok: false, message: "Add a title and message before publishing." };

  const rawCategory = String(formData.get("category") ?? "general");
  const category = CATEGORIES.includes(rawCategory as any) ? rawCategory : "general";
  const rawAudience = String(formData.get("audience") ?? "all");
  const audience = AUDIENCES.includes(rawAudience as any) ? rawAudience : "all";
  const partyIds = formData.getAll("party_ids").map(String).filter(Boolean);

  const supabase = createClient();
  const { error } = await supabase.rpc("publish_guest_update", {
    p_gathering_id: gatheringId,
    p_category: category,
    p_title: title,
    p_body: body,
    p_importance: formData.get("important") === "on" ? "important" : "normal",
    p_require_acknowledgement: formData.get("require_acknowledgement") === "on",
    p_audience: audience,
    p_party_ids: audience === "selected" ? partyIds : null,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function deleteGuestUpdateWeb(
  gatheringId: string,
  updateId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_guest_update", { p_update_id: updateId });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}
