"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type CreateGatheringResult =
  | { ok: true; gatheringId: string }
  | { ok: false; message: string };

const GATHERING_TYPES = new Set([
  "birthday",
  "dinner",
  "brunch",
  "holiday",
  "shower",
  "cookout",
  "game_night",
  "family_gathering",
  "repast",
  "open_house",
  "other",
]);

function text(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function wholeNumber(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "0"));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function friendlyError(error: { message?: string; code?: string } | null): string {
  const raw = error?.message ?? "";
  if (raw.includes("free_open_gathering_limit_reached") || raw.includes("free_gathering_slot")) {
    return "Free includes one active gathering at a time. Finish or close the current one before starting another.";
  }
  if (raw.includes("annual") || raw.includes("gathering_limit")) {
    return "You have reached the gathering allowance for your current plan.";
  }
  if (error?.code === "42501") return "Your account does not have permission to create this gathering.";
  return "We couldn't create this gathering. Please check the details and try again.";
}

/**
 * Creates the same canonical gathering row the native wizard creates.
 * The insert starts as draft, then finalizes to active only after every
 * required field has been accepted by Postgres. All writes run as the
 * signed-in user, so the existing RLS, Free-slot and lifecycle rules stay
 * authoritative; there is no web-only entitlement path.
 */
export async function createGatheringFromWeb(formData: FormData): Promise<CreateGatheringResult> {
  const name = text(formData.get("name"), 120);
  const gatheringType = text(formData.get("gathering_type"), 40);
  const gatheringDate = text(formData.get("gathering_date"), 10);
  const arrivalTime = text(formData.get("arrival_time"), 8);
  const adultCount = wholeNumber(formData.get("adult_count"));
  const childCount = wholeNumber(formData.get("child_count"));
  const expectedGuestCount = adultCount + childCount;

  if (!name) return { ok: false, message: "Give your gathering a name." };
  if (!GATHERING_TYPES.has(gatheringType)) return { ok: false, message: "Choose a gathering type." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gatheringDate)) return { ok: false, message: "Choose a gathering date." };
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(arrivalTime)) return { ok: false, message: "Choose an arrival time." };
  if (expectedGuestCount < 1) return { ok: false, message: "Add at least one guest." };

  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { ok: false, message: "Please sign in again before creating a gathering." };

  const timezone = text(formData.get("timezone"), 80) || "America/Chicago";

  const { data: created, error: createError } = await supabase
    .from("gatherings")
    .insert({
      owner_user_id: user.id,
      name,
      gathering_type: gatheringType,
      gathering_date: gatheringDate,
      arrival_time: arrivalTime,
      timezone,
      location_name: text(formData.get("location_name"), 160) || null,
      adult_count: adultCount,
      child_count: childCount,
      expected_guest_count: expectedGuestCount,
      budget_target: optionalNumber(formData.get("budget_target")),
      food_style: text(formData.get("food_style"), 80) || null,
      indoor_outdoor: text(formData.get("indoor_outdoor"), 40) || null,
      notes: text(formData.get("notes"), 1000) || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (createError || !created) return { ok: false, message: friendlyError(createError) };

  const { error: finalizeError } = await supabase
    .from("gatherings")
    .update({ status: "active" })
    .eq("id", created.id)
    .eq("status", "draft");

  if (finalizeError) {
    // Avoid leaving a failed web submission occupying the user's one-open
    // Free slot. At this point no child records have been created.
    await supabase.from("gatherings").delete().eq("id", created.id).eq("status", "draft");
    return { ok: false, message: friendlyError(finalizeError) };
  }

  revalidatePath("/host");
  return { ok: true, gatheringId: created.id };
}
