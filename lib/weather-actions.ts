"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ContingencyAction, WeatherEnvironment, WeatherForecast } from "@/lib/weather-data";

export type WeatherActionResult =
  | { ok: true; forecast?: WeatherForecast | null; status?: string }
  | { ok: false; message: string };

function friendly(message: string): string {
  if (message.includes("read_only") || message.includes("completed") || message.includes("cancelled") || message.includes("archived")) return "This gathering is finished, so its weather plan is preserved as read-only.";
  if (message.includes("not_authorized")) return "You no longer have access to update this gathering.";
  if (message.includes("city_required")) return "Add the city where you’re hosting first.";
  return "Weather couldn’t be updated just now. Your existing plan is still safe.";
}

async function ensureEditable(supabase: ReturnType<typeof createClient>, gatheringId: string) {
  const { data: status, error } = await supabase.rpc("effective_gathering_status", { p_gathering_id: gatheringId });
  if (error) throw error;
  if (["completed", "cancelled", "archived"].includes(String(status))) throw new Error("gathering_read_only");
}

async function callWeather(gatheringId: string): Promise<{ forecast: WeatherForecast; status?: string }> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) throw new Error("not_authorized");

  const response = await fetch(`${url}/functions/v1/weather-forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: anon },
    body: JSON.stringify({ gatheringId }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as (WeatherForecast & { weatherStatus?: string; reason?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.reason ?? `weather_${response.status}`);
  return { forecast: body, status: body.weatherStatus };
}

function revalidate(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}`);
}

export async function saveWeatherLocation(
  gatheringId: string,
  city: string,
  environment: WeatherEnvironment
): Promise<WeatherActionResult> {
  const supabase = createClient();
  try {
    await ensureEditable(supabase, gatheringId);
    const { error } = await supabase
      .from("gatherings")
      .update({ weather_city: city.trim() || null, gathering_environment: environment })
      .eq("id", gatheringId);
    if (error) throw error;

    if (environment === "indoors" || environment === "unknown" || !city.trim()) {
      const { data: status, error: recalcError } = await supabase.rpc("weather_recalculate_status", { p_gathering_id: gatheringId });
      if (recalcError) throw recalcError;
      revalidate(gatheringId);
      return { ok: true, forecast: null, status: String(status) };
    }

    const result = await callWeather(gatheringId);
    revalidate(gatheringId);
    return { ok: true, forecast: result.forecast, status: result.status };
  } catch (error) {
    return { ok: false, message: friendly(error instanceof Error ? error.message : "weather_failed") };
  }
}

export async function refreshWeatherForecast(gatheringId: string): Promise<WeatherActionResult> {
  const supabase = createClient();
  try {
    await ensureEditable(supabase, gatheringId);
    const result = await callWeather(gatheringId);
    revalidate(gatheringId);
    return { ok: true, forecast: result.forecast, status: result.status };
  } catch (error) {
    return { ok: false, message: friendly(error instanceof Error ? error.message : "weather_failed") };
  }
}

export async function saveWeatherContingency(
  gatheringId: string,
  plan: ContingencyAction[],
  activated: boolean
): Promise<WeatherActionResult> {
  const supabase = createClient();
  try {
    await ensureEditable(supabase, gatheringId);
    const { data: premium, error: premiumError } = await supabase.rpc("resolve_gathering_is_premium", { p_gathering_id: gatheringId });
    if (premiumError || premium !== true) return { ok: false, message: "Plan B is available with a Gathering Pass or Place & Plenty Plus." };
    const { error } = await supabase
      .from("gatherings")
      .update({ contingency_plan: plan, contingency_activated: activated })
      .eq("id", gatheringId);
    if (error) throw error;
    const { data: status, error: recalcError } = await supabase.rpc("weather_recalculate_status", { p_gathering_id: gatheringId });
    if (recalcError) throw recalcError;
    revalidate(gatheringId);
    return { ok: true, status: String(status) };
  } catch (error) {
    return { ok: false, message: friendly(error instanceof Error ? error.message : "weather_failed") };
  }
}
