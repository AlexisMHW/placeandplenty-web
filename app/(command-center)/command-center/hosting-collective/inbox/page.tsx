import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities } from "@/lib/admin/hc";
import { eventHref, eventLabel, parseDestinations, parseEvents, parseHealth } from "@/lib/hc/events";
import { ActionForm } from "@/components/hc/ActionForm";
import { ackEventForm, addDestinationForm, setDestinationActiveForm } from "../form-actions";

// HOSTING COLLECTIVE INBOX (D5). Events are written by the database when something happens (application, decision, onboarding, content, payout
// draft, suspension). Rows carry ids only: no names, emails or amounts. Delivery status is shown honestly: queued, sent (accepted by the provider),
// delivered (confirmed), failed. Email goes only to a destination the owner added AND that was verified; there is no address in the code.
export default async function InboxPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/inbox");
  const caps = hcCapabilities(context);
  const [evRes, healthRes, destRes] = await Promise.all([
    supabase.rpc("hc_admin_list_events", { p_only_open: true, p_limit: 100 }), supabase.rpc("hc_admin_delivery_health"), supabase.rpc("hc_admin_list_destinations"),
  ]);
  const events = evRes.error ? null : parseEvents(evRes.data);
  const health = healthRes.error ? null : parseHealth(healthRes.data);
  const dests = destRes.error ? [] : (parseDestinations(destRes.data) ?? []);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Inbox and delivery</h1>
      {events === null ? (
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
            <p>Active verified destinations: {health.activeDestinations}. Unverified: {health.unverifiedDestinations}.</p>
            <p>Failed deliveries: {health.failed}.{health.oldestQueuedMinutes !== null ? ` Oldest waiting message: ${health.oldestQueuedMinutes} minutes.` : ""}</p>
            <p className="text-charcoal/70">Sent means the email service accepted it. Delivered is shown only when the service confirms it. Nothing is emailed until a destination is verified and message delivery is switched on.</p>
          </div>)}
      </section>
      <section aria-labelledby="dst">
        <h2 id="dst" className="mb-2 font-display text-xl text-forest">Email destinations</h2>
        {dests.length === 0 ? <p className="text-sm text-charcoal/70">None. Inbox entries still appear here.</p> : (
          <ul className="space-y-2 text-sm">{dests.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3">{d.label ?? "Destination"} ({d.addressMasked}): {d.verified ? "verified" : "not verified"}, {d.active ? "on" : "off"}
              {caps.canSeePayoutActions && d.verified ? (
                <ActionForm action={setDestinationActiveForm} buttons={[{ label: d.active ? "Turn off" : "Turn on", secondary: true }]}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="active" value={d.active ? "false" : "true"} /></ActionForm>) : null}
            </li>))}</ul>)}
        {caps.canSeePayoutActions ? (
          <ActionForm action={addDestinationForm} buttons={[{ label: "Add destination" }]} className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label className="text-xs">Email address<input name="address" type="email" required maxLength={254} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
            <label className="text-xs">Label (optional)<input name="label" maxLength={60} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
          </ActionForm>) : null}
        <p className="mt-2 text-xs text-charcoal/70">A new destination stays off until a test message to it is confirmed delivered. That check is done by the message service, not from this page.</p>
      </section>
    </div>
  );
}
