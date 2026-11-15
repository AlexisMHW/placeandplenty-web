// COMMAND CENTER OPERATIONS MODULE (phase 2): pure parsers and form validators. No imports, no I/O.
// Every figure comes from a database function that re-checks the caller's permission (see supabase/migrations 215000);
// nothing here estimates or invents data. Malformed or missing fields become null and the page says "not available".

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- alerts (admin_alerts) ----
export type AlertSeverity = "action" | "review";
export interface AlertRow { key: string; severity: AlertSeverity; count: number; text: string; href: string }
// Permission needed to open each alert target; used to hide links a staff member could not open anyway (they would only see a 404).
export const ALERT_HREF_PERMISSION: Record<string, string> = {
  "/command-center/purchases": "support.read", "/command-center/hosting-collective/payouts": "hc.payout",
  "/command-center/hosting-collective/applications": "hc.read", "/command-center/comms": "ops.read",
};
export function visibleAlerts(alerts: AlertRow[], permissions: readonly string[]): AlertRow[] {
  return alerts.filter((a) => permissions.includes(ALERT_HREF_PERMISSION[a.href] ?? "__none__"));
}
const ALERT_HREFS = Object.keys(ALERT_HREF_PERMISSION);
export function parseAlerts(raw: unknown): AlertRow[] | null {
  const r = rec(raw);
  if (!r || !Array.isArray(r.alerts)) return null;
  const out: AlertRow[] = [];
  for (const a of r.alerts) {
    const o = rec(a);
    if (!o) continue;
    const key = str(o.key), text = str(o.text), count = int(o.count);
    const href = str(o.href);
    // only same-site Command Center links are ever rendered
    if (!key || !text || count === null || !href || !ALERT_HREFS.includes(href)) continue;
    out.push({ key, text, count, href, severity: o.severity === "action" ? "action" : "review" });
  }
  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "action" ? -1 : 1));
}

// ---- growth funnel (growth_funnel_summary, staff growth.read) ----
export interface GrowthFunnel { windowFrom: string | null; windowTo: string | null; stages: { key: string; label: string; count: number | null }[]; flags: { key: string; label: string; count: number | null }[]; notes: string[] }
const STAGES: [string, string][] = [
  ["registered", "Created an account"], ["email_confirmed", "Confirmed email"], ["signed_in_approx", "Signed in (approximate)"],
  ["gathering_created", "Created a gathering"], ["planning_action", "Took a planning action"], ["invitation_activity", "Invitation activity"],
  ["rsvp_received", "Received an RSVP"], ["paid_conversion", "Paid (production, not refunded)"], ["repeat_host", "Hosted twice or more"],
];
const FLAGS: [string, string][] = [
  ["unconfirmed_older_than_7d", "Unconfirmed for more than 7 days"], ["confirmed_never_created_gathering_older_than_14d", "Confirmed, no gathering after 14 days"],
];
export function parseGrowthFunnel(raw: unknown): GrowthFunnel | null {
  const r = rec(raw);
  if (!r) return null;
  const w = rec(r.window);
  if (int(r.registered) === null) return null;
  return {
    windowFrom: str(w?.from), windowTo: str(w?.to),
    stages: STAGES.map(([key, label]) => ({ key, label, count: int(r[key]) })),
    flags: FLAGS.map(([key, label]) => ({ key, label, count: int(r[key]) })),
    notes: Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === "string") : [],
  };
}
/** Share of the first stage; null when the first stage is 0 or unknown (no divide-by-zero, no invented 0%). */
export function pctOfFirst(count: number | null, first: number | null): string {
  if (count === null || first === null || first <= 0) return "n/a";
  return `${Math.round((count / first) * 100)}%`;
}
export function growthWindow(daysParam: string | string[] | undefined, now: Date): { from: string; to: string; days: number } {
  const raw = Array.isArray(daysParam) ? daysParam[0] : daysParam;
  const d = Number(raw);
  const days = [7, 30, 90].includes(d) ? d : 30;
  return { days, from: new Date(now.getTime() - days * 86400000).toISOString(), to: now.toISOString() };
}

// ---- support: entitlement lookup (admin_entitlement_lookup) ----
export interface LookupEntitlement { id: string; product: string; provider: string | null; environment: string | null; active: boolean; purchasedAt: string | null; expiresAt: string | null; refundedAt: string | null; revokedAt: string | null }
export type LookupResult = { found: false } | { found: true; userId: string; emailMasked: string; createdAt: string | null; emailConfirmed: boolean; entitlements: LookupEntitlement[]; events: { type: string; source: string | null; reason: string | null; createdAt: string | null }[] | null }
export function parseLookup(raw: unknown): LookupResult | null {
  const r = rec(raw);
  if (!r) return null;
  if (r.found !== true) return r.found === false ? { found: false } : null;
  const userId = str(r.user_id), email = str(r.email_masked);
  if (!userId || !email) return null;
  const ents = Array.isArray(r.entitlements) ? r.entitlements : [];
  return {
    found: true, userId, emailMasked: email, createdAt: str(r.created_at), emailConfirmed: r.email_confirmed === true,
    entitlements: ents.flatMap((e) => { const o = rec(e); const id = str(o?.id); if (!o || !id) return []; return [{
      id, product: str(o.canonical_product_id) ?? str(o.entitlement_type) ?? "unknown", provider: str(o.provider), environment: str(o.environment),
      active: o.active === true, purchasedAt: str(o.purchased_at), expiresAt: str(o.expires_at), refundedAt: str(o.refunded_at), revokedAt: str(o.revoked_at) }]; }),
    events: Array.isArray(r.events) ? r.events.flatMap((e) => { const o = rec(e); const t = str(o?.event_type); return o && t ? [{ type: t, source: str(o.source), reason: str(o.reason), createdAt: str(o.created_at) }] : []; }) : null,
  };
}
/** Plain-language status of one entitlement row. Refund/revocation beat "active"; nothing is inferred beyond the stored columns. */
export function entitlementStatus(e: LookupEntitlement, now: Date): string {
  if (e.refundedAt) return "refunded";
  if (e.revokedAt) return "revoked";
  if (!e.active) return "inactive";
  if (e.expiresAt && new Date(e.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}
export function parseLookupForm(form: { get(name: string): unknown }): { ok: true; query: string } | { ok: false; error: string } {
  const v = form.get("q");
  const q = typeof v === "string" ? v.trim() : "";
  if (q.length < 3 || q.length > 254) return { ok: false, error: "invalid_query" };
  if (!UUID.test(q) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q)) return { ok: false, error: "invalid_query" };
  return { ok: true, query: q };
}

// ---- purchase events (admin_purchase_events) ----
export interface PurchaseEvent { id: string; type: string; source: string | null; reason: string | null; userId: string | null; txn: string | null; createdAt: string | null }
export function parsePurchaseEvents(raw: unknown): { available: boolean; rows: PurchaseEvent[]; kinds: string[] } | null {
  const r = rec(raw);
  if (!r) return null;
  if (r.available === false) return { available: false, rows: [], kinds: [] };
  if (!Array.isArray(r.rows)) return null;
  return {
    available: true,
    rows: r.rows.flatMap((x) => { const o = rec(x); const id = str(o?.id), t = str(o?.event_type); return o && id && t ? [{ id, type: t, source: str(o.source), reason: str(o.reason), userId: str(o.user_id), txn: str(o.provider_transaction_id), createdAt: str(o.created_at) }] : []; }),
    kinds: Array.isArray(r.kinds) ? r.kinds.filter((k): k is string => typeof k === "string" && /^[a-z_]{2,40}$/.test(k)) : [],
  };
}
export function parseKindParam(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && /^[a-z_]{2,40}$/.test(s) ? s : null;
}

// ---- comms monitor and integration health ----
export interface CommsMonitor { emailAvailable: boolean; emailEvents7d: Record<string, number>; suppressed: Record<string, number>; deliveries7d: Record<string, number> | null; smsAvailable: boolean; smsEnabled: boolean | null; smsKillSwitch: boolean | null; smsMessages7d: Record<string, number> | null }
const counts = (v: unknown): Record<string, number> => { const o = rec(v); const out: Record<string, number> = {}; if (o) for (const [k, n] of Object.entries(o)) { const c = int(n); if (c !== null && c >= 0) out[k] = c; } return out; };
export function parseComms(raw: unknown): CommsMonitor | null {
  const r = rec(raw); const e = rec(r?.email); const s = rec(r?.sms);
  if (!r || !e || !s) return null;
  const flags = rec(s.flags);
  return {
    emailAvailable: e.available === true, emailEvents7d: counts(e.provider_events_7d), suppressed: counts(e.suppressed_by_reason),
    deliveries7d: e.deliveries_7d === undefined ? null : counts(e.deliveries_7d),
    smsAvailable: s.available === true, smsEnabled: typeof flags?.sms_enabled === "boolean" ? flags.sms_enabled : null,
    smsKillSwitch: typeof flags?.kill_switch === "boolean" ? flags.kill_switch : null, smsMessages7d: s.messages_7d === undefined ? null : counts(s.messages_7d),
  };
}
/** "Sending is off" only when the database says SMS is disabled OR the kill switch is on. Unknown stays unknown. */
export function smsState(c: CommsMonitor): "off" | "on" | "unknown" {
  if (!c.smsAvailable) return "unknown";
  if (c.smsKillSwitch === true || c.smsEnabled === false) return "off";
  if (c.smsEnabled === true && c.smsKillSwitch === false) return "on";
  return "unknown";
}
export interface HealthRow { label: string; value: string; tone: "ok" | "watch" | "unknown" }
export function parseHealth(raw: unknown, now: Date): HealthRow[] | null {
  const r = rec(raw);
  if (!r || str(r.error)) return null;
  const rows: HealthRow[] = [];
  const age = (iso: string | null): { text: string; hours: number | null } => {
    if (!iso) return { text: "no event recorded", hours: null };
    const h = (now.getTime() - new Date(iso).getTime()) / 3600000;
    return { text: h < 1 ? "less than an hour ago" : h < 48 ? `${Math.floor(h)} hours ago` : `${Math.floor(h / 24)} days ago`, hours: h };
  };
  const pl = rec(r.payment_ledger), ee = rec(r.entitlement_events), hc = rec(r.hosting_collective);
  if (pl?.available === true) {
    const s = age(str(pl.last_stripe_event_at)), rc = age(str(pl.last_revenuecat_event_at));
    rows.push({ label: "Last Stripe purchase event", value: s.text, tone: s.hours === null ? "unknown" : "ok" });
    rows.push({ label: "Last RevenueCat (app store) event", value: rc.text, tone: rc.hours === null ? "unknown" : "ok" });
    const bad = int(pl.unusual_outcomes_24h);
    rows.push({ label: "Unusual payment-event outcomes, last 24h", value: bad === null ? "not available" : String(bad), tone: bad === null ? "unknown" : bad > 0 ? "watch" : "ok" });
  } else rows.push({ label: "Payment event ledger", value: "not available in this environment", tone: "unknown" });
  if (ee?.available === true) {
    const w = age(str(ee.last_web_event_at)); const rej = int(ee.rejected_24h);
    rows.push({ label: "Last web purchase entitlement event", value: w.text, tone: w.hours === null ? "unknown" : "ok" });
    rows.push({ label: "Rejected grants, last 24h", value: rej === null ? "not available" : String(rej), tone: rej === null ? "unknown" : rej > 0 ? "watch" : "ok" });
  }
  if (hc) rows.push({ label: "Hosting Collective program", value: hc.program_enabled === true ? "switched on" : "switched off", tone: "ok" });
  rows.push({ label: "External dashboards (Stripe, RevenueCat, Supabase, email provider)", value: "not read here: this page reads only our own database", tone: "unknown" });
  return rows;
}

// ---- financial summary ----
export interface FinancialSummary { windowDays: number; products: { product: string; paid: number | null; refunded: number | null }[]; revenueNote: string; referred: { purchases: number | null; subtotalCents: number | null } | null; commissionStates: { state: string; n: number; cents: number }[] | null; payoutStatuses: { status: string; n: number; cents: number }[] | null }
const grouped = (v: unknown, keyName: "state" | "status") => { const o = rec(v); if (!o) return null; return Object.entries(o).flatMap(([k, x]) => { const p = rec(x); const n = int(p?.n), c = int(p?.cents); return n !== null && c !== null ? [{ [keyName]: k, n, cents: c } as any] : []; }); };
export function parseFinancial(raw: unknown): FinancialSummary | null {
  const r = rec(raw);
  if (!r || int(r.window_days) === null) return null;
  const p = rec(r.purchases_by_product) ?? {};
  const ref = rec(r.referred_purchases); const liab = rec(r.hosting_collective_liability);
  return {
    windowDays: int(r.window_days)!,
    products: Object.entries(p).flatMap(([k, v]) => { const o = rec(v); return o ? [{ product: k, paid: int(o.paid), refunded: int(o.refunded) }] : []; }),
    // The database says revenue amounts are not stored; this page must never fill them in.
    revenueNote: str(r.revenue_amounts_note) ?? "Revenue amounts are not stored in this database.",
    referred: ref?.available === true ? { purchases: int(ref.referred_purchases), subtotalCents: int(ref.referred_subtotal_cents) } : null,
    commissionStates: liab?.available === true ? grouped(liab.commissions_by_state, "state") : null,
    payoutStatuses: liab?.available === true ? grouped(liab.payouts_by_status, "status") : null,
  };
}

// ---- payouts (hc_admin_list_payouts + action forms) ----
export interface PayoutRow { id: string; partnerId: string; displayName: string; totalCents: number; status: "draft" | "approved" | "paid" | "void" | "reversed"; createdAt: string | null; approvedAt: string | null; paidAt: string | null; paidOn: string | null; externalRef: string | null; voidReason: string | null; reversalReason: string | null; reversedAt: string | null; method: string | null }
export function parsePayouts(raw: unknown): PayoutRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const id = str(o?.id), pid = str(o?.partner_id), total = int(o?.total_cents);
    const status = ["draft", "approved", "paid", "void", "reversed"].find((s) => s === o?.status) as PayoutRow["status"] | undefined;
    return o && id && pid && total !== null && status ? [{ id, partnerId: pid, displayName: str(o.display_name) ?? "(no name)", totalCents: total, status, createdAt: str(o.created_at), approvedAt: str(o.approved_at), paidAt: str(o.paid_at), paidOn: str(o.paid_on), externalRef: str(o.external_ref), voidReason: str(o.void_reason), reversalReason: str(o.reversed_reason), reversedAt: str(o.reversed_at), method: str(o.external_method) }] : []; });
}
export type PayoutAction = { kind: "draft"; partnerId: string } | { kind: "approve"; payoutId: string } | { kind: "paid"; payoutId: string; externalRef: string; paidOn: string; method: string } | { kind: "void"; payoutId: string; reason: string } | { kind: "reverse"; payoutId: string; reason: string };
export function parsePayoutActionForm(form: { get(name: string): unknown }, today: Date = new Date()): { ok: true; value: PayoutAction } | { ok: false; error: string } {
  const g = (k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim() : ""; };
  const kind = g("kind");
  if (kind === "draft") { const partnerId = g("partner_id"); return UUID.test(partnerId) ? { ok: true, value: { kind, partnerId } } : { ok: false, error: "invalid_id" }; }
  if (kind !== "approve" && kind !== "paid" && kind !== "void" && kind !== "reverse") return { ok: false, error: "invalid_kind" };
  const payoutId = g("payout_id");
  if (!UUID.test(payoutId)) return { ok: false, error: "invalid_id" };
  if (kind === "approve") return { ok: true, value: { kind, payoutId } };
  if (kind === "paid") {
    const externalRef = g("external_ref");
    // The reference records a transfer made OUTSIDE this system. It must be present and plain text.
    if (externalRef.length < 4 || externalRef.length > 120 || /[<>]/.test(externalRef)) return { ok: false, error: "invalid_reference" };
    const method = g("method");
    if (method.length < 2 || method.length > 60 || /[<>]/.test(method)) return { ok: false, error: "invalid_method" };
    // The date the owner sent the payment outside this system: not in the future, not older than a year (the database repeats both checks).
    const paidOn = g("paid_on");
    const d = /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? new Date(`${paidOn}T00:00:00Z`) : null;
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== paidOn || d.getTime() > todayUtc || todayUtc - d.getTime() > 365 * 86400000) return { ok: false, error: "invalid_paid_on" };
    if (g("confirm") !== "yes") return { ok: false, error: "confirmation_required" };
    return { ok: true, value: { kind, payoutId, externalRef, paidOn, method } };
  }
  if (kind === "reverse") {
    const reason = g("reason");
    if (reason.length < 3 || reason.length > 200) return { ok: false, error: "invalid_reason" };
    if (g("confirm") !== "yes") return { ok: false, error: "confirmation_required" };
    return { ok: true, value: { kind, payoutId, reason } };
  }
  if (kind === "void") {
    const reason = g("reason");
    if (reason.length < 3 || reason.length > 200) return { ok: false, error: "invalid_reason" };
    return { ok: true, value: { kind, payoutId, reason } };
  }
  return { ok: false, error: "invalid_kind" };
}
export interface TermsInput { amounts: Record<string, number>; validationDays: number; minPayoutCents: number; effectiveFrom: string; note: string | null }
export function parseTermsForm(form: { get(name: string): unknown }, now: Date): { ok: true; value: TermsInput } | { ok: false; error: string } {
  const g = (k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim() : ""; };
  if (g("confirm") !== "yes") return { ok: false, error: "confirmation_required" };
  const amounts: Record<string, number> = {};
  for (const [field, product] of [["amount_gathering_pass", "gathering_pass"], ["amount_plus_annual", "plus_annual"]] as const) {
    const raw = g(field);
    if (raw === "") continue;           // blank = carry the current amount forward (database rule)
    if (!/^\d{1,6}$/.test(raw)) return { ok: false, error: "invalid_amount" };
    amounts[product] = Number(raw);
  }
  if (Object.keys(amounts).length === 0) return { ok: false, error: "invalid_amounts" };
  const vd = Number(g("validation_days")), mp = Number(g("min_payout_cents"));
  if (!Number.isInteger(vd) || vd < 1 || vd > 180) return { ok: false, error: "invalid_validation_days" };
  if (!Number.isInteger(mp) || mp < 0 || mp > 10000000) return { ok: false, error: "invalid_min_payout" };
  const eff = new Date(g("effective_from"));
  if (Number.isNaN(eff.getTime()) || eff.getTime() <= now.getTime()) return { ok: false, error: "terms_must_be_effective_in_the_future" };
  const note = g("note");
  if (note.length > 300) return { ok: false, error: "note_too_long" };
  return { ok: true, value: { amounts, validationDays: vd, minPayoutCents: mp, effectiveFrom: eff.toISOString(), note: note || null } };
}
