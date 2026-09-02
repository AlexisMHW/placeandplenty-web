"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type FigureItOutWebResult =
  | { ok: true; cached: boolean }
  | { ok: false; message: string };

type WeatherForecast = {
  available?: boolean;
  conditions?: string;
  temperature?: number;
  precipitationChance?: number;
  riskLevel?: string;
};

type FigureItOutOutput = {
  assumptions?: string[];
  tasks: Array<Record<string, unknown>>;
  menuRecommendations?: Array<Record<string, unknown>>;
  shoppingItems?: Array<Record<string, unknown>>;
  warnings?: Array<Record<string, unknown>>;
  optionalSuggestions?: string[];
};

function splitNotes(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function buildInput(
  gathering: Record<string, unknown>,
  weather?: WeatherForecast
): Record<string, unknown> {
  const foodStyle = typeof gathering.food_style === "string" ? gathering.food_style : null;
  const budgetTarget = Number(gathering.budget_target ?? 0);

  return {
    gathering: {
      name: gathering.name,
      type: gathering.gathering_type,
      date: gathering.gathering_date,
      arrivalTime: gathering.arrival_time,
      timezone: gathering.timezone,
      locationType: gathering.location_type ?? "home",
      gatheringEnvironment: gathering.gathering_environment,
    },
    guests: {
      adults: gathering.adult_count,
      children: gathering.child_count,
      dietaryNeeds: splitNotes((gathering.dietary_notes as string | null) ?? null),
      accessibilityNeeds: splitNotes((gathering.accessibility_notes as string | null) ?? null),
    },
    budget: budgetTarget ? { total: budgetTarget, currency: "USD" } : undefined,
    food: {
      style: foodStyle ?? undefined,
      hostCooking: foodStyle === "cooking" || foodStyle === "mixed",
    },
    weather:
      weather?.available && weather.conditions && weather.riskLevel
        ? {
            conditions: weather.conditions,
            temperature: weather.temperature ?? 0,
            precipitationChance: weather.precipitationChance ?? 0,
            riskLevel: weather.riskLevel,
          }
        : undefined,
    notes: gathering.notes ?? undefined,
  };
}

function hashInput(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function friendlyError(code: string): string {
  if (code.includes("quota")) return "You’ve used the Figure It Out allowance for this gathering or subscription period.";
  if (code.includes("rate")) return "Give Figure It Out a moment before asking again.";
  if (code.includes("cancelled") || code.includes("completed") || code.includes("archived") || code.includes("read_only")) {
    return "This gathering is finished, so its plan is preserved as read-only.";
  }
  if (code.includes("not_authorized") || code.includes("not_authenticated")) return "Please sign in again to update this plan.";
  return "Figure It Out couldn’t finish that just now. Your existing plan is still safe.";
}

async function callWeather(token: string, gatheringId: string): Promise<WeatherForecast | undefined> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return undefined;
  try {
    const response = await fetch(`${url}/functions/v1/weather-forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: anon },
      body: JSON.stringify({ gatheringId }),
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    return (await response.json()) as WeatherForecast;
  } catch {
    return undefined;
  }
}

export async function runFigureItOutWeb(
  gatheringId: string,
  dietaryNotes: string,
  accessibilityNotes: string
): Promise<FigureItOutWebResult> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, message: "Please sign in again to update this plan." };

  const { data: status, error: statusError } = await supabase.rpc("effective_gathering_status", { p_gathering_id: gatheringId });
  if (statusError) return { ok: false, message: "We couldn’t verify this gathering just now." };
  if (["completed", "cancelled", "archived"].includes(String(status))) {
    return { ok: false, message: "This gathering is finished, so its plan is preserved as read-only." };
  }

  const { error: notesError } = await supabase.from("gatherings").update({
    dietary_notes: dietaryNotes.trim() || null,
    accessibility_notes: accessibilityNotes.trim() || null,
  }).eq("id", gatheringId);
  if (notesError) return { ok: false, message: "Those planning notes couldn’t be saved." };

  const { data: gathering, error: gatheringError } = await supabase
    .from("gatherings")
    .select("id,name,gathering_type,gathering_date,arrival_time,timezone,location_type,gathering_environment,adult_count,child_count,dietary_notes,accessibility_notes,budget_target,food_style,notes,weather_city,last_plan_input_hash,last_plan_output")
    .eq("id", gatheringId)
    .maybeSingle();
  if (gatheringError || !gathering) return { ok: false, message: "That gathering is no longer available." };

  const { data: premium } = await supabase.rpc("resolve_gathering_is_premium", { p_gathering_id: gatheringId });
  let weather: WeatherForecast | undefined;
  if (premium === true && gathering.weather_city) weather = await callWeather(token, gatheringId);

  const input = buildInput(gathering as Record<string, unknown>, weather);
  const inputHash = hashInput(input);
  if (gathering.last_plan_input_hash === inputHash && gathering.last_plan_output) return { ok: true, cached: true };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, message: "Figure It Out is temporarily unavailable." };

  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/figure-it-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: anon },
      body: JSON.stringify({ gatheringId, input }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: "Figure It Out couldn’t connect just now. Your existing plan is still safe." };
  }

  const payload = (await response.json().catch(() => null)) as (FigureItOutOutput & { error?: string }) | null;
  if (!response.ok || !payload || payload.error) return { ok: false, message: friendlyError(String(payload?.error ?? `http_${response.status}`)) };

  const { error: applyError } = await supabase.rpc("apply_figure_it_out_plan", {
    p_gathering_id: gatheringId,
    p_input_hash: inputHash,
    p_output: payload,
    p_tasks: payload.tasks,
  });
  if (applyError) return { ok: false, message: friendlyError(applyError.message ?? "apply_failed") };

  revalidatePath(`/host/g/${gatheringId}`);
  revalidatePath(`/host/g/${gatheringId}/hub`);
  revalidatePath(`/host/g/${gatheringId}/table`);
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  return { ok: true, cached: false };
}
