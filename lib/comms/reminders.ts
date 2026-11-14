// Reminder planning. CADENCE IS OWNER-CONFIGURED, NEVER DEFAULTED: with no offsets configured, planReminders returns [].
export interface ReminderConfig { offsetsHoursBefore: number[]; minLeadMinutes?: number }
export function planReminders(startsAtIso: string, cfg: ReminderConfig | null | undefined, nowMs: number): { sendAtIso: string; hoursBefore: number }[] {
  if (!cfg || !Array.isArray(cfg.offsetsHoursBefore) || cfg.offsetsHoursBefore.length === 0) return [];
  const start = Date.parse(startsAtIso);
  if (!Number.isFinite(start)) return [];
  const lead = (cfg.minLeadMinutes ?? 0) * 60_000;
  const seen = new Set<number>();
  return cfg.offsetsHoursBefore
    .filter((h) => Number.isFinite(h) && h > 0 && !seen.has(h) && (seen.add(h), true))
    .map((h) => ({ hoursBefore: h, at: start - h * 3_600_000 }))
    .filter((r) => r.at - nowMs >= lead)           // never schedule into the past (or inside the minimum lead)
    .sort((a, b) => a.at - b.at)
    .map((r) => ({ hoursBefore: r.hoursBefore, sendAtIso: new Date(r.at).toISOString() }));
}
