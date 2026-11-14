// MANUAL PAYOUT LEDGER + HISTORY parsers (hc_admin_payout_ledger, hc_admin_payout_history). Pure, no imports, no I/O.
// pending / validated / draft / approved / paid are different numbers and are never added together here.
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export const LEDGER_BUCKETS = ["pending", "validated", "draft", "approved", "paid"] as const;
export type LedgerBucket = (typeof LEDGER_BUCKETS)[number];
export const BUCKET_LABEL: Record<LedgerBucket, string> = {
  pending: "Pending (still in the validation window)",
  validated: "Validated (ready to be put in a draft)",
  draft: "In a payout draft",
  approved: "Approved, not yet paid",
  paid: "Paid (an external payment was recorded)",
};
export interface Ledger {
  totals: Record<LedgerBucket, number> & { unratedCount: number | null; heldCount: number | null; outstandingClawbackCents: number | null };
  partners: ({ partnerId: string; displayName: string; status: string; outstandingClawbackCents: number } & Record<LedgerBucket, number>)[];
  note: string | null;
}
function buckets(o: Record<string, unknown>): Record<LedgerBucket, number> | null {
  const out = {} as Record<LedgerBucket, number>;
  for (const b of LEDGER_BUCKETS) { const n = int(o[`${b}_cents`]); if (n === null) return null; out[b] = n; }
  return out;
}
export function parseLedger(raw: unknown): Ledger | null {
  const o = rec(raw); const t = rec(o?.totals);
  if (!o || !t || !Array.isArray(o.partners)) return null;
  const tb = buckets(t); if (!tb) return null;
  const partners = o.partners.flatMap((x) => { const p = rec(x); const id = str(p?.partner_id); const b = p ? buckets(p) : null;
    return p && id && b ? [{ partnerId: id, displayName: str(p.display_name) ?? "(no name)", status: str(p.status) ?? "unknown", outstandingClawbackCents: int(p.outstanding_clawback_cents) ?? 0, ...b }] : []; });
  return { totals: { ...tb, unratedCount: int(t.unrated_count), heldCount: int(t.held_count), outstandingClawbackCents: int(t.outstanding_clawback_cents) }, partners, note: str(o.note) };
}
export interface HistoryRow { id: string; partnerId: string | null; totalCents: number; status: string; createdAt: string | null; approvedAt: string | null; paidOn: string | null; externalRef: string | null; method: string | null; voidReason: string | null; reversedReason: string | null; commissionCount: number | null; events: { event: string; at: string | null }[] }
/** hc_admin_payout_history (216100): one row per payout with its append-only event list. Names are joined by the page from the ledger. */
export function parseHistory(raw: unknown): HistoryRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const id = str(o?.payout_id); const total = int(o?.total_cents); const status = str(o?.status);
    if (!o || !id || total === null || !status) return [];
    const events = Array.isArray(o.events) ? o.events.flatMap((a) => { const r = rec(a); const event = str(r?.event); return r && event ? [{ event, at: str(r.at) }] : []; }) : [];
    return [{ id, partnerId: str(o.partner_id), totalCents: total, status, createdAt: str(o.created_at), approvedAt: str(o.approved_at), paidOn: str(o.paid_on), externalRef: str(o.external_ref), method: str(o.external_method), voidReason: str(o.void_reason), reversedReason: str(o.reversed_reason), commissionCount: int(o.commissions), events }]; });
}
const EVENT_LABEL: Record<string, string> = { drafted: "Draft created", approved: "Approved (not paid)", payment_recorded: "External payment recorded", voided: "Voided", payment_reversed: "Recorded payment reversed" };
export const eventLabel = (e: string) => EVENT_LABEL[e] ?? "Changed";
/** Plain-language status. "approved" is never presented as paid. */
export function payoutStatusLabel(s: string): string {
  return ({ draft: "Draft (not approved)", approved: "Approved — not paid yet", paid: "Paid (recorded)", void: "Voided", reversed: "Payment reversed" } as Record<string, string>)[s] ?? s;
}
