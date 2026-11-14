import { requireStaff } from "@/lib/admin/server";
import { dollars, parseCommissionReport, parsePayoutEligibility } from "@/lib/admin/hc";

// REFERRALS, PENDING COMMISSIONS AND PAYOUT ELIGIBILITY. Read-only. Both database functions re-check hc.read.
// Figures are ledger values. When the program is disabled or no commission rate is configured, a banner says the numbers are not live.
// There is deliberately no payout button: payouts stay manual and need owner economics decisions (hc.payout, owner only).
export default async function PayoutsPage() {
  const { supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/payouts");
  const [elig, report] = await Promise.all([
    supabase.rpc("hc_admin_payout_eligibility"),
    supabase.rpc("hc_admin_commission_report"),
  ]);
  const e = elig.error ? null : parsePayoutEligibility(elig.data);
  const r = report.error ? null : parseCommissionReport(report.data);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Referrals and payout eligibility</h1>
      {!e || !r ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the referral and Hosting Collective database packages are applied.</p>
      ) : (
        <>
          {!e.live ? (
            <p role="status" className="rounded-lg border border-error/40 bg-cream p-4 text-sm">
              Not live: {!e.programEnabled ? "the referral program is switched off" : "no commission rate has been configured"}. Any figures below are not earnings.
            </p>
          ) : null}
          <section aria-labelledby="ref">
            <h2 id="ref" className="mb-2 font-display text-xl text-forest">Referred sign-ups and commissions by state</h2>
            <div className="overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm">
              <thead className="bg-cream"><tr>{["Partner", "Status", "Referred sign-ups", "Pending", "Validated", "Held"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{r.partners.map((p) => (
                <tr key={p.partnerId} className="border-t border-forest/10">
                  <td className="px-3 py-2">{p.displayName}</td><td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 tabular-nums">{p.signups ?? "n/a"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.byState.pending ? `${p.byState.pending.n} / ${dollars(p.byState.pending.cents)}` : "0"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.byState.validated ? `${p.byState.validated.n} / ${dollars(p.byState.validated.cents)}` : "0"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.byState.held ? p.byState.held.n : "0"}</td>
                </tr>))}</tbody></table></div>
          </section>
          <section aria-labelledby="elig">
            <h2 id="elig" className="mb-1 font-display text-xl text-forest">Payout eligibility</h2>
            <p className="mb-2 text-sm text-charcoal/70">Eligible = validated commissions minus outstanding clawbacks reach the minimum ({dollars(e.minPayoutCents)}), program live. Nothing is paid automatically.</p>
            <ul className="space-y-1 text-sm">{e.partners.map((p) => (
              <li key={p.partnerId}>{p.displayName}: validated {dollars(p.validatedCents)}, clawback {dollars(p.outstandingClawbackCents)} — {p.eligible ? "eligible for manual review" : "not eligible"}</li>))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
