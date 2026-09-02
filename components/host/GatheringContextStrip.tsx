import { createClient } from "@/lib/supabase-server";

function statusLabel(status: string) {
  switch (status) {
    case "draft": return "Draft";
    case "active": return "Planning";
    case "hosting": return "Hosting now";
    case "completed": return "Finished";
    case "cancelled": return "Cancelled";
    case "archived": return "Archived";
    default: return status;
  }
}

function weatherLabel(status: string | null, environment: string | null) {
  if (!environment || environment === "indoors" || environment === "unknown") return null;
  switch (status) {
    case "clear": return "Weather looks good";
    case "watch": return "Keep an eye on weather";
    case "risk": return "Weather needs a Plan B";
    case "covered": return "Weather plan covered";
    default: return "Weather check available";
  }
}

export default async function GatheringContextStrip({
  gatheringId,
  effectiveStatus,
}: {
  gatheringId: string;
  effectiveStatus: string;
}) {
  const supabase = createClient();
  const [{ data: details }, { data: entitlements }] = await Promise.all([
    supabase
      .from("gatherings")
      .select("weather_status, gathering_environment")
      .eq("id", gatheringId)
      .maybeSingle(),
    supabase
      .from("gathering_entitlements")
      .select("scope, entitlement_type, active")
      .eq("active", true),
  ]);

  const plus = (entitlements ?? []).some(
    (e) => e.scope === "account" && e.entitlement_type === "plus"
  );
  const pass = (entitlements ?? []).some(
    (e) => e.scope === "gathering" && e.entitlement_type === "gathering_pass"
  );
  const weather = weatherLabel(
    details?.weather_status ?? null,
    details?.gathering_environment ?? null
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 font-body text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
      <span className="rounded-full border border-sage/35 bg-offwhite px-3 py-1.5 text-forest/75">
        {statusLabel(effectiveStatus)}
      </span>
      <span className="rounded-full border border-gold/35 bg-cream px-3 py-1.5 text-forest/75">
        {plus ? "Plus" : pass ? "Gathering Pass" : "Free"}
      </span>
      {weather && (
        <span className="rounded-full border border-sage/30 bg-parchment px-3 py-1.5 text-forest/65">
          {weather}
        </span>
      )}
    </div>
  );
}
