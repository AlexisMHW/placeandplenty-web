import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { parseKindParam, parsePurchaseEvents } from "@/lib/admin/cc";
import { LookupForm } from "./lookup-form";

// PURCHASES AND SUPPORT (read-only). support.read to open; the database re-checks. Events are refunds, disputes, duplicate-purchase
// attempts and rejected grants; routine grants are excluded. No refund, grant or revoke control exists here on purpose.
export default async function PurchasesPage({ searchParams }: { searchParams: { kind?: string | string[] } }) {
  const { supabase } = await requireStaff("support.read", "/command-center/purchases");
  const kind = parseKindParam(searchParams.kind);
  const { data, error } = await supabase.rpc("admin_purchase_events", { p_kind: kind, p_limit: 50 });
  const ev = error ? null : parsePurchaseEvents(data);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-forest">Purchases and support</h1>
      <LookupForm />
      <section aria-labelledby="events" className="space-y-3">
        <h2 id="events" className="font-display text-xl text-forest">Purchase events that need attention</h2>
        {!ev || !ev.available ? (
          <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available in this environment yet.</p>
        ) : (
          <>
            <nav aria-label="Filter by event type" className="flex flex-wrap gap-2 text-sm">
              <Link href="/command-center/purchases" className={`rounded-full border px-3 py-1 ${kind === null ? "border-forest bg-forest text-parchment" : "border-forest/30 text-forest"}`}>All</Link>
              {ev.kinds.map((k) => <Link key={k} href={`/command-center/purchases?kind=${k}`} className={`rounded-full border px-3 py-1 ${kind === k ? "border-forest bg-forest text-parchment" : "border-forest/30 text-forest"}`}>{k.replace(/_/g, " ")}</Link>)}
            </nav>
            {ev.rows.length === 0 ? <p className="text-sm text-charcoal/70">Nothing to show.</p> : (
              <div className="overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm">
                <thead className="bg-cream"><tr>{["When", "Event", "Source", "Reason", "Account"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>{ev.rows.map((r) => (<tr key={r.id} className="border-t border-forest/10">
                  <td className="whitespace-nowrap px-3 py-2">{r.createdAt ? r.createdAt.slice(0, 16).replace("T", " ") : "n/a"}</td>
                  <td className="px-3 py-2">{r.type.replace(/_/g, " ")}</td><td className="px-3 py-2">{r.source ?? "n/a"}</td>
                  <td className="px-3 py-2">{r.reason ?? "n/a"}</td><td className="px-3 py-2 font-mono text-xs">{r.userId ? r.userId.slice(0, 8) : "n/a"}</td></tr>))}</tbody></table></div>)}
          </>
        )}
      </section>
    </div>
  );
}
