import Link from "next/link";
import { ActionForm } from "../_components/action-form";
import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities, notificationLabel, parseNotifications } from "@/lib/admin/hc";
import { parseFunnel, signupsPer100 } from "@/lib/hc/click-capture";
import { acknowledgeNotification } from "./actions";

// HOSTING COLLECTIVE HOME. Requires hc.read. Open notifications come from hc_admin_notifications(), which re-checks hc.read.
export default async function HostingCollectiveHome() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective");
  const caps = hcCapabilities(context);
  const { data, error } = await supabase.rpc("hc_admin_notifications", { p_only_open: true });
  const notes = error ? null : parseNotifications(data);
  const funnelRes = await supabase.rpc("hc_admin_referral_funnel", { p_days: 30 });
  const funnel = funnelRes.error ? null : parseFunnel(funnelRes.data);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-forest">Hosting Collective</h1>
        <p className="text-sm text-charcoal/70">Creator applications, members, content and referral results. No payouts are made from this screen.</p>
      </div>
      <nav aria-label="Hosting Collective sections" className="flex flex-wrap gap-2 text-sm">
        {[["applications", "Applications"], ["members", "Members"], ["content", "Content"], ["tiers", "Tiers"], ["campaigns", "Campaigns"], ["inbox", "Inbox and delivery"], ...(caps.canViewPayouts ? [["payouts", "Referrals and payout history"]] : [])].map(([slug, label]) => (
          <Link key={slug} href={`/command-center/hosting-collective/${slug}`} className="rounded-full border border-forest/30 px-3 py-1 text-forest">{label}</Link>
        ))}
      </nav>
      <section aria-labelledby="open-notes">
        <h2 id="open-notes" className="mb-2 font-display text-xl text-forest">Needs attention</h2>
        {notes === null ? (
          <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">
            Not available. This is expected until the Hosting Collective database package has been applied to this environment.
          </p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-charcoal/70">Nothing open.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 rounded-lg border border-forest/15 bg-parchment p-3">
                <span>{notificationLabel(n.kind)}{n.severity === "action" ? " (action needed)" : ""}</span>
                {caps.canManage ? (
                  <ActionForm action={acknowledgeNotification} submitLabel="Mark seen" submitClassName="rounded border border-forest/30 px-2 py-1 text-xs text-forest" successText="Marked seen.">
                    <input type="hidden" name="id" value={n.id} />
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="funnel">
        <h2 id="funnel" className="mb-2 font-display text-xl text-forest">Referral link opens and signups (last 30 days)</h2>
        {funnel === null ? (
          <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the link-open counting database step is applied. Counting is off by default.</p>
        ) : funnel.rows.length === 0 ? (
          <p className="text-sm text-charcoal/70">No referral codes yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm">
            <thead className="bg-cream"><tr>{["Member", "Code", "Link opens", "Signups", "Signups per 100 opens"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{funnel.rows.map((r) => (
              <tr key={r.code} className="border-t border-forest/10"><td className="px-3 py-2">{r.displayName}</td><td className="px-3 py-2">{r.code}</td>
                <td className="px-3 py-2 tabular-nums">{r.clicks}</td><td className="px-3 py-2 tabular-nums">{r.signups}</td><td className="px-3 py-2 tabular-nums">{signupsPer100(r) ?? "n/a"}</td></tr>))}</tbody></table></div>
        )}
        {funnel?.note ? <p className="mt-1 text-xs text-charcoal/70">{funnel.note}</p> : null}
      </section>
    </div>
  );
}
