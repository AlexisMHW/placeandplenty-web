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
  if (raw.includes("not_authorized") || raw.includes("guest_not_authorized")) return "You don’t have access to make that change.";
  if (raw.includes("first_name_required")) return "A first name is enough to start.";
  if (raw.includes("party_name_required")) return "Give this household or invitation a name.";
  if (raw.includes("household_requires_people")) return "Choose at least one person for this household.";
  if (raw.includes("guest_already_in_gathering")) return "Someone you chose is already in this gathering.";
  if (raw.includes("guests_owner_email_unique")) return "That email is already saved to someone in your Guest Book.";
  if (raw.includes("gathering_archived_read_only")) return "This gathering is archived, so its guest list can’t be changed.";
  if (raw.includes("no_contact_email")) return "Add an email address before sending this invitation.";
  if (raw.includes("no_recipients_selected")) return "Choose at least one household or guest for this message.";
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

/** Several saved people, ONE invitation party, ONE RSVP unit. */
export async function createHouseholdWeb(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const guestIds = formData
    .getAll("guest_ids")
    .map((value) => String(value))
    .filter(Boolean);
  const partyName = String(formData.get("party_name") ?? "").trim();
  if (!partyName) return { ok: false, message: "Give this household a name." };
  if (guestIds.length === 0) return { ok: false, message: "Choose at least one person for this household." };

  const supabase = createClient();
  const { error } = await supabase.rpc("people_create_household", {
    p_gathering_id: gatheringId,
    p_party_name: partyName,
    p_guest_ids: guestIds,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}

/**
 * Owner edit across the three records My People represents: reusable guest
 * identity, this gathering's note/plus-one, and its invitation party contact.
 */
export async function updateGatheringPersonWeb(
  gatheringId: string,
  gatheringGuestId: string,
  formData: FormData
): Promise<ActionResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  if (!firstName) return { ok: false, message: "A first name is enough to start." };
  const plusOne = Math.max(0, Number.parseInt(String(formData.get("plus_one_count") ?? "0"), 10) || 0);

  const supabase = createClient();
  const { error } = await supabase.rpc("people_update_gathering_person", {
    p_gathering_id: gatheringId,
    p_gathering_guest_id: gatheringGuestId,
    p_first_name: firstName,
    p_last_name: String(formData.get("last_name") ?? "").trim() || null,
    p_dietary_notes: String(formData.get("dietary_notes") ?? "").trim() || null,
    p_allergy_notes: String(formData.get("allergy_notes") ?? "").trim() || null,
    p_accessibility_notes: String(formData.get("accessibility_notes") ?? "").trim() || null,
    p_host_notes: String(formData.get("host_notes") ?? "").trim() || null,
    p_party_name: String(formData.get("party_name") ?? "").trim() || null,
    p_contact_email: String(formData.get("contact_email") ?? "").trim() || null,
    p_plus_one_count: plusOne,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}

/**
 * Gathering-scoped edit for an accepted co-host. It deliberately cannot touch
 * the owner's reusable Guest Book identity/contact record.
 */
export async function updateGatheringPersonDetailsWeb(
  gatheringId: string,
  gatheringGuestId: string,
  formData: FormData
): Promise<ActionResult> {
  const plusOne = Math.max(0, Number.parseInt(String(formData.get("plus_one_count") ?? "0"), 10) || 0);
  const supabase = createClient();
  const { error } = await supabase.rpc("people_update_gathering_details", {
    p_gathering_id: gatheringId,
    p_gathering_guest_id: gatheringGuestId,
    p_host_notes: String(formData.get("host_notes") ?? "").trim() || null,
    p_party_name: String(formData.get("party_name") ?? "").trim() || null,
    p_contact_email: String(formData.get("contact_email") ?? "").trim() || null,
    p_plus_one_count: plusOne,
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

/** Queue the SAME canonical invitation native sends to this invitation party. */
export async function sendInvitationToPartyWeb(
  gatheringId: string,
  invitationPartyId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("send_gathering_invitation", {
    p_gathering_id: gatheringId,
    p_invitation_party_id: invitationPartyId,
    p_subject: null,
    p_body: null,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}

const MESSAGE_AUDIENCES = ["all", "coming", "awaiting", "selected"] as const;

/** Queue a host update through the canonical communication pipeline. */
export async function sendGuestMessageWeb(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rawAudience = String(formData.get("audience") ?? "all");
  const audience = MESSAGE_AUDIENCES.includes(rawAudience as (typeof MESSAGE_AUDIENCES)[number])
    ? rawAudience
    : "all";
  if (!subject || !body) return { ok: false, message: "Add a subject and message before sending." };

  const partyIds = formData
    .getAll("party_ids")
    .map((value) => String(value))
    .filter(Boolean);
  if (audience === "selected" && partyIds.length === 0) {
    return { ok: false, message: "Choose at least one household or guest for this message." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("send_guest_message", {
    p_gathering_id: gatheringId,
    p_subject: subject.slice(0, 200),
    p_body: body.slice(0, 4000),
    p_audience: audience,
    p_party_ids: audience === "selected" ? partyIds : null,
  });
  if (error) return { ok: false, message: errorMessage(error) };
  refresh(gatheringId);
  return { ok: true };
}
