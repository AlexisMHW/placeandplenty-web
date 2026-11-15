import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities } from "@/lib/admin/hc";
import { eventHref, eventLabel, parseEvents, parseHealth } from "@/lib/hc/events";
import { ActionForm } from "@/components/hc/ActionForm";
import { ackEventForm } from "../form-actions";

// HOSTING COLLECTIVE INBOX (D5). Events are written by the database when something happens (application, decision, onboarding, content, payout
// draft, suspension). Rows carry ids only: no names, emails or amounts. Delivery status is shown honestly: queued, sent (accepted by the provider),
// delivered (confirmed), failed. There is ONE founder inbox and ONE place to configure the founder email: Command Center, Inbox and notification settings. This page has no address form and no address in the code.
export default async function InboxPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/inbox");
  const caps = hcCapabilities(context);
  const [evRes, healthRes] = await Promise.all([
    supabase.rpc("hc_admin_list_events", { p_only_open: true, p_limit: 100 }), supabase.rpc("hc_admin_delivery_health"),
  ]);
  // Payout notifications are payout data: only owner and authorized financial staff (hc.payout) see them (founder decision A).
  const events = evRes.error ? [] : (parseEvents(evRes.data) ?? []).filter((e) => caps.canViewPayouts || e.refType !== "payout");
  const eventsAvailable = !evRes.error && parseEvents(evRes.data) !== null;
  const health = healthRes.error ? null : parseHealth(healthRes.data);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Inbox and delivery</h1>
      {!eventsAvailable ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the Hosting Collective database package has been applied to this environment.</p>
      ) : events.length === 0 ? <p className="text-sm text-charcoal/70">Nothing open.</p> : (
        <ul className="space-y-2 text-sm">{events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-forest/15 bg-parchment p-3">
            <span><Link href={eventHref(e.kind, e.refType)} className="underline">{eventLabel(e.kind)}</Link>{e.severity !== "info" ? ` (${e.severity === "critical" ? "urgent" : "action needed"})` : ""}
              <span className="ml-2 text-xs text-charcoal/70">{e.createdAt?.slice(0, 16).replace("T", " ")} UTC{Object.keys(e.deliveries).length ? ` · email: ${Object.entries(e.deliveries).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""}</span></span>
            {caps.canManage ? <ActionForm action={ackEventForm} buttons={[{ label: "Mark seen", secondary: true }]}><input type="hidden" name="id" value={e.id} /></ActionForm> : null}
          </li>))}</ul>)}
      <section aria-labelledby="dh">
        <h2 id="dh" className="mb-2 font-display text-xl text-forest">Email delivery</h2>
        {health === null ? <p className="text-sm text-charcoal/70">Not available.</p> : (
          <div className="space-y-1 text-sm">
                        <p>Failed deliveries: {health.failed}.{health.oldestQueuedMinutes !== null ? ` Oldest waiting message: ${health.oldestQueuedMinutes} minutes.` : ""}</p>
            <p className="text-charcoal/70">Sent means the email service accepted it. Delivered is shown only when the service confirms it. Nothing is emailed until the founder email is verified in the notification settings and message delivery is switched on.</p>
          </div>)}
      </section>
      <p className="text-sm"><Link href="/command-center/inbox" className="underline">Founder inbox and email settings</Link> (the single place to set, verify and turn on the founder notification email).</p>
    </div>
  );
}
