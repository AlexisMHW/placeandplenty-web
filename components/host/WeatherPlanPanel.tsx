"use client";

import { useMemo, useState, useTransition } from "react";
import { refreshWeatherForecast, saveWeatherContingency, saveWeatherLocation } from "@/lib/weather-actions";
import type { ContingencyAction, WeatherEnvironment, WeatherWorkspace } from "@/lib/weather-data";

const ACTIONS: Array<{ category: string; actionKey: string; label: string }> = [
  { category: "space", actionKey: "move_indoors", label: "Move indoors" },
  { category: "space", actionKey: "use_covered_patio", label: "Use a covered patio" },
  { category: "space", actionKey: "set_up_tent", label: "Set up a tent or canopy" },
  { category: "seating", actionKey: "indoor_seating", label: "Move seating indoors" },
  { category: "seating", actionKey: "covered_seating", label: "Create covered seating" },
  { category: "food_beverage", actionKey: "protect_buffet", label: "Protect the buffet" },
  { category: "food_beverage", actionKey: "relocate_serving_station", label: "Relocate serving station" },
  { category: "food_beverage", actionKey: "grill_contingency", label: "Use a grill backup" },
  { category: "decor", actionKey: "move_paper_decor", label: "Move paper décor" },
  { category: "decor", actionKey: "secure_lightweight_decor", label: "Secure lightweight décor" },
  { category: "equipment", actionKey: "protect_electronics", label: "Protect electronics" },
  { category: "equipment", actionKey: "protect_cords", label: "Protect cords" },
  { category: "guest_comfort", actionKey: "shade_or_fans", label: "Add shade or fans" },
  { category: "guest_comfort", actionKey: "blankets_or_heaters", label: "Add blankets or heaters" },
  { category: "activities", actionKey: "indoor_activity_backup", label: "Plan an indoor activity" },
  { category: "arrival", actionKey: "covered_entry", label: "Create a covered entry" },
  { category: "arrival", actionKey: "parking_adjustment", label: "Adjust parking or arrival" },
  { category: "communication", actionKey: "draft_guest_update", label: "Draft a guest update" },
];

function statusCopy(status: string) {
  if (status === "decision_needed") return "The forecast is close enough that it’s time to make the call.";
  if (status === "contingency_recommended") return "A simple backup plan would take the pressure off.";
  if (status === "handled") return "Your weather backup is handled.";
  if (status === "contingency_activated") return "Your backup plan is active.";
  if (status === "monitor") return "Nothing to solve yet. Keep an eye on it.";
  return "Weather is not affecting this gathering right now.";
}

export default function WeatherPlanPanel({ initial }: { initial: WeatherWorkspace }) {
  const [city, setCity] = useState(initial.city);
  const [environment, setEnvironment] = useState<WeatherEnvironment>(initial.environment);
  const [forecast, setForecast] = useState(initial.forecast);
  const [status, setStatus] = useState(initial.status);
  const [plan, setPlan] = useState<ContingencyAction[]>(initial.contingencyPlan);
  const [activated, setActivated] = useState(initial.contingencyActivated);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const outdoorish = environment === "outdoors" || environment === "indoor_outdoor";
  const unresolved = status === "contingency_recommended" || status === "decision_needed";

  const guestDraft = useMemo(() => {
    if (!initial.premium || !forecast?.available || !forecast.conditions || (status !== "handled" && status !== "contingency_activated")) return null;
    return `Hi everyone! Quick update on ${initial.gatheringName} — because of ${forecast.conditions.toLowerCase()}, we’ve made a backup plan to keep things comfortable. Details will be at the door, but wanted to give you a heads up ahead of time. See you soon!`;
  }, [forecast, initial.gatheringName, initial.premium, status]);

  function saveLocation() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveWeatherLocation(initial.gatheringId, city, environment);
      if (!result.ok) return setMessage(result.message);
      setForecast(result.forecast ?? null);
      if (result.status) setStatus(result.status as WeatherWorkspace["status"]);
      setMessage(outdoorish ? "Weather checked for this gathering." : "Gathering setting updated.");
    });
  }

  function refresh() {
    setMessage(null);
    startTransition(async () => {
      const result = await refreshWeatherForecast(initial.gatheringId);
      if (!result.ok) return setMessage(result.message);
      setForecast(result.forecast ?? null);
      if (result.status) setStatus(result.status as WeatherWorkspace["status"]);
      setMessage("Forecast refreshed.");
    });
  }

  function toggleAction(action: ContingencyAction) {
    const exists = plan.some((item) => item.category === action.category && item.actionKey === action.actionKey);
    const next = exists ? plan.filter((item) => !(item.category === action.category && item.actionKey === action.actionKey)) : [...plan, action];
    setPlan(next);
    startTransition(async () => {
      const result = await saveWeatherContingency(initial.gatheringId, next, activated);
      if (!result.ok) return setMessage(result.message);
      if (result.status) setStatus(result.status as WeatherWorkspace["status"]);
    });
  }

  function toggleActivated() {
    const next = !activated;
    setActivated(next);
    startTransition(async () => {
      const result = await saveWeatherContingency(initial.gatheringId, plan, next);
      if (!result.ok) { setActivated(!next); return setMessage(result.message); }
      if (result.status) setStatus(result.status as WeatherWorkspace["status"]);
    });
  }

  return (
    <section className="mt-5 rounded-2xl border border-sage/25 bg-offwhite p-6 sm:p-7">
      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-forest/55">Weather & Plan B</p>
      <div className="mt-2 h-px w-10 bg-gold" aria-hidden />
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-2xl text-forest">Ready for whatever the day does.</h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">Weather stays secondary until it can actually change the plan. For outdoor gatherings, check the real forecast and decide on a backup only when there’s something worth handling.</p>
        </div>
        <p className="rounded-full bg-parchment px-4 py-2 font-body text-xs font-semibold text-forest/70">{statusCopy(status)}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <label>
          <span className="font-body text-xs font-semibold text-forest/75">Where will people gather?</span>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as WeatherEnvironment)} disabled={initial.readOnly || isPending} className="mt-2 w-full rounded-xl border border-sage/35 bg-cream px-3.5 py-3 font-body text-sm text-forest">
            <option value="unknown">Not decided yet</option><option value="indoors">Indoors</option><option value="outdoors">Outdoors</option><option value="indoor_outdoor">Indoor + outdoor</option>
          </select>
        </label>
        <label>
          <span className="font-body text-xs font-semibold text-forest/75">Hosting city</span>
          <div className="mt-2 flex gap-2">
            <input value={city} onChange={(e) => setCity(e.target.value)} disabled={initial.readOnly || isPending} placeholder="Nashville, TN" className="min-w-0 flex-1 rounded-xl border border-sage/35 bg-cream px-3.5 py-3 font-body text-sm text-forest" />
            <button type="button" onClick={saveLocation} disabled={initial.readOnly || isPending} className="rounded-xl bg-forest px-4 font-body text-sm font-semibold text-offwhite disabled:opacity-50">{isPending ? "Checking…" : "Save & check"}</button>
          </div>
        </label>
      </div>

      {outdoorish && forecast && (
        <div className="mt-5 rounded-2xl border border-sage/25 bg-parchment p-5">
          {forecast.available ? <>
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-display text-xl text-forest">{forecast.conditions}</p><p className="mt-1 font-body text-sm text-forest/65">{forecast.temperature != null ? `${forecast.temperature}°F` : ""}{forecast.precipitationChance != null ? ` · ${forecast.precipitationChance}% chance of precipitation` : ""}</p></div><button type="button" onClick={refresh} disabled={initial.readOnly || isPending} className="font-body text-xs font-semibold text-forest/70 underline decoration-gold decoration-2 underline-offset-4">Refresh forecast</button></div>
            {initial.premium && forecast.detailedForecast && <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">{forecast.detailedForecast}</p>}
          </> : <p className="font-body text-sm text-forest/65">{forecast.reason === "beyond_forecast_horizon" ? "The reliable forecast window isn’t here yet. We’ll keep weather quiet until it is." : "A forecast isn’t available for this gathering yet."}</p>}
        </div>
      )}

      {outdoorish && unresolved && !initial.premium && (
        <div className="mt-5 rounded-2xl border border-gold/35 bg-parchment p-5"><p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-forest/55">Premium planning</p><h3 className="mt-2 font-display text-xl text-forest">Turn the forecast into a Plan B.</h3><p className="mt-2 font-body text-sm leading-relaxed text-forest/70">A Gathering Pass or Place & Plenty Plus adds structured weather contingency planning and weather-aware planning intelligence.</p></div>
      )}

      {outdoorish && unresolved && initial.premium && (
        <div className="mt-5"><h3 className="font-display text-xl text-forest">Plan B</h3><p className="mt-1 font-body text-sm text-forest/65">Choose only what you’d actually do. A small weather risk should not create a giant new checklist.</p><div className="mt-4 flex flex-wrap gap-2">{ACTIONS.map((action) => { const selected=plan.some((p)=>p.category===action.category&&p.actionKey===action.actionKey); return <button key={`${action.category}:${action.actionKey}`} type="button" onClick={()=>toggleAction({category:action.category,actionKey:action.actionKey})} disabled={initial.readOnly||isPending} className={`rounded-full border px-3 py-2 font-body text-xs font-semibold ${selected?"border-forest bg-forest text-offwhite":"border-sage/40 bg-cream text-forest/75"}`}>{action.label}</button>; })}</div><button type="button" onClick={toggleActivated} disabled={initial.readOnly||isPending||plan.length===0} className={`mt-4 rounded-full px-5 py-2.5 font-body text-sm font-semibold ${activated?"bg-sage text-forest":"bg-forest text-offwhite"} disabled:opacity-45`}>{activated?"Plan B is active":"Activate Plan B"}</button></div>
      )}

      {guestDraft && <div className="mt-5 rounded-2xl border border-sage/25 bg-cream p-5"><p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-forest/55">Guest update draft</p><p className="mt-2 font-body text-sm leading-relaxed text-forest/75">{guestDraft}</p></div>}
      {initial.readOnly && <p className="mt-4 font-body text-xs text-forest/55">This finished gathering is preserved as read-only.</p>}
      {message && <p role="status" className="mt-4 font-body text-sm text-forest/70">{message}</p>}
    </section>
  );
}
