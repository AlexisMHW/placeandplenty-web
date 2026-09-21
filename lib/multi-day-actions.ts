"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type Result = { ok: true } | { ok: false; message: string };

function fail(error: { message?: string } | null, fallback = "That change didn’t save. Please try again."): Result {
  return { ok: false, message: error?.message || fallback };
}

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/schedule`);
  revalidatePath(`/host/g/${gatheringId}`);
}

function text(form: FormData, key: string, max = 1000): string | null {
  const value = String(form.get(key) ?? "").trim();
  return value ? value.slice(0, max) : null;
}

function int(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function money(form: FormData, key: string): number {
  const n = Number(String(form.get(key) ?? "0"));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export async function getMultiDayAccessState(
  gatheringId: string
): Promise<{ ok: true; hasPass: boolean; hasExtension: boolean } | { ok: false; message: string }> {
  const supabase = createClient();
  const [{ data: hasPass, error: passError }, { data: hasExtension, error: extensionError }] =
    await Promise.all([
      supabase.rpc("gathering_has_multi_day_access", { p_gathering_id: gatheringId }),
      supabase.rpc("gathering_has_multi_day_extension", { p_gathering_id: gatheringId }),
    ]);

  if (passError || extensionError) {
    return { ok: false, message: "We couldn’t verify Multi-Day access. Please try again." };
  }

  return {
    ok: true,
    hasPass: hasPass === true,
    hasExtension: hasExtension === true,
  };
}

export async function initializeMultiDaySchedule(gatheringId: string): Promise<Result> {
  const supabase = createClient();
  const { data: hasAccess, error: accessError } = await supabase.rpc("gathering_has_multi_day_access", {
    p_gathering_id: gatheringId,
  });
  if (accessError || hasAccess !== true) return { ok: false, message: "This gathering needs a Multi-Day Pass first." };

  const { data: gathering, error } = await supabase
    .from("gatherings")
    .select("gathering_date,gathering_end_date,duration_type")
    .eq("id", gatheringId)
    .single();
  if (error || !gathering || gathering.duration_type !== "multi_day" || !gathering.gathering_end_date) {
    return { ok: false, message: "This gathering does not have a valid Multi-Day date range." };
  }

  const start = new Date(`${gathering.gathering_date}T00:00:00Z`);
  const end = new Date(`${gathering.gathering_end_date}T00:00:00Z`);
  const rows: Array<{ gathering_id: string; day_date: string; sort_order: number }> = [];
  let index = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    rows.push({ gathering_id: gatheringId, day_date: d.toISOString().slice(0, 10), sort_order: index++ });
  }
  const { error: upsertError } = await supabase
    .from("gathering_days")
    .upsert(rows, { onConflict: "gathering_id,day_date" });
  if (upsertError) return fail(upsertError);
  refresh(gatheringId);
  return { ok: true };
}

export async function updateScheduleDay(gatheringId: string, dayId: string, form: FormData): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("gathering_days")
    .update({ title: text(form, "title", 120), notes: text(form, "notes", 1500) })
    .eq("id", dayId)
    .eq("gathering_id", gatheringId);
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function createScheduleActivity(gatheringId: string, dayId: string, form: FormData): Promise<Result> {
  const title = text(form, "title", 160);
  if (!title) return { ok: false, message: "Give the activity a title." };
  const visibility = String(form.get("guest_visibility") ?? "all_invited");
  const allowed = ["all_invited", "accepted_guests", "selected_guests"];
  const supabase = createClient();
  const { error } = await supabase.from("gathering_activities").insert({
    gathering_id: gatheringId,
    gathering_day_id: dayId,
    title,
    description: text(form, "description", 2000),
    start_time: text(form, "start_time", 16),
    end_time: text(form, "end_time", 16),
    location_name: text(form, "location_name", 200),
    location_address: text(form, "location_address", 300),
    attire_notes: text(form, "attire_notes", 500),
    transportation_notes: text(form, "transportation_notes", 1000),
    reservation_notes: text(form, "reservation_notes", 1000),
    vendor_name: text(form, "vendor_name", 200),
    vendor_contact: text(form, "vendor_contact", 300),
    capacity: int(form, "capacity"),
    guest_visibility: allowed.includes(visibility) ? visibility : "all_invited",
    is_selectable: form.get("is_selectable") === "on",
    selection_group: text(form, "selection_group", 120),
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function updateScheduleActivity(gatheringId: string, activityId: string, form: FormData): Promise<Result> {
  const title = text(form, "title", 160);
  if (!title) return { ok: false, message: "Give the activity a title." };
  const visibility = String(form.get("guest_visibility") ?? "all_invited");
  const allowed = ["all_invited", "accepted_guests", "selected_guests"];
  const supabase = createClient();
  const { error } = await supabase
    .from("gathering_activities")
    .update({
      title,
      description: text(form, "description", 2000),
      start_time: text(form, "start_time", 16),
      end_time: text(form, "end_time", 16),
      location_name: text(form, "location_name", 200),
      location_address: text(form, "location_address", 300),
      attire_notes: text(form, "attire_notes", 500),
      transportation_notes: text(form, "transportation_notes", 1000),
      reservation_notes: text(form, "reservation_notes", 1000),
      vendor_name: text(form, "vendor_name", 200),
      vendor_contact: text(form, "vendor_contact", 300),
      capacity: int(form, "capacity"),
      guest_visibility: allowed.includes(visibility) ? visibility : "all_invited",
      is_selectable: form.get("is_selectable") === "on",
      selection_group: text(form, "selection_group", 120),
    })
    .eq("id", activityId)
    .eq("gathering_id", gatheringId);
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function deleteScheduleActivity(gatheringId: string, activityId: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("gathering_activities").delete().eq("id", activityId).eq("gathering_id", gatheringId);
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function moveScheduleActivity(gatheringId: string, activityId: string, dayId: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.rpc("move_gathering_activity_day", {
    p_gathering_id: gatheringId,
    p_activity_id: activityId,
    p_gathering_day_id: dayId,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function setActivityVisibleGuests(
  gatheringId: string,
  activityId: string,
  guestIds: string[]
): Promise<Result> {
  const supabase = createClient();
  const { error: clearError } = await supabase
    .from("gathering_activity_visible_guests")
    .delete()
    .eq("gathering_id", gatheringId)
    .eq("activity_id", activityId);
  if (clearError) return fail(clearError);

  if (guestIds.length) {
    const { error } = await supabase.from("gathering_activity_visible_guests").insert(
      guestIds.map((id) => ({
        gathering_id: gatheringId,
        activity_id: activityId,
        gathering_guest_id: id,
      }))
    );
    if (error) return fail(error);
  }
  refresh(gatheringId);
  return { ok: true };
}

export async function addActivityPayment(gatheringId: string, activityId: string, form: FormData): Promise<Result> {
  const guestId = text(form, "gathering_guest_id", 64);
  const partyId = text(form, "invitation_party_id", 64);
  if (!!guestId === !!partyId) {
    return { ok: false, message: "Choose either one guest or one invitation household." };
  }
  const supabase = createClient();
  const { error } = await supabase.from("gathering_activity_payment_ledger").insert({
    gathering_id: gatheringId,
    activity_id: activityId,
    gathering_guest_id: guestId,
    invitation_party_id: partyId,
    label: text(form, "label", 160),
    amount_due: money(form, "amount_due"),
    amount_paid: money(form, "amount_paid"),
    notes: text(form, "notes", 1000),
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function deleteActivityPayment(gatheringId: string, paymentId: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("gathering_activity_payment_ledger")
    .delete()
    .eq("id", paymentId)
    .eq("gathering_id", gatheringId);
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function setPlanningAssociation(
  gatheringId: string,
  kind: "menu" | "shopping" | "contribution" | "expense",
  recordId: string,
  dayId: string | null,
  activityId: string | null
): Promise<Result> {
  const table =
    kind === "menu"
      ? "menu_items"
      : kind === "shopping"
        ? "shopping_items"
        : kind === "contribution"
          ? "contributions"
          : "gathering_expenses";
  const supabase = createClient();
  const { error } = await supabase
    .from(table)
    .update({ gathering_day_id: dayId, gathering_activity_id: activityId })
    .eq("id", recordId)
    .eq("gathering_id", gatheringId);
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function extendMultiDayDuration(gatheringId: string, totalDays: 5 | 6 | 7): Promise<Result> {
  const supabase = createClient();
  const [{ data: hasPass }, { data: hasExtension }, { data: gathering, error: loadError }] = await Promise.all([
    supabase.rpc("gathering_has_multi_day_access", { p_gathering_id: gatheringId }),
    supabase.rpc("gathering_has_multi_day_extension", { p_gathering_id: gatheringId }),
    supabase.from("gatherings").select("gathering_date,duration_type").eq("id", gatheringId).single(),
  ]);
  if (loadError || !gathering || gathering.duration_type !== "multi_day") return { ok: false, message: "This is not a valid Multi-Day gathering." };
  if (hasPass !== true || hasExtension !== true) return { ok: false, message: "The one-time Multi-Day extension is required first." };

  const start = new Date(`${gathering.gathering_date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + totalDays - 1);
  const end = start.toISOString().slice(0, 10);
  const { error } = await supabase.from("gatherings").update({ gathering_end_date: end }).eq("id", gatheringId);
  if (error) return fail(error);
  const initialized = await initializeMultiDaySchedule(gatheringId);
  if (!initialized.ok) return initialized;
  refresh(gatheringId);
  return { ok: true };
}
