import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin/server";
import { categoryLabel, deliveryLabel, parseInbox } from "@/lib/admin/notifications";
import { ActionForm } from "../../_components/action-form";
import { setNotificationState } from "../actions";

// One notification. This is the link target used in the founder email ({SITE_URL}/command-center/inbox/{id}). The email says only that something needs
// attention; the detail is here, behind login. A person without permission for the item gets the same "not found" as a missing id.
export default async function InboxItemPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireStaff(undefined, `/command-center/inbox/${params.id}`);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const res = await supabase.rpc("admin_get_notification", { p_id: id });
  if (res.error) {
    if (/not_found|not_authorized/.test(res.error.message)) notFound();
    return <p role="alert" className="rounded-lg border border-error/40 bg-cream p-4 text-sm">This notification is not available right now. Try again later.</p>;
  }
  const raw = res.data as { deliveries?: unknown } | null;
  const n = parseInbox([raw])?.[0];
  if (!n) notFound();
  const deliveries = Array.isArray(raw?.deliveries) ? (raw!.deliveries as Record<string, unknown>[]) : null;
  return (
    <div className="space-y-4">
      <p className="text-sm"><Link href="/command-center/inbox" className="text-forest underline">← Inbox</Link></p>
      <h1 className="font-display text-2xl text-forest">{n.title}</h1>
      <p className="text-sm text-charcoal/80">{categoryLabel(n.category)} · {n.severity} · {n.status}{n.occurrences > 1 ? ` · seen ${n.occurrences} times` : ""}</p>
      {n.body ? <p className="text-sm">{n.body}</p> : null}
      <p className="text-xs text-charcoal/60">First seen {n.firstSeenAt ?? "n/a"} · last seen {n.lastSeenAt ?? "n/a"}</p>
      {n.link ? <p><Link href={n.link} className="text-forest underline">Open the page for details</Link></p> : null}
      <div className="flex flex-wrap gap-3">
        {n.status === "open" ? <ActionForm action={setNotificationState} submitLabel="Acknowledge" submitClassName="rounded border border-forest/30 px-3 py-1 text-forest" successText="Acknowledged."><input type="hidden" name="id" value={n.id} /><input type="hidden" name="state" value="acknowledged" /></ActionForm> : null}
        {n.status !== "resolved" ? <ActionForm action={setNotificationState} submitLabel="Resolve" successText="Resolved."><input type="hidden" name="id" value={n.id} /><input type="hidden" name="state" value="resolved" /></ActionForm> : null}
      </div>
      {deliveries !== null ? (
        <section aria-labelledby="del"><h2 id="del" className="mb-1 font-display text-lg text-forest">Email for this item</h2>
          {deliveries.length === 0 ? <p className="text-sm text-charcoal/70">No email was queued (email is off, the item is below the email threshold, or no verified address is set).</p> : (
            <ul className="space-y-1 text-sm">{deliveries.map((d, i) => <li key={i}>{deliveryLabel(String(d.status))}{typeof d.attempts === "number" ? ` · attempts: ${d.attempts}` : ""}{typeof d.last_error === "string" ? ` · ${d.last_error}` : ""}</li>)}</ul>)}</section>) : null}
    </div>
  );
}
