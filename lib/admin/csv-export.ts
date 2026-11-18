// CSV exports for the manual payout ledger and payout history (accountant / reconciliation). Pure, no imports of runtime code, no I/O.
// - Spreadsheet formula injection is neutralised: a cell that starts with = + - @ tab or CR gets a leading apostrophe (display names and external references are free text).
// - Amounts are whole cents and a dollars column; the five money buckets stay separate columns and are never summed. No emails, no user ids, no tax identifiers.
// - RFC 4180 quoting, CRLF line ends, UTF-8 (a BOM is NOT added so tools do not see it as part of the first header).
import { LEDGER_BUCKETS, eventLabel, payoutStatusLabel, type HistoryRow, type Ledger } from "./payout-ledger.ts";

export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (header: string[], rows: unknown[][]): string => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
const usd = (c: number) => (c / 100).toFixed(2);

export function ledgerCsv(l: Ledger, asOf: string): string {
  const header = ["as_of_utc", "member", "status", ...LEDGER_BUCKETS.flatMap((b) => [`${b}_cents`, `${b}_usd`]), "outstanding_clawback_cents"];
  const rows = l.partners.map((p) => [asOf, p.displayName, p.status, ...LEDGER_BUCKETS.flatMap((b) => [p[b], usd(p[b])]), p.outstandingClawbackCents]);
  return toCsv(header, rows);
}
export function historyCsv(h: HistoryRow[], names: Map<string, string>, asOf: string): string {
  const header = ["as_of_utc", "payout_id", "member", "total_cents", "total_usd", "status", "status_label", "commissions", "created_at", "approved_at", "paid_on", "payment_method", "external_reference", "void_reason", "reversed_reason", "events"];
  const rows = h.map((x) => [asOf, x.id, (x.partnerId && names.get(x.partnerId)) || "", x.totalCents, usd(x.totalCents), x.status, payoutStatusLabel(x.status), x.commissionCount ?? "", x.createdAt ?? "", x.approvedAt ?? "", x.paidOn ?? "", x.method ?? "", x.externalRef ?? "", x.voidReason ?? "", x.reversedReason ?? "",
    x.events.map((e) => `${eventLabel(e.event)}${e.at ? ` ${e.at}` : ""}`).join(" | ")]);
  return toCsv(header, rows);
}
