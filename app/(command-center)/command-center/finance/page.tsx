import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { clampDays } from "@/lib/admin/overview";
import { parseFinancial } from "@/lib/admin/cc";
import { dollars } from "@/lib/admin/hc";

// FINANCIAL REPORTING (read-only). Shows only what the database stores: purchase counts by product, referred-purchase amounts and the
// Hosting Collective commission and payout ledger. Gross revenue is NOT stored here (Stripe and the app stores hold it), and this page
// says so instead of estimating it.
export default async function FinancePage({ searchParams }: { searchParams: { days?: string | string[] } }) {
  const days = clampDays(searchParams.days);
  const { supabase } = await requireStaff("revenue.read", "/command-center/finance");
  const { data, error } = await supabase.rpc("admin_financial_summary", { p_days: days });
  const f = error ? null : parseFinancial(data);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl text-forest">Financial summary</h1>
        <nav aria-label="Time window" className="flex gap-2 text-sm">{[7, 30, 90].map((d) => (
          <Link key={d} href={`/command-center/finance?days=${d}`} aria-current={d === days ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${d === days ? "border-forest bg-forest text-parchment" : "border-forest/30 text-forest"}`}>{d} days</Link>))}</nav>
      </div>
      {!f ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p> : (
        <>
          <p role="note" className="rounded-lg border border-forest/20 bg-cream p-3 text-sm">{f.revenueNote} Use Stripe and the app store reports for revenue.</p>
          <section aria-labelledby="p"><h2 id="p" className="mb-2 font-display text-xl text-forest">Production purchases, last {f.windowDays} days</h2>
            {f.products.length === 0 ? <p className="text-sm text-charcoal/70">No purchases in this window.</p> : (
              <div className="overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm"><thead className="bg-cream"><tr>{["Product", "Paid", "Refunded"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>{f.products.map((p) => <tr key={p.product} className="border-t border-forest/10"><td className="px-3 py-2">{p.product.replace(/_/g, " ")}</td><td className="px-3 py-2 tabular-nums">{p.paid ?? "n/a"}</td><td className="px-3 py-2 tabular-nums">{p.refunded ?? "n/a"}</td></tr>)}</tbody></table></div>)}</section>
          <section aria-labelledby="r"><h2 id="r" className="mb-2 font-display text-xl text-forest">Referred purchases and creator commissions</h2>
            {!f.referred ? <p className="text-sm text-charcoal/70">Not available until the referral package is applied.</p> : (
              <ul className="space-y-1 text-sm"><li>Referred purchases recorded: <span className="tabular-nums">{f.referred.purchases ?? "n/a"}</span> (pre-tax subtotal {dollars(f.referred.subtotalCents)})</li>
                {(f.commissionStates ?? []).map((c) => <li key={c.state}>Commissions {c.state}: {c.n} / {dollars(c.cents)}</li>)}
                {(f.payoutStatuses ?? []).map((c) => <li key={c.status}>Payouts {c.status}: {c.n} / {dollars(c.cents)}</li>)}</ul>)}</section>
        </>)}
    </div>
  );
}
