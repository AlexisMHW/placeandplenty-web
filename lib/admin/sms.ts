// COMMAND CENTER SMS REPORT (agent A9). Pure parser for the database function cc_sms_report (staff ops.read; SQL step SMS-5).
// Aggregates only: no phone numbers (masked last four on recent failures), no message text, no hashes. Malformed or missing
// fields become null / empty and the page says "not available". Prices are ROWS (sms_segment_prices): nothing here hard-codes a price.

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
function counts(v: unknown): Record<string, number> {
  const r = rec(v); const out: Record<string, number> = {};
  if (r) for (const [k, n] of Object.entries(r)) if (/^[A-Za-z0-9_.:-]{1,60}$/.test(k) && typeof n === "number" && Number.isFinite(n)) out[k] = n;
  return out;
}

export interface SmsPriceRow { provider: string; numberType: string; direction: string; unitMicroUsd: number; carrierFeeMicroUsd: number; note: string | null }
export interface SmsReport {
  windowDays: number; smsEnabled: boolean | null; killSwitch: boolean | null;
  messages: number; segmentsNet: number; estCostMicroUsd: number;
  byStatus: Record<string, number>; blockedByReason: Record<string, number>; failuresByError: Record<string, number>;
  reachedProvider: number; delivered: number; failed: number; deliveryRate: number | null;
  optOutEvents: number; suppressedTotal: number; suppressedByReason: Record<string, number>;
  perPlan: { planKey: string; segments: number; messages: number }[];
  prices: SmsPriceRow[];
  recentFailures: { messageId: string; kind: string; errorCode: string | null; phoneMasked: string; at: string | null }[];
  daily: { day: string; messages: number; delivered: number }[];
}

/** Masks anything that looks like a phone number down to the last four digits; the database already sends "***-1234". */
export function maskedPhone(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  const m = s.match(/(\d{4})\s*$/);
  return m ? `***-${m[1]}` : "***-****";
}

export function parseSmsReport(raw: unknown): SmsReport | null {
  const r = rec(raw);
  if (!r) return null;
  const totals = rec(r.totals), delivery = rec(r.delivery), opt = rec(r.opt_outs), flags = rec(r.flags);
  if (!totals || !delivery || !opt) return null;
  const rate = num(delivery.delivery_rate);
  return {
    windowDays: num(r.window_days) ?? 30,
    smsEnabled: typeof flags?.sms_enabled === "boolean" ? flags.sms_enabled : null,
    killSwitch: typeof flags?.kill_switch === "boolean" ? flags.kill_switch : null,
    messages: num(totals.messages) ?? 0, segmentsNet: num(totals.segments_net) ?? 0, estCostMicroUsd: num(totals.est_cost_microusd) ?? 0,
    byStatus: counts(r.by_status), blockedByReason: counts(r.blocked_by_reason), failuresByError: counts(r.failures_by_error),
    reachedProvider: num(delivery.reached_provider) ?? 0, delivered: num(delivery.delivered) ?? 0, failed: num(delivery.failed) ?? 0,
    deliveryRate: rate !== null && rate >= 0 && rate <= 1 ? rate : null,
    optOutEvents: num(opt.opt_out_events) ?? 0, suppressedTotal: num(opt.suppressed_total) ?? 0, suppressedByReason: counts(opt.suppressed_by_reason),
    perPlan: (Array.isArray(r.per_plan) ? r.per_plan : []).flatMap((x) => { const o = rec(x); const k = str(o?.plan_key); return o && k ? [{ planKey: k, segments: num(o.segments) ?? 0, messages: num(o.messages) ?? 0 }] : []; }),
    prices: (Array.isArray(r.prices) ? r.prices : []).flatMap((x) => {
      const o = rec(x); const p = str(o?.provider), n = str(o?.number_type), d = str(o?.direction), u = num(o?.unit_microusd);
      return o && p && n && d && u !== null ? [{ provider: p, numberType: n, direction: d, unitMicroUsd: u, carrierFeeMicroUsd: num(o.carrier_fee_microusd) ?? 0, note: str(o.note) }] : [];
    }),
    recentFailures: (Array.isArray(r.recent_failures) ? r.recent_failures : []).slice(0, 20).flatMap((x) => {
      const o = rec(x); const id = str(o?.message_id);
      return o && id ? [{ messageId: id.slice(0, 8), kind: str(o.kind) ?? "unknown", errorCode: str(o.error_code), phoneMasked: maskedPhone(o.phone_masked), at: str(o.at) }] : [];
    }),
    daily: (Array.isArray(r.daily) ? r.daily : []).flatMap((x) => { const o = rec(x); const d = str(o?.day); return o && d ? [{ day: d.slice(0, 10), messages: num(o.messages) ?? 0, delivered: num(o.delivered) ?? 0 }] : []; }),
  };
}

/** micro-USD -> "$0.0085" style text (4 decimals for unit prices, 2 for totals). */
export function formatMicroUsd(micro: number, digits = 4): string { return `$${(micro / 1_000_000).toFixed(digits)}`; }
export function formatRate(rate: number | null): string { return rate === null ? "not enough data" : `${(rate * 100).toFixed(1)}%`; }

/** Estimated cost per plan = net segments x the CURRENT outbound price row (unit + carrier fee). null when there is no price row. */
export function estimatePlanCosts(report: SmsReport): { planKey: string; segments: number; costMicroUsd: number | null }[] {
  const price = report.prices.find((p) => p.direction === "outbound");
  const per = price ? price.unitMicroUsd + price.carrierFeeMicroUsd : null;
  return report.perPlan.map((p) => ({ planKey: p.planKey, segments: p.segments, costMicroUsd: per === null ? null : p.segments * per }));
}

export function parseDaysParam(v: string | string[] | undefined): number {
  const s = Array.isArray(v) ? v[0] : v; const n = Number(s);
  return [7, 30, 90].includes(n) ? n : 30;
}
