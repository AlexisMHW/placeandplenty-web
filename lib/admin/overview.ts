// Parsing and presentation helpers for admin_business_overview(). Pure, no imports.
// The database returns counts only (no emails, names or amounts). This file never invents numbers:
// a missing or malformed field becomes null and the page says "not available".

export interface FunnelCounts {
  registered: number;
  email_confirmed: number;
  signed_in: number;
  created_gathering: number;
  locked_in_gathering: number;
  shared_an_invitation: number;
  paid: number;
}

export interface BusinessOverview {
  windowDays: number;
  generatedAt: string | null;
  funnel: FunnelCounts;
  activity: {
    gatherings_created: number | null;
    gatherings_locked_in: number | null;
    households_first_shared: number | null;
    repeat_hosts_all_time: number | null;
    total_accounts_all_time: number | null;
  };
  paidPurchases: Record<string, number>;
  refundsInWindow: number | null;
  hostingCollectiveAvailable: boolean;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export function parseOverview(raw: unknown): BusinessOverview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const f = r.cohort_funnel;
  if (!f || typeof f !== "object") return null;
  const funnelKeys: (keyof FunnelCounts)[] = [
    "registered", "email_confirmed", "signed_in", "created_gathering",
    "locked_in_gathering", "shared_an_invitation", "paid",
  ];
  const funnel = {} as FunnelCounts;
  for (const k of funnelKeys) {
    const v = num(f[k]);
    if (v === null) return null;
    funnel[k] = v;
  }
  const a = r.window_activity ?? {};
  const paid: Record<string, number> = {};
  if (r.paid_purchases_in_window && typeof r.paid_purchases_in_window === "object") {
    for (const [k, v] of Object.entries(r.paid_purchases_in_window)) {
      const n = num(v);
      if (n !== null) paid[k] = n;
    }
  }
  return {
    windowDays: num(r.window_days) ?? 30,
    generatedAt: typeof r.generated_at === "string" ? r.generated_at : null,
    funnel,
    activity: {
      gatherings_created: num(a.gatherings_created),
      gatherings_locked_in: num(a.gatherings_locked_in),
      households_first_shared: num(a.households_first_shared),
      repeat_hosts_all_time: num(a.repeat_hosts_all_time),
      total_accounts_all_time: num(a.total_accounts_all_time),
    },
    paidPurchases: paid,
    refundsInWindow: num(r.refunds_in_window),
    hostingCollectiveAvailable: r.hosting_collective?.status === "available",
  };
}

export interface FunnelRow {
  key: keyof FunnelCounts;
  label: string;
  count: number;
  /** Share of everyone who registered, or null when nobody registered (never divide by zero). */
  percentOfRegistered: number | null;
}

const LABELS: Record<keyof FunnelCounts, string> = {
  registered: "Registered",
  email_confirmed: "Email confirmed",
  signed_in: "Signed in",
  created_gathering: "Created a gathering",
  locked_in_gathering: "Locked in a gathering",
  shared_an_invitation: "Shared an invitation",
  paid: "Paid (web, Apple or Google, live)",
};

export function funnelRows(f: FunnelCounts): FunnelRow[] {
  return (Object.keys(LABELS) as (keyof FunnelCounts)[]).map((key) => ({
    key,
    label: LABELS[key],
    count: f[key],
    percentOfRegistered: f.registered > 0 ? Math.round((f[key] / f.registered) * 1000) / 10 : null,
  }));
}

export function clampDays(raw: string | string[] | undefined): 7 | 30 | 90 {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "7" ? 7 : v === "90" ? 90 : 30;
}
