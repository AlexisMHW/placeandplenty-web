import { createClient } from "@/lib/supabase-server";

export type WeatherEnvironment = "indoors" | "outdoors" | "indoor_outdoor" | "unknown";
export type WeatherStatus = "not_relevant" | "monitor" | "contingency_recommended" | "decision_needed" | "contingency_activated" | "handled";
export type ContingencyAction = { category: string; actionKey: string; customText?: string };
export type WeatherForecast = {
  available?: boolean;
  reason?: string;
  conditions?: string;
  detailedForecast?: string;
  temperature?: number;
  precipitationChance?: number;
  riskLevel?: "low" | "moderate" | "high";
};

export interface WeatherWorkspace {
  gatheringId: string;
  gatheringName: string;
  city: string;
  environment: WeatherEnvironment;
  status: WeatherStatus;
  contingencyPlan: ContingencyAction[];
  contingencyActivated: boolean;
  forecast: WeatherForecast | null;
  checkedAt: string | null;
  forecastForDate: string | null;
  premium: boolean;
  readOnly: boolean;
}

export async function getWeatherWorkspace(gatheringId: string): Promise<WeatherWorkspace | null> {
  const supabase = createClient();
  const { data: gathering, error } = await supabase
    .from("gatherings")
    .select("id,name,weather_city,gathering_environment,weather_status,contingency_plan,contingency_activated,weather_forecast,weather_checked_at,weather_forecast_for_date")
    .eq("id", gatheringId)
    .maybeSingle();
  if (error) throw error;
  if (!gathering) return null;

  const [{ data: effectiveStatus }, { data: premium }] = await Promise.all([
    supabase.rpc("effective_gathering_status", { p_gathering_id: gatheringId }),
    supabase.rpc("resolve_gathering_is_premium", { p_gathering_id: gatheringId }),
  ]);

  return {
    gatheringId,
    gatheringName: String(gathering.name ?? "Your gathering"),
    city: String(gathering.weather_city ?? ""),
    environment: (gathering.gathering_environment ?? "unknown") as WeatherEnvironment,
    status: (gathering.weather_status ?? "not_relevant") as WeatherStatus,
    contingencyPlan: Array.isArray(gathering.contingency_plan) ? (gathering.contingency_plan as ContingencyAction[]) : [],
    contingencyActivated: gathering.contingency_activated === true,
    forecast: gathering.weather_forecast && typeof gathering.weather_forecast === "object" ? (gathering.weather_forecast as WeatherForecast) : null,
    checkedAt: gathering.weather_checked_at ?? null,
    forecastForDate: gathering.weather_forecast_for_date ?? null,
    premium: premium === true,
    readOnly: ["completed", "cancelled", "archived"].includes(String(effectiveStatus)),
  };
}
