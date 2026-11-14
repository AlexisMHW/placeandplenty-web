import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { clampDays, funnelRows, parseOverview } from "@/lib/admin/overview";
import { parseAlerts, visibleAlerts } from "@/lib/admin/cc";

// BUSINESS OVERVIEW (Phase 2). Every number comes from one read-only database function,
// admin_business_overview(), which re-checks the caller's permission and returns counts only.
// Nothing here is estimated. Where a figure does not exist it says so.

export default async function BusinessOverviewPage({
  searchParams,
}: {
  searchParams: { days?: string | string[] };
}) {
  const days = clampDays(searchParams.days);
  const { context, supabase } = await requireStaff("overview.read", "/command-center");
  const [{ data, error }, alertsRes] = await Promise.all([supabase.rpc("admin_business_overview", { p_days: days }), supabase.rpc("admin_alerts")]);
  const overview = error ? null : parseOverview(data);
  const parsedAlerts = alertsRes.error ? null : parseAlerts(alertsRes.data);
  const alerts = parsedAlerts ? visibleAlerts(parsedAlerts, context.permissions) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-forest">Business overview</h1>
          <p className="text-sm text-charcoal/70">
            Live from the Place &amp; Plenty database. Staff and test accounts are excluded.
          </p>
        </div>
        <nav aria-label="Time window" className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/command-center?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${d === days ? "border-forest bg-forest text-parchment" : "border-forest/30 text-forest"}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      <section aria-labelledby="alerts">
        <h2 id="alerts" className="mb-2 font-display text-xl text-forest">Needs attention</h2>
        {alerts === null ? <p className="text-sm text-charcoal/70">Alerts are not available in this environment yet.</p>
          : alerts.length === 0 ? <p className="text-sm text-charcoal/70">Nothing needs attention right now.</p>
          : <ul className="space-y-2 text-sm">{alerts.map((a) => (
              <li key={a.key} className={`rounded-lg border p-3 ${a.severity === "action" ? "border-error/40" : "border-forest/20"} bg-cream`}>
                <Link href={a.href} className="text-forest underline-offset-2 hover:underline">{a.text}</Link> <span className="tabular-nums">({a.count})</span></li>))}</ul>}
      </section>

      {!overview ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">
          The overview is not available right now. This is expected until the Command Center database
          package has been applied to this environment.
        </p>
      ) : (
        <>
          <section aria-labelledby="funnel">
            <h2 id="funnel" className="mb-1 font-display text-xl text-forest">
              New accounts, last {overview.windowDays} days
            </h2>
            <p className="mb-3 text-sm text-charcoal/70">
              Each row counts distinct accounts created in this window. Source: Supabase (live).
            </p>
            <div className="overflow-x-auto rounded-lg border border-forest/15">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream">
                  <tr>
                    <th scope="col" className="px-3 py-2">Step</th>
                    <th scope="col" className="px-3 py-2 text-right">Accounts</th>
                    <th scope="col" className="px-3 py-2 text-right">% of registered</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelRows(overview.funnel).map((row) => (
                    <tr key={row.key} className="border-t border-forest/10">
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.percentOfRegistered === null ? "n/a" : `${row.percentOfRegistered}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="activity" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <h2 id="activity" className="sr-only">Activity in this window</h2>
            {[
              ["Gatherings created", overview.activity.gatherings_created],
              ["Gatherings locked in", overview.activity.gatherings_locked_in],
              ["Households first shared an invitation", overview.activity.households_first_shared],
              ["Repeat hosts (all time)", overview.activity.repeat_hosts_all_time],
              ["Accounts (all time)", overview.activity.total_accounts_all_time],
              ["Refunds recorded", overview.refundsInWindow],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-forest/15 bg-parchment p-4">
                <p className="text-sm text-charcoal/70">{label}</p>
                <p className="font-display text-2xl text-forest tabular-nums">{value === null ? "n/a" : (value as number)}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="paid">
            <h2 id="paid" className="mb-2 font-display text-xl text-forest">Purchases in this window</h2>
            {Object.keys(overview.paidPurchases).length === 0 ? (
              <p className="text-sm text-charcoal/70">No live paid purchases recorded in this window.</p>
            ) : (
              <ul className="text-sm">
                {Object.entries(overview.paidPurchases).map(([product, n]) => (
                  <li key={product}>{product.replace(/_/g, " ")}: {n}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-charcoal/70">
              Revenue amounts are not available: purchase amounts are not stored in the database yet.
            </p>
          </section>

          <section aria-labelledby="sources" className="rounded-lg border border-forest/15 p-4 text-sm">
            <h2 id="sources" className="mb-2 font-display text-lg text-forest">Data sources</h2>
            <ul className="space-y-1">
              <li>Accounts, gatherings, invitations, entitlements: live, Supabase.</li>
              <li>Hosting Collective applications: {overview.hostingCollectiveAvailable ? "live" : "not available, module not built"}.</li>
              <li>RSVP responses over time: not available (responses carry no timestamp).</li>
              <li>Stripe, RevenueCat, GA4, Search Console, Metricool, MailerLite: not connected.</li>
              <li>Alerts requiring attention: not built yet.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
