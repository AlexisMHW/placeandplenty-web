import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { categoryLabel, parseInbox } from "@/lib/admin/notifications";
import { ActionForm } from "../_components/action-form";
import { setNotificationState } from "./actions";

// FOUNDER INBOX (decision D5, channel A). Persistent, permission-controlled: every active staff member may open this page, but the database returns
// only the notifications that member's role may see (a support person never sees payout or member items). Rows hold no names, emails or amounts;
// each links to the page where the details live behind that page's own permission.
const sevClass: Record<string, string> = { critical: "bg-error text-parchment", warning: "bg-cream text-charcoal border border-forest/30", info: "bg-parchment text-charcoal border border-forest/15" };
export default async function InboxPage({ searchParams }: { searchParams: { show?: string } }) {
  const { supabase } = await requireStaff(undefined, "/command-center/inbox");
  const show = searchParams.show === "resolved" ? "resolved" : searchParams.show === "all" ? "all" : "open";
  const res = await supabase.rpc("admin_list_notifications", { p_status: show, p_limit: 100 });
  const items = res.error ? null : parseInbox(res.data);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-forest">Inbox</h1>
      <p className="text-sm text-charcoal/80">Things that need your attention, newest and most serious first. Repeats are grouped into one item.</p>
      <nav aria-label="Filter" className="flex gap-3 text-sm">{(["open", "resolved", "all"] as const).map((k) => <Link key={k} href={k === "open" ? "/command-center/inbox" : `/command-center/inbox?show=${k}`} aria-current={show === k ? "page" : undefined} className={show === k ? "font-medium text-forest underline" : "text-forest/80 hover:underline"}>{k === "open" ? "Open" : k === "resolved" ? "Resolved" : "All"}</Link>)}</nav>
      {items === null ? <p role="alert" className="rounded-lg border border-error/40 bg-cream p-4 text-sm">The inbox is not available right now (the notification database package may not be applied yet). Nothing was lost. Try again later.</p>
        : items.length === 0 ? <p className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">{show === "open" ? "Nothing needs your attention." : "Nothing here."}</p> : (
        <ul className="space-y-3">{items.map((n) => (
          <li key={n.id} className="rounded-lg border border-forest/15 bg-parchment p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-xs ${sevClass[n.severity]}`}>{n.severity}</span><span className="text-xs text-charcoal/70">{categoryLabel(n.category)}</span>
              {n.occurrences > 1 ? <span className="text-xs text-charcoal/70">× {n.occurrences}</span> : null}<span className="text-xs text-charcoal/60">{n.status}</span></div>
            <p className="mt-1 font-medium"><Link href={`/command-center/inbox/${n.id}`} className="text-forest underline-offset-2 hover:underline">{n.title}</Link></p>
            {n.body ? <p className="text-charcoal/80">{n.body}</p> : null}
            <p className="mt-1 text-xs text-charcoal/60">Last seen {n.lastSeenAt ? n.lastSeenAt.slice(0, 16).replace("T", " ") + " UTC" : "n/a"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {n.link ? <Link href={n.link} className="text-forest underline">Open the page</Link> : null}
              {n.status === "open" ? <ActionForm action={setNotificationState} submitLabel="Acknowledge" submitClassName="rounded border border-forest/30 px-2 py-0.5 text-forest" successText="Acknowledged."><input type="hidden" name="id" value={n.id} /><input type="hidden" name="state" value="acknowledged" /></ActionForm> : null}
              {n.status !== "resolved" ? <ActionForm action={setNotificationState} submitLabel="Resolve" submitClassName="rounded bg-forest px-2 py-0.5 text-parchment" successText="Resolved."><input type="hidden" name="id" value={n.id} /><input type="hidden" name="state" value="resolved" /></ActionForm> : null}
            </div></li>))}</ul>)}
    </div>
  );
}
