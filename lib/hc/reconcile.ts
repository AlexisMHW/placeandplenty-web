// RECONCILIATION: compares purchase facts with the commission ledger and reports every disagreement. Pure. Read-only: it never repairs.
export interface FactRow { entitlementId: string; providerTransactionId: string; subtotalCents: number; refundedAt?: string | null; disputeStatus?: string | null }
export interface CommissionRow { entitlementId: string; state: string; cents: number; providerTransactionId?: string | null }
export type Finding = { kind: "fact_without_commission_review" | "commission_without_fact" | "duplicate_commission" | "refunded_but_not_reversed" | "dispute_open_not_held" | "negative_or_zero_amount"; entitlementId: string; detail: string };

export function reconcileLedger(facts: FactRow[], commissions: CommissionRow[]): { findings: Finding[]; counts: Record<string, number> } {
  const findings: Finding[] = [];
  const factBy = new Map(facts.map((f) => [f.entitlementId, f]));
  const seen = new Map<string, number>();
  for (const c of commissions) {
    seen.set(c.entitlementId, (seen.get(c.entitlementId) ?? 0) + 1);
    const f = factBy.get(c.entitlementId);
    if (!f) findings.push({ kind: "commission_without_fact", entitlementId: c.entitlementId, detail: "ledger row has no purchase facts" });
    if (!Number.isInteger(c.cents) || c.cents <= 0) findings.push({ kind: "negative_or_zero_amount", entitlementId: c.entitlementId, detail: `cents=${c.cents}` });
    if (f?.refundedAt && !["reversed", "void"].includes(c.state)) findings.push({ kind: "refunded_but_not_reversed", entitlementId: c.entitlementId, detail: `state=${c.state}` });
    if (f?.disputeStatus === "open" && !["held", "reversed", "void"].includes(c.state)) findings.push({ kind: "dispute_open_not_held", entitlementId: c.entitlementId, detail: `state=${c.state}` });
  }
  for (const [id, n] of seen) if (n > 1) findings.push({ kind: "duplicate_commission", entitlementId: id, detail: `${n} rows (a second commission on one entitlement is never allowed)` });
  const counts: Record<string, number> = {};
  for (const x of findings) counts[x.kind] = (counts[x.kind] ?? 0) + 1;
  return { findings, counts };
}
