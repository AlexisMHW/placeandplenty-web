"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

// WRITES for the authenticated host web app.
//
// This is the file that turns the web app from "reads canonical data"
// into "manages canonical data" — the §30 Definition-of-Done item.
//
// THE SECURITY MODEL IS UNCHANGED AND IS THE WHOLE POINT. Every mutation
// below runs as the signed-in user through lib/supabase-server, so RLS
// decides what may be written, using the same policies the native app
// relies on (is_accepted_gathering_member for gathering contents,
// owner_user_id = auth.uid() for account-level rows). Nothing here
// re-checks ownership in application code and nothing uses the service
// role. A write the app would refuse is refused here, in the same place,
// for the same reason.
//
// THE DATABASE ENFORCES MORE THAN RLS, and these are real rules rather
// than edge cases, so their errors are translated rather than swallowed:
//
//   gathering_archived_read_only   enforce_archived_read_only(_strict)
//     Every content table on an archived gathering rejects INSERT,
//     UPDATE and DELETE. An archived gathering is a record, not a
//     workspace.
//
//   free gathering slot            enforce_one_open_gathering
//     The Free tier's one-open-gathering limit lives in Postgres, not
//     in the client. Web cannot route around it, which is exactly right.
//
//   lock-in / completed rules      enforce_lock_in_rules,
//                                  enforce_completed_at_rules
//
// DO NOT SET updated_at. Every one of these tables has a BEFORE UPDATE
// set_updated_at trigger; writing it by hand would fight the trigger and
// produce a value that disagrees with the app's.
//
// HOSTREADY GOES STALE AFTER A WEB WRITE, and that is a genuine
// cross-surface limitation rather than something this file can fix.
// `current_hostready_score` and `readiness_state` are computed IN THE
// APP (features/hostready) and stored on the gathering — there is no
// database trigger that recalculates them. So adding a dish here updates
// the menu immediately and leaves the score showing the app's last
// judgement until the app recomputes it.
//
// Recomputing the score on the web would be worse: it would be a second
// implementation of a rule this repo does not own, and the first time
// web said 71% while the phone said 68%, neither number would be
// trusted again. Surfaced honestly in the UI instead — see
// components/host/StaleScoreNote.tsx — and recorded for the §38 seam
// audit.

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Postgres error codes and messages a host might actually provoke. */
function translate(error: { message?: string; code?: string } | null): string {
  const raw = error?.message ?? "";

  if (raw.includes("gathering_archived_read_only")) {
    return "This gathering is archived, so it can't be changed. Unarchive it in the app first.";
  }
  if (raw.includes("free_gathering_slot") || raw.includes("slot_available")) {
    return "Free covers one active gathering at a time. Finish or close the current one first.";
  }
  if (raw.includes("locked_in") || raw.includes("lock_in")) {
    return "This gathering is locked in, so that can't be changed here.";
  }
  if (error?.code === "23505") {
    return "That already exists.";
  }
  if (error?.code === "23503") {
    return "Something that referred to this is missing. Try refreshing.";
  }
  // RLS rejection surfaces as an empty result rather than an error on
  // UPDATE/DELETE, and as 42501 on INSERT.
  if (error?.code === "42501") {
    return "You don't have access to change that.";
  }
  return "That didn't save. Please try again.";
}

function fail(error: unknown): ActionResult {
  return {
    ok: false,
    message: translate(error as { message?: string; code?: string } | null),
  };
}

/** Trim, collapse whitespace, and enforce a sane maximum. */
function text(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ------------------------------------------------------------------ */
/* My Table                                                           */
/* ------------------------------------------------------------------ */

export async function addMenuItem(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData.get("name"), 120);
  if (!name) return { ok: false, message: "Give the dish a name." };

  const supabase = createClient();
  const { error } = await supabase.from("menu_items").insert({
    gathering_id: gatheringId,
    name,
    category: text(formData.get("category"), 60) || null,
    servings_planned: optionalNumber(formData.get("servings_planned")),
    notes: text(formData.get("notes"), 500) || null,
  });

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/table`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

export async function updateMenuServings(
  gatheringId: string,
  itemId: string,
  servings: number | null
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("menu_items")
    // user_override marks this as the host's decision rather than the
    // app's suggestion — the same flag the app sets, so the two agree
    // about whose number this is.
    .update({ servings_planned: servings, user_override: true })
    .eq("id", itemId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/table`);
  return { ok: true };
}

export async function deleteMenuItem(
  gatheringId: string,
  itemId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/table`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* My Shopping                                                        */
/* ------------------------------------------------------------------ */

const SHOPPING_STATUSES = [
  "need",
  "have",
  "bought",
  "borrow",
  "rent",
  "hire",
  "not_needed",
] as const;

export async function addShoppingItem(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData.get("name"), 120);
  if (!name) return { ok: false, message: "Give the item a name." };

  const supabase = createClient();
  const { error } = await supabase.from("shopping_items").insert({
    gathering_id: gatheringId,
    name,
    category: text(formData.get("category"), 60) || null,
    quantity: optionalNumber(formData.get("quantity")),
    unit: text(formData.get("unit"), 30) || null,
    estimated_cost: optionalNumber(formData.get("estimated_cost")),
    status: "need",
    // Marks provenance: this row came from the website, not from the
    // menu planner or an AI suggestion.
    source: "web",
  });

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

export async function setShoppingStatus(
  gatheringId: string,
  itemId: string,
  status: string
): Promise<ActionResult> {
  if (!SHOPPING_STATUSES.includes(status as (typeof SHOPPING_STATUSES)[number])) {
    return { ok: false, message: "That isn't a status we recognise." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("shopping_items")
    .update({ status })
    .eq("id", itemId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

export async function deleteShoppingItem(
  gatheringId: string,
  itemId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", itemId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Who's Bringing What                                                */
/* ------------------------------------------------------------------ */

const CONTRIBUTION_STATUSES = [
  "needed",
  "asked",
  "claimed",
  "confirmed",
  "declined",
  "completed",
  "cancelled",
] as const;

export async function addContribution(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const itemName = text(formData.get("item_name"), 120);
  if (!itemName) return { ok: false, message: "Say what you need someone to bring." };

  const supabase = createClient();
  const { error } = await supabase.from("contributions").insert({
    gathering_id: gatheringId,
    item_name: itemName,
    category: text(formData.get("category"), 60) || null,
    quantity: optionalNumber(formData.get("quantity")) ?? 1,
    unit: text(formData.get("unit"), 30) || null,
    // "needed" and "unassigned" is an open ask — exactly what a guest
    // can then claim from their invitation.
    status: "needed",
    contributor_type: "unassigned",
    notes: text(formData.get("notes"), 500) || null,
  });

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/contributions`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

export async function setContributionStatus(
  gatheringId: string,
  contributionId: string,
  status: string
): Promise<ActionResult> {
  if (
    !CONTRIBUTION_STATUSES.includes(
      status as (typeof CONTRIBUTION_STATUSES)[number]
    )
  ) {
    return { ok: false, message: "That isn't a status we recognise." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("contributions")
    .update({
      status,
      responded_at: new Date().toISOString(),
      // Marking a status IS the host handling it, so the attention flag
      // clears with it. Leaving it set would keep the item in "needs
      // your attention" after the host had just dealt with it.
      needs_host_attention: false,
      attention_reason: null,
    })
    .eq("id", contributionId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/contributions`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

export async function deleteContribution(
  gatheringId: string,
  contributionId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("contributions")
    .delete()
    .eq("id", contributionId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/contributions`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* My People                                                          */
/* ------------------------------------------------------------------ */

const RSVP_STATUSES = ["invited", "yes", "no", "maybe", "no_response"] as const;

/**
 * Set a guest's RSVP on the host's behalf — the "they told me in person"
 * case, which is how a large share of real RSVPs actually arrive.
 *
 * Writes `gathering_guests.rsvp_status`, the same column the guest web
 * RSVP writes and the same one My People reads in the app. There is no
 * separate web RSVP record and there must never be one.
 */
export async function setRsvpStatus(
  gatheringId: string,
  gatheringGuestId: string,
  status: string
): Promise<ActionResult> {
  if (!RSVP_STATUSES.includes(status as (typeof RSVP_STATUSES)[number])) {
    return { ok: false, message: "That isn't an RSVP we recognise." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("gathering_guests")
    .update({ rsvp_status: status })
    .eq("id", gatheringGuestId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/people`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

export async function updateGuestNotes(
  gatheringId: string,
  gatheringGuestId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("gathering_guests")
    .update({
      guest_dietary_notes: text(formData.get("dietary"), 300) || null,
      guest_allergy_notes: text(formData.get("allergy"), 300) || null,
    })
    .eq("id", gatheringGuestId)
    .eq("gathering_id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}/people`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Account level                                                      */
/* ------------------------------------------------------------------ */

export async function addGuestBookPerson(
  formData: FormData
): Promise<ActionResult> {
  const firstName = text(formData.get("first_name"), 80);
  if (!firstName) return { ok: false, message: "A first name is enough to start." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  // owner_user_id is the ONE column that must be set explicitly here:
  // RLS checks it, but a default does not exist, so an insert without it
  // would be rejected rather than defaulted.
  const { error } = await supabase.from("guests").insert({
    owner_user_id: user.id,
    first_name: firstName,
    last_name: text(formData.get("last_name"), 80) || null,
    household_name: text(formData.get("household_name"), 120) || null,
    email: text(formData.get("email"), 320) || null,
    phone: text(formData.get("phone"), 40) || null,
    dietary_notes: text(formData.get("dietary_notes"), 300) || null,
    guest_type: "adult",
    is_saved: true,
  });

  if (error) return fail(error);
  revalidatePath("/host/guest-book");
  return { ok: true };
}

export async function addClosetItem(formData: FormData): Promise<ActionResult> {
  const name = text(formData.get("name"), 120);
  if (!name) return { ok: false, message: "Give the item a name." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const { error } = await supabase.from("hosting_closet_items").insert({
    owner_user_id: user.id,
    name,
    category: text(formData.get("category"), 60) || null,
    quantity_owned: optionalNumber(formData.get("quantity_owned")) ?? 1,
    color: text(formData.get("color"), 40) || null,
    material: text(formData.get("material"), 40) || null,
    notes: text(formData.get("notes"), 500) || null,
  });

  if (error) return fail(error);
  revalidatePath("/host/closet");
  return { ok: true };
}

export async function archiveClosetItem(itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  // Archived rather than deleted: the app treats archived_at as the
  // "I no longer own this" signal, and hard-deleting would break any
  // gathering_closet_items row that referenced it.
  const { error } = await supabase
    .from("hosting_closet_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) return fail(error);
  revalidatePath("/host/closet");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Gathering settings                                                 */
/* ------------------------------------------------------------------ */

export async function updateGatheringDetails(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const name = text(formData.get("name"), 120);
  if (!name) return { ok: false, message: "The gathering needs a name." };

  const patch: Record<string, unknown> = {
    name,
    location_name: text(formData.get("location_name"), 160) || null,
    notes: text(formData.get("notes"), 1000) || null,
  };

  // Only send a date/time when one was actually supplied — both columns
  // are NOT NULL, so an empty field must mean "leave it" rather than
  // "clear it".
  const date = text(formData.get("gathering_date"), 10);
  if (date) patch.gathering_date = date;
  const time = text(formData.get("arrival_time"), 8);
  if (time) patch.arrival_time = time;

  const adults = optionalNumber(formData.get("adult_count"));
  const children = optionalNumber(formData.get("child_count"));
  if (adults !== null) patch.adult_count = adults;
  if (children !== null) patch.child_count = children;
  if (adults !== null || children !== null) {
    patch.expected_guest_count = (adults ?? 0) + (children ?? 0);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("gatherings")
    .update(patch)
    .eq("id", gatheringId);

  if (error) return fail(error);
  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath(`/host/g/${gatheringId}/settings`);
  revalidatePath("/host");
  return { ok: true };
}
