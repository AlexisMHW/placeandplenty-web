"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/people`);
  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath("/host/guest-book");
}

function errorMessage(error: { message?: string } | null): string {
  const raw = error?.message ?? "";
  if (raw.includes("not_authorized")) return "Only the gathering owner can add people from their Guest Book.";
  if (raw.includes("first_name_required")) return "A first name is enough to start.";
  if (raw.includes("guests_owner_email_unique")) return "That email is already saved to someone in your Guest Book.";
  if (raw.includes("gathering_archived_read_only")) return "This gathering is archived, so its guest list can’t be changed.";
  return "That didn’t save. Please try again.";
}

export async function addSavedPersonToGatheringWeb(
  gatheringId: string,
  guestId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("people_add_existing_to_gathering", {
    p_gathering_id: gatheringId,
    p_guest_id: guestId,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function addNewPersonToGatheringWeb(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  if (!firstName) return { ok: false, message: "A first name is enough to start." };

  const supabase = createClient();
  const { error } = await supabase.rpc("people_create_and_add_to_gathering", {
    p_gathering_id: gatheringId,
    p_first_name: firstName,
    p_last_name: String(formData.get("last_name") ?? "").trim() || null,
    p_household_name: String(formData.get("household_name") ?? "").trim() || null,
    p_email: String(formData.get("email") ?? "").trim() || null,
    p_phone: String(formData.get("phone") ?? "").trim() || null,
    p_save_to_guest_book: formData.get("save_to_guest_book") === "on",
    p_dietary_notes: String(formData.get("dietary_notes") ?? "").trim() || null,
    p_allergy_notes: String(formData.get("allergy_notes") ?? "").trim() || null,
    p_accessibility_notes: String(formData.get("accessibility_notes") ?? "").trim() || null,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function saveGatheringPersonToGuestBookWeb(
  gatheringId: string,
  guestId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("people_set_guest_saved", {
    p_guest_id: guestId,
    p_saved: true,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}

export async function removePersonFromGatheringWeb(
  gatheringId: string,
  gatheringGuestId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("people_remove_from_gathering", {
    p_gathering_id: gatheringId,
    p_gathering_guest_id: gatheringGuestId,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}
