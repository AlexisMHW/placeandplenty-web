"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase-server";
import { mergeGuestCounts } from "@/lib/guest-counts";
import {
  isFoodStyle,
  isGatheringType,
  validateGatheringInput,
  VALIDATION_MESSAGES,
  type CreateGatheringInput,
} from "@/lib/gathering-creation";
import {
  ALLOWED_ARTWORK_MIME_TYPES,
  ARTWORK_REJECTION_MESSAGES,
  isInvitationMode,
  isInvitationStyle,
  type InvitationDecision,
  type InvitationMode,
} from "@/lib/invitations";

// WRITES for the authenticated host web app.
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
// RLS DOES NOT FAIL LOUDLY ON UPDATE AND DELETE, and this file used to
// treat that as success. PostgREST reports an UPDATE or DELETE that
// matched zero rows — because RLS filtered them, or because the row is
// gone — as `error === null`. Every sensitive write below therefore ends
// in `.select("id")` and asserts that something actually changed. See
// `mutate()`. Reporting "Saved." when nothing was saved is the single
// worst thing a form can do, and it is exactly what an RLS block looked
// like here before.
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
// HOSTREADY IS RECALCULATED BY THE BACKEND, NOT HERE. Planning writes
// call `hostready_recalculate(gathering_id)` through refreshHostReady()
// below. That RPC is the single authoritative contract shared with
// native — see supabase/migrations and P&P-NATIVE-REBUILD-BACKEND-
// CONTRACT.md. While the formula is still being centralised the RPC
// reports `implemented: false` and changes nothing, which is why
// components/host/StaleScoreNote.tsx still says the score catches up in
// the app. The call sites are correct now; the day the algorithm lands
// in hostready_compute(), both surfaces become right at once and nothing
// in this file changes.

export type ActionResult = { ok: true } | { ok: false; message: string };

/** A result that hands something back — an invite link, an id. */
export type ActionValue<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/** Postgres error codes and messages a host might actually provoke. */
function translate(error: { message?: string; code?: string } | null): string {
  const raw = error?.message ?? "";

  if (raw.includes("gathering_archived_read_only")) {
    return "This gathering is archived, so it can't be changed. Unarchive it in the app first.";
  }
  if (raw.includes("free_gathering_slot") || raw.includes("slot_available")) {
    return "Free covers one active gathering at a time. Finish or close the current one first.";
  }
  // enforce_one_open_gathering raises this literal string. Matched
  // rather than parsed out of arbitrary Postgres text, exactly as the
  // native app matches it — the limit lives in the database, and both
  // surfaces are only translating what it said.
  if (raw.includes("free_open_gathering_limit_reached")) {
    return "Your Free plan includes one active gathering at a time. Finish or archive your current gathering, or unlock another gathering to start a new one.";
  }
  if (raw.includes("locked_in") || raw.includes("lock_in")) {
    return "This gathering is locked in, so that can't be changed here.";
  }
  if (raw.includes("smart_closet_requires_pass_or_plus")) {
    return "Your Hosting Closet is always yours. Smart matching needs a Gathering Pass or Place & Plenty Plus.";
  }
  if (raw.includes("not_authorized") || raw.includes("not authorized")) {
    return "You don't have access to change that.";
  }
  if (error?.code === "23505") {
    return "That already exists.";
  }
  if (error?.code === "23503") {
    return "Something that referred to this is missing. Try refreshing.";
  }
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

/**
 * The same translation, for an action that hands something back on
 * success. A failure carries no value, so the two share everything
 * except the type they have to satisfy.
 */
function failValue<T>(error: unknown): ActionValue<T> {
  return {
    ok: false,
    message: translate(error as { message?: string; code?: string } | null),
  };
}

/**
 * Assert that an UPDATE or DELETE actually touched a row.
 *
 * Pass the result of a query ending in `.select("id")`. An empty array
 * means RLS filtered the row, the id was wrong, or the row is already
 * gone — three different causes with one honest answer for the host, and
 * never "Saved."
 */
function mutate(
  result: { data: { id: string }[] | null; error: unknown },
  gone = "That's no longer there, or you don't have access to change it."
): ActionResult {
  if (result.error) return fail(result.error);
  if (!result.data || result.data.length === 0) {
    return { ok: false, message: gone };
  }
  return { ok: true };
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

/**
 * Ask the backend to recalculate HostReady for a gathering.
 *
 * FIRE AND FORGET, DELIBERATELY. A readiness score that could not be
 * refreshed must never turn a successful save into a failure — the dish
 * was added, and telling the host otherwise would be false. The RPC is
 * also a no-op today (see the header), so a failure here costs nothing
 * at all until the algorithm is centralised.
 */
async function refreshHostReady(gatheringId: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc("hostready_recalculate", {
      p_gathering_id: gatheringId,
    });
  } catch {
    /* see above */
  }
}

/** Revalidate a gathering surface plus its overview, then refresh the score. */
async function afterPlanChange(
  gatheringId: string,
  ...paths: string[]
): Promise<void> {
  await refreshHostReady(gatheringId);
  for (const p of paths) revalidatePath(p);
  revalidatePath(`/host/g/${gatheringId}`);
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
  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/table`);
  return { ok: true };
}

export async function updateMenuServings(
  gatheringId: string,
  itemId: string,
  servings: number | null
): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("menu_items")
    // user_override marks this as the host's decision rather than the
    // app's suggestion — the same flag the app sets, so the two agree
    // about whose number this is.
    .update({ servings_planned: servings, user_override: true })
    .eq("id", itemId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That dish is no longer on the table.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/table`);
  return { ok: true };
}

export async function deleteMenuItem(
  gatheringId: string,
  itemId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That dish is already off the table.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/table`);
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
  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/shopping`);
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
  const result = await supabase
    .from("shopping_items")
    .update({ status })
    .eq("id", itemId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That item is no longer on the list.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/shopping`);
  return { ok: true };
}

export async function deleteShoppingItem(
  gatheringId: string,
  itemId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", itemId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That item is already off the list.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/shopping`);
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
  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/contributions`);
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
  const result = await supabase
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
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That contribution is no longer here.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/contributions`);
  return { ok: true };
}

export async function deleteContribution(
  gatheringId: string,
  contributionId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("contributions")
    .delete()
    .eq("id", contributionId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That contribution is already gone.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/contributions`);
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
  const result = await supabase
    .from("gathering_guests")
    .update({ rsvp_status: status })
    .eq("id", gatheringGuestId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That guest is no longer on this gathering.");
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/people`);
  return { ok: true };
}

export async function updateGuestNotes(
  gatheringId: string,
  gatheringGuestId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("gathering_guests")
    .update({
      guest_dietary_notes: text(formData.get("dietary"), 300) || null,
      guest_allergy_notes: text(formData.get("allergy"), 300) || null,
    })
    .eq("id", gatheringGuestId)
    .eq("gathering_id", gatheringId)
    .select("id");

  const outcome = mutate(result, "That guest is no longer on this gathering.");
  if (!outcome.ok) return outcome;

  revalidatePath(`/host/g/${gatheringId}/people`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* My Co-Hosts                                                        */
/* ------------------------------------------------------------------ */

// THE CANONICAL ARCHITECTURE IS USED AS-IS. There is no web co-host
// table and there must never be one. Invitations are minted by
// create_gathering_invitation(), which upserts into `gathering_members`
// on (gathering_id, invited_email) and returns the RAW acceptance token;
// only its SHA-256 hash is stored. Removal goes through
// remove_gathering_member(), which sets status = 'removed' rather than
// deleting — history is kept and access ends at the same moment.
//
// WHY THE HOST IS HANDED A LINK RATHER THAN US SENDING AN EMAIL. There
// is no co-host invitation email in the backend today: `communication_
// events` covers guest invitations and messages, not membership. Rather
// than pretend a mail went out, the host gets the link once, to send
// however they already talk to that person. When a co-host email exists
// this becomes an extra delivery path, not a rewrite — the token and the
// acceptance flow are unchanged.
//
// THE TOKEN IS SHOWN EXACTLY ONCE, to the owner who just minted it. It
// is not stored anywhere on the web side and it is not recoverable: a
// host who loses it re-issues, which mints a new one and invalidates the
// old. That is the correct property for a credential.

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** The URL a co-host opens to accept. Path only — the browser resolves it. */
function coHostInviteLink(token: string): string {
  return `/host/co-host-invite/${encodeURIComponent(token)}`;
}

export async function inviteCoHost(
  gatheringId: string,
  formData: FormData
): Promise<ActionValue<{ email: string; link: string }>> {
  const email = text(formData.get("invited_email"), 320).toLowerCase();
  if (!email || !isEmail(email)) {
    return { ok: false, message: "That doesn't look like an email address." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_gathering_invitation", {
    p_gathering_id: gatheringId,
    p_invited_email: email,
  });

  if (error) return { ok: false, message: translate(error) };
  if (!data) {
    return { ok: false, message: "That invitation didn't get created. Try again." };
  }

  revalidatePath(`/host/g/${gatheringId}/co-hosts`);
  return { ok: true, value: { email, link: coHostInviteLink(String(data)) } };
}

/**
 * Re-issue an invitation to someone who was already invited.
 *
 * Same RPC: its ON CONFLICT branch resets the row to `invited`, clears
 * accepted_at/removed_at/user_id and mints a fresh token. So this both
 * resends and revokes the previous link, which is the behaviour a host
 * expects from "send it again" and the safer one either way.
 */
export async function reissueCoHostInvitation(
  gatheringId: string,
  email: string
): Promise<ActionValue<{ email: string; link: string }>> {
  const form = new FormData();
  form.set("invited_email", email);
  return inviteCoHost(gatheringId, form);
}

export async function removeCoHost(
  gatheringId: string,
  memberId: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("remove_gathering_member", {
    p_member_id: memberId,
  });

  if (error) return fail(error);
  if (data !== true) {
    return { ok: false, message: "That co-host is no longer on this gathering." };
  }

  revalidatePath(`/host/g/${gatheringId}/co-hosts`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

/**
 * Accept an invitation as the signed-in account.
 *
 * The RPC does the work that matters and this deliberately adds nothing
 * to it: it requires a CONFIRMED email on the authenticated account and
 * refuses unless that address matches the one invited. So a forwarded
 * link cannot be redeemed by whoever received it.
 */
export async function acceptCoHostInvitation(
  token: string
): Promise<ActionValue<{ gatheringId: string }>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_gathering_invitation", {
    p_token: token,
  });

  if (error) {
    const raw = error.message ?? "";
    if (raw.includes("email does not match")) {
      return {
        ok: false,
        message:
          "This invitation was sent to a different email address. Sign in with that address to accept it.",
      };
    }
    if (raw.includes("no verified email")) {
      return {
        ok: false,
        message:
          "Confirm your email address first — we sent you a link when you signed up.",
      };
    }
    return {
      ok: false,
      message: "That invitation is no longer valid. Ask the host to send a new one.",
    };
  }

  if (!data) {
    return { ok: false, message: "That invitation is no longer valid." };
  }

  revalidatePath("/host");
  return { ok: true, value: { gatheringId: String(data) } };
}

export async function declineCoHostInvitation(
  token: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("decline_gathering_invitation", {
    p_token: token,
  });
  if (error) {
    return { ok: false, message: "That invitation is no longer valid." };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* My Guest Book                                                      */
/* ------------------------------------------------------------------ */

// SAVED AND UNSAVED ARE DIFFERENT THINGS, and the difference is the
// point of this surface. `guests.is_saved` marks the people the host
// deliberately kept. Rows with is_saved = false are people created in
// passing for one gathering; they stay in the database forever so RSVP
// history and gathering_guests references survive, and they are shown
// under a separate history heading rather than as Guest Book entries.
//
// THERE IS NO DESTRUCTIVE "REMOVE" HERE. Unsaving takes someone out of
// the reusable book and touches nothing else. Deleting is offered only
// for a person with no gathering history at all — see
// deleteGuestBookPerson().

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
    allergy_notes: text(formData.get("allergy_notes"), 300) || null,
    accessibility_notes: text(formData.get("accessibility_notes"), 300) || null,
    guest_type: "adult",
    is_saved: true,
  });

  if (error) return fail(error);
  revalidatePath("/host/guest-book");
  return { ok: true };
}

export async function updateGuestBookPerson(
  guestId: string,
  formData: FormData
): Promise<ActionResult> {
  const firstName = text(formData.get("first_name"), 80);
  if (!firstName) return { ok: false, message: "A first name is enough to start." };

  const supabase = createClient();
  const result = await supabase
    .from("guests")
    .update({
      first_name: firstName,
      last_name: text(formData.get("last_name"), 80) || null,
      household_name: text(formData.get("household_name"), 120) || null,
      email: text(formData.get("email"), 320) || null,
      phone: text(formData.get("phone"), 40) || null,
      dietary_notes: text(formData.get("dietary_notes"), 300) || null,
      allergy_notes: text(formData.get("allergy_notes"), 300) || null,
      accessibility_notes: text(formData.get("accessibility_notes"), 300) || null,
    })
    .eq("id", guestId)
    .select("id");

  const outcome = mutate(result, "That person is no longer in your guest book.");
  if (!outcome.ok) return outcome;

  revalidatePath("/host/guest-book");
  return { ok: true };
}

/**
 * Keep someone in the reusable book, or stop keeping them.
 *
 * UNSAVING IS NOT DELETION AND MUST NEVER BECOME IT. Every RSVP,
 * contribution and dietary note attached to this person through
 * `gathering_guests` is untouched — the row simply stops appearing as a
 * reusable Guest Book entry and moves to the history section.
 */
export async function setGuestSaved(
  guestId: string,
  saved: boolean
): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("guests")
    .update({ is_saved: saved })
    .eq("id", guestId)
    .select("id");

  const outcome = mutate(result, "That person is no longer in your guest book.");
  if (!outcome.ok) return outcome;

  revalidatePath("/host/guest-book");
  return { ok: true };
}

/**
 * Delete a person outright — offered ONLY when they have never been on a
 * gathering.
 *
 * The check is here rather than left to a foreign key because the honest
 * answer differs: a person with history should be UNSAVED, and the UI
 * says so. Letting the delete reach the database would either cascade
 * away real RSVP history or fail with a constraint error that means
 * nothing to a host.
 */
export async function deleteGuestBookPerson(
  guestId: string
): Promise<ActionResult> {
  const supabase = createClient();

  const { count, error: countError } = await supabase
    .from("gathering_guests")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId);

  if (countError) return fail(countError);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message:
        "This person has been to a gathering, so deleting them would take that history with them. Remove them from your guest book instead.",
    };
  }

  const result = await supabase
    .from("guests")
    .delete()
    .eq("id", guestId)
    .select("id");

  const outcome = mutate(result, "That person is already gone.");
  if (!outcome.ok) return outcome;

  revalidatePath("/host/guest-book");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* My Hosting Closet                                                  */
/* ------------------------------------------------------------------ */

// BASIC INVENTORY IS FREE. The RLS policy on hosting_closet_items is
// `owner_user_id = auth.uid()` and carries no entitlement test, so
// everything in this section works for a Free account. What is paid is
// the SMART layer — matching a gathering's needs against what the host
// owns, and resolving the gap — and that lives in
// match_hosting_closet() and resolve_need_from_closet(), gated on a
// Gathering Pass bound to the gathering or account Plus.
//
// Nothing here may check an entitlement. If a paywall ever appears in
// this section, it is a bug.

const CLOSET_BUCKET = "hosting-closet";
const CLOSET_MIME = ["image/jpeg", "image/png", "image/webp"];
const CLOSET_MAX_BYTES = 10 * 1024 * 1024;

function closetFields(formData: FormData) {
  return {
    name: text(formData.get("name"), 120),
    category: text(formData.get("category"), 60) || null,
    quantity_owned: Math.max(
      1,
      Math.round(optionalNumber(formData.get("quantity_owned")) ?? 1)
    ),
    color: text(formData.get("color"), 40) || null,
    material: text(formData.get("material"), 40) || null,
    size_label: text(formData.get("size_label"), 60) || null,
    capacity_label: text(formData.get("capacity_label"), 60) || null,
    notes: text(formData.get("notes"), 500) || null,
  };
}

/**
 * Put an item photo in the private `hosting-closet` bucket.
 *
 * THE PATH IS `<user id>/<item id>/<name>` BECAUSE THE STORAGE POLICY
 * READS THE FIRST FOLDER as the owner: `(storage.foldername(name))[1] =
 * auth.uid()`. A path built any other way is rejected, which is the
 * point — the bucket is private and a host can only ever write under
 * their own id.
 *
 * The bucket has INSERT and DELETE policies but no UPDATE, so replacing
 * a photo means uploading to a fresh path and deleting the old object
 * afterwards rather than upserting.
 */
async function uploadClosetPhoto(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  itemId: string,
  file: File
): Promise<{ storage_path: string; mime_type: string } | { error: string }> {
  if (!CLOSET_MIME.includes(file.type)) {
    return { error: "Photos need to be a JPEG, PNG or WebP." };
  }
  if (file.size > CLOSET_MAX_BYTES) {
    return { error: "That photo is larger than 10MB." };
  }

  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  // A timestamp rather than the original filename: the filename is
  // attacker-controlled text on a path the storage policy parses.
  const path = `${userId}/${itemId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(CLOSET_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { error: "That photo didn't upload. Please try again." };
  return { storage_path: path, mime_type: file.type };
}

export async function addClosetItem(formData: FormData): Promise<ActionResult> {
  const fields = closetFields(formData);
  if (!fields.name) return { ok: false, message: "Give the item a name." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const { data, error } = await supabase
    .from("hosting_closet_items")
    .insert({ owner_user_id: user.id, ...fields })
    .select("id")
    .maybeSingle();

  if (error) return fail(error);
  if (!data) return { ok: false, message: "That didn't save. Please try again." };

  // The photo needs the item's id in its path, so it follows the insert.
  // A photo that fails to upload leaves a perfectly good item behind
  // rather than losing what the host typed.
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadClosetPhoto(supabase, user.id, data.id, photo);
    if ("error" in uploaded) {
      revalidatePath("/host/closet");
      return { ok: false, message: `${uploaded.error} The item was saved.` };
    }
    await supabase
      .from("hosting_closet_items")
      .update(uploaded)
      .eq("id", data.id);
  }

  revalidatePath("/host/closet");
  return { ok: true };
}

export async function updateClosetItem(
  itemId: string,
  formData: FormData
): Promise<ActionResult> {
  const fields = closetFields(formData);
  if (!fields.name) return { ok: false, message: "Give the item a name." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const patch: Record<string, unknown> = { ...fields };

  const photo = formData.get("photo");
  let previousPath: string | null = null;

  if (photo instanceof File && photo.size > 0) {
    const { data: existing } = await supabase
      .from("hosting_closet_items")
      .select("storage_path")
      .eq("id", itemId)
      .maybeSingle();
    previousPath = existing?.storage_path ?? null;

    const uploaded = await uploadClosetPhoto(supabase, user.id, itemId, photo);
    if ("error" in uploaded) return { ok: false, message: uploaded.error };
    Object.assign(patch, uploaded);
  }

  const result = await supabase
    .from("hosting_closet_items")
    .update(patch)
    .eq("id", itemId)
    .select("id");

  const outcome = mutate(result, "That item is no longer in your closet.");
  if (!outcome.ok) return outcome;

  // Only after the row points at the new object. Removing it first would
  // leave the item pictureless if the update were refused.
  if (previousPath) {
    await supabase.storage.from(CLOSET_BUCKET).remove([previousPath]);
  }

  revalidatePath("/host/closet");
  return { ok: true };
}

export async function archiveClosetItem(itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  // Archived rather than deleted: the app treats archived_at as the
  // "I no longer own this" signal, and hard-deleting would break any
  // gathering_closet_items row that referenced it.
  const result = await supabase
    .from("hosting_closet_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", itemId)
    .is("archived_at", null)
    .select("id");

  const outcome = mutate(result, "That item is already out of your closet.");
  if (!outcome.ok) return outcome;

  revalidatePath("/host/closet");
  return { ok: true };
}

/** Undo an archive. The row was never deleted, so this is a real undo. */
export async function restoreClosetItem(itemId: string): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("hosting_closet_items")
    .update({ archived_at: null })
    .eq("id", itemId)
    .not("archived_at", "is", null)
    .select("id");

  const outcome = mutate(result, "That item is already in your closet.");
  if (!outcome.ok) return outcome;

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

  const supabase = createClient();

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

  if (adults !== null || children !== null) {
    // Read the persisted counts so a partial edit cannot zero the field
    // that was not submitted. See mergeGuestCounts().
    const { data: current, error: readError } = await supabase
      .from("gatherings")
      .select("adult_count, child_count")
      .eq("id", gatheringId)
      .maybeSingle();

    if (readError) return fail(readError);
    if (!current) {
      return { ok: false, message: "That gathering is no longer here." };
    }

    Object.assign(
      patch,
      mergeGuestCounts(
        { adults, children },
        {
          adults: current.adult_count ?? 0,
          children: current.child_count ?? 0,
        }
      )
    );
  }

  const result = await supabase
    .from("gatherings")
    .update(patch)
    .eq("id", gatheringId)
    .select("id");

  const outcome = mutate(
    result,
    "That gathering is no longer here, or you don't have access to change it."
  );
  if (!outcome.ok) return outcome;

  await afterPlanChange(gatheringId, `/host/g/${gatheringId}/settings`);
  revalidatePath("/host");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Creating a gathering                                               */
/* ------------------------------------------------------------------ */

// ONE ROW, WRITTEN AGAIN AS THE WIZARD GOES, AND NEVER A SECOND ONE.
//
// The web creation wizard is the same eight-question conversation the
// native app has, so it must leave the same trace in the database and no
// other. That means three rules, and all three are load-bearing:
//
//   1. The gathering is INSERTed once, in 'draft', the first time the
//      wizard holds every field the row requires. Every later step
//      UPDATEs that same id. `saveGatheringDraft` takes the id it
//      already has and only inserts when there isn't one.
//
//   2. Nothing here writes `status` except finaliseGatheringCreation
//      below, which is the guarded draft -> active transition and is
//      called once, at true completion. A gathering must not become
//      active merely because a half-finished draft row exists.
//
//   3. The invitation decision goes through the canonical RPCs —
//      set_invitation_mode, select_invitation_style,
//      set_invitation_status — the same three the native app calls. The
//      invitation columns are never UPDATEd from here.
//
// THERE IS NO WEB ENTITLEMENT CHECK IN THIS FILE, deliberately. The
// Free tier's one-open-gathering rule is enforced by
// enforce_one_open_gathering in Postgres; the INSERT below is simply
// allowed to fail, and translate() turns the trigger's own message into
// the approved copy. A web-side pre-check would be a second opinion
// about entitlement, which is exactly the thing that drifts.

/** Whole, non-negative people — the columns are integers. */
function count(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value), 10_000);
}

/**
 * The columns the wizard owns, cleaned. Deliberately excludes `status`,
 * `timezone` and every invitation column: status has its own guarded
 * transition, timezone is set once at insert, and invitations go through
 * their RPCs.
 */
function gatheringPatch(input: CreateGatheringInput) {
  return {
    name: input.name.trim().slice(0, 120),
    gathering_type: input.gatheringType,
    gathering_date: input.gatheringDate,
    arrival_time: input.arrivalTime,
    location_name: input.locationName.trim().slice(0, 160) || null,
    budget_target:
      input.budgetTarget !== null && Number.isFinite(input.budgetTarget)
        ? Math.max(0, input.budgetTarget)
        : null,
    food_style: input.foodStyle,
    notes: input.notes.trim().slice(0, 1000) || null,
    // expected_guest_count is derived, never submitted separately. Both
    // fields are always present here, so the merge is against zero and
    // the shared helper does the arithmetic rather than it being
    // repeated in a third place.
    ...mergeGuestCounts(
      { adults: count(input.adultCount), children: count(input.childCount) },
      { adults: 0, children: 0 }
    ),
  };
}

/**
 * Create or update the wizard's single draft gathering.
 *
 * Pass `gatheringId` as null on the first save and as the returned id
 * every time after. Returns the id so the client keeps updating the same
 * row — the caller must never call this with null twice.
 */
export async function saveGatheringDraft(
  input: CreateGatheringInput,
  gatheringId: string | null,
  timezone?: string | null
): Promise<ActionValue<string>> {
  // The same five deterministic rules the native app applies, re-run on
  // the server because a client-side check is advisory by definition.
  const errors = validateGatheringInput(input);
  if (errors.length > 0) {
    return { ok: false, message: VALIDATION_MESSAGES[errors[0].code] };
  }
  // Vocabulary is checked rather than trusted: `food_style` is untyped
  // text, so a wrong value would be stored happily and then recognised
  // by nothing. See lib/gathering-creation.ts.
  if (!input.gatheringType || !isGatheringType(input.gatheringType)) {
    return { ok: false, message: VALIDATION_MESSAGES.type_required };
  }
  if (input.foodStyle !== null && !isFoodStyle(input.foodStyle)) {
    return { ok: false, message: "That isn't one of the food options." };
  }

  const supabase = createClient();
  const patch = gatheringPatch(input);

  if (gatheringId) {
    const result = await supabase
      .from("gatherings")
      .update(patch)
      .eq("id", gatheringId)
      .select("id");

    const outcome = mutate(
      result,
      "That gathering is no longer here, or you don't have access to change it."
    );
    if (!outcome.ok) return outcome;

    revalidatePath(`/host/g/${gatheringId}`);
    return { ok: true, value: gatheringId };
  }

  const user = await getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { data, error } = await supabase
    .from("gatherings")
    .insert({
      owner_user_id: user.id,
      ...patch,
      // The gathering's wall-clock timezone, taken from the browser the
      // host is creating it in — the same thing the app takes from the
      // device. The column is NOT NULL with a default, so an
      // implausible value is simply left to that default.
      ...(typeof timezone === "string" && timezone.includes("/")
        ? { timezone: timezone.slice(0, 64) }
        : {}),
      // The wizard's row starts, and stays, a draft.
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return failValue<string>(error);
  if (!data) {
    return { ok: false, message: "That didn't save. Please try again." };
  }

  revalidatePath("/host");
  return { ok: true, value: data.id as string };
}

/**
 * Record step 5's answer through the canonical invitation RPCs.
 *
 * Idempotent on purpose — re-setting the same choice is a safe no-op, so
 * stepping backwards and forwards through the wizard never duplicates
 * anything or loses the answer.
 *
 * 'later' writes NOTHING. invitation_status stays at its 'not_started'
 * default, which is the honest record of a host who has not decided.
 */
export async function recordInvitationDecision(
  gatheringId: string,
  decision: InvitationDecision,
  mode: InvitationMode | null = null,
  styleId: string | null = null
): Promise<ActionResult> {
  if (decision === "later") return { ok: true };

  const supabase = createClient();

  if (decision === "already_invited") {
    const { error } = await supabase.rpc("set_invitation_status", {
      p_gathering_id: gatheringId,
      p_status: "invited_elsewhere",
    });
    return error ? fail(error) : { ok: true };
  }

  // decision === 'not_yet' — the mode is required, and is one of the
  // three the column actually holds.
  if (!mode || !isInvitationMode(mode)) {
    return { ok: false, message: "Choose how you'd like to invite them." };
  }

  const modeResult = await supabase.rpc("set_invitation_mode", {
    p_gathering_id: gatheringId,
    p_mode: mode,
  });
  if (modeResult.error) return fail(modeResult.error);

  // select_invitation_style() sets invitation_mode='p_and_p' alongside
  // the style id atomically, so it is called after the mode rather than
  // instead of it, and only once a look has actually been picked.
  if (mode === "p_and_p" && styleId) {
    if (!isInvitationStyle(styleId)) {
      return { ok: false, message: "That isn't one of the invitation looks." };
    }
    const styleResult = await supabase.rpc("select_invitation_style", {
      p_gathering_id: gatheringId,
      p_style: styleId,
    });
    if (styleResult.error) return fail(styleResult.error);
  }

  const statusResult = await supabase.rpc("set_invitation_status", {
    p_gathering_id: gatheringId,
    p_status: "in_progress",
  });
  if (statusResult.error) return fail(statusResult.error);

  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}

/**
 * How many people are already on this gathering's list.
 *
 * A read, in the writes file, because the wizard needs it about a draft
 * whose id only exists client-side so far. It is here so step 5 can
 * offer the canonical My People flow to a host with nobody on the list
 * yet and stay quiet for one who already has people — never so the
 * wizard can start building a guest list of its own.
 */
export async function countGatheringInvitees(
  gatheringId: string
): Promise<number | null> {
  const supabase = createClient();
  const { count: total, error } = await supabase
    .from("gathering_guests")
    .select("id", { count: "exact", head: true })
    .eq("gathering_id", gatheringId);

  return error ? null : total ?? 0;
}

/**
 * THE WIZARD-COMPLETION TRANSITION: draft -> active, and the only place
 * in the web app that writes `gatherings.status`.
 *
 * The `.eq("status", "draft")` guard is the whole safety mechanism and
 * is the same one the native app uses. Calling this on a gathering that
 * is already active, hosting, completed, cancelled or archived matches
 * nothing and changes nothing — an accidental reactivation is not
 * possible, so the call needs no caller-side status check to be safe.
 *
 * Because of that guard, zero rows updated is AMBIGUOUS in a way the
 * ordinary mutate() assertion cannot read: it means either "already past
 * draft", which is success, or "gone, or not yours", which is not. So
 * the row is read back and the two are told apart honestly.
 */
export async function finaliseGatheringCreation(
  gatheringId: string
): Promise<ActionResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("gatherings")
    .update({ status: "active" })
    .eq("id", gatheringId)
    .eq("status", "draft")
    .select("id");

  if (error) return fail(error);

  if (!data || data.length === 0) {
    const { data: existing, error: readError } = await supabase
      .from("gatherings")
      .select("status")
      .eq("id", gatheringId)
      .maybeSingle();

    if (readError) return fail(readError);
    if (!existing) {
      return {
        ok: false,
        message:
          "That gathering is no longer here, or you don't have access to change it.",
      };
    }
    // Still a draft, after a guarded update that reported no error,
    // means RLS filtered the write. Anything else means it had already
    // moved on — the no-op this guard exists to make safe.
    if (existing.status === "draft") {
      return { ok: false, message: "You don't have access to change that." };
    }
  }

  await afterPlanChange(gatheringId);
  revalidatePath("/host");
  return { ok: true };
}

/**
 * Record artwork the browser has just put in the canonical bucket.
 *
 * TWO STEPS, IN THE SAME ORDER THE APP USES THEM. The bytes go straight
 * from the browser to `invitation-artwork` as the signed-in user — the
 * bucket's own RLS decides whether that gathering's folder may be
 * written to, exactly as it does on the phone — and then this records
 * the result through `save_invitation_artwork()`, which sets the path,
 * the mime type, the original filename and `invitation_mode='uploaded'`
 * atomically. There is no second bucket, no second column and no
 * web-only artwork model; both surfaces read back what the other wrote.
 *
 * The object is uploaded before it is recorded, so a failure here leaves
 * an unreferenced object in the bucket. That is the same exposure the
 * native path has and it is the right way round: an object nothing
 * points at is invisible and harmless, whereas a gathering pointing at
 * an object that was never uploaded is a broken invitation.
 *
 * THE PATH IS CHECKED, not trusted. The storage policy grants access by
 * reading the first path segment, so a key whose first segment is not
 * this gathering could only have been written to somewhere else — and
 * recording it here would point this gathering at another gathering's
 * folder. Storage would have refused the upload already; this refuses to
 * record it either way.
 */
export async function saveInvitationArtwork(
  gatheringId: string,
  storagePath: string,
  mimeType: string,
  originalFilename: string
): Promise<ActionResult> {
  if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(mimeType)) {
    // The same sentence the browser would already have shown. The size
    // rule is not re-checked here because the bytes never pass through
    // this process — the bucket's own file_size_limit is what enforces
    // it, and it is the same 10 MB both surfaces check up front.
    return {
      ok: false,
      message: ARTWORK_REJECTION_MESSAGES.unsupported_file_type,
    };
  }
  if (storagePath.split("/")[0] !== gatheringId) {
    return { ok: false, message: "That file didn't save. Please try again." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("save_invitation_artwork", {
    p_gathering_id: gatheringId,
    p_storage_path: storagePath,
    p_mime_type: mimeType,
    p_original_filename: originalFilename.slice(0, 255) || null,
  });

  if (error) return fail(error);

  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath("/host");
  return { ok: true };
}
