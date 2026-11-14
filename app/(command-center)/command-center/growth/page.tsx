import { requireStaff } from "@/lib/admin/server";
import { growthWindow, parseGrowthFunnel, pctOfFirst } from "@/lib/admin/cc";
import Link from "next/link";

// GROWTH FUNNEL (read-only). One database function, growth_funnel_summary, called AS THE SIGNED-IN STAFF MEMBER: the function itself
// requires growth.read (migration 211001_r1), so no service-role key is used anywhere in this app. Counts only; no ids or emails.
export default async function GrowthPage({ searchParams }: { searchParams: { days?: string | string[] } }) {
  const { supabase } = await requireStaff("growth.read", "/command-center/growth");
  const w = growthWindow(searchParams.days, new Date());
  const { data, error } = await supabase.rpc("growth_funnel_summary", { p_from: w.from, p_to: w.to, p_include_sandbox: false });
  const f = error ? null : parseGrowthFunnel(data);
  const first = f?.stages[0]?.count ?? null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl text-forest">Growth funnel</h1>
        <nav aria-label="Time window" className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/command-center/growth?days=${d}`} aria-current={d === w.days ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${d === w.days ? "border-forest bg-forest text-parchment" : "border-forest/30 text-forest"}`}>{d} days</Link>
          ))}
        </nav>
      </div>
      {!f ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the growth database package is applied to this environment.</p>
      ) : (
        <>
          <p className="text-sm text-charcoal/70">Accounts created in the window, and how many later reached each step. Sandbox purchases are excluded.</p>
          <div className="overflow-x-auto rounded-lg border border-forest/15">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream"><tr>{["Step", "Accounts", "Share of new accounts"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{f.stages.map((s) => (
                <tr key={s.key} className="border-t border-forest/10"><td className="px-3 py-2">{s.label}</td>
                  <td className="px-3 py-2 tabular-nums">{s.count ?? "n/a"}</td><td className="px-3 py-2 tabular-nums">{pctOfFirst(s.count, first)}</td></tr>))}</tbody>
            </table>
          </div>
          <section aria-labelledby="flags"><h2 id="flags" className="mb-2 font-display text-xl text-forest">Worth a look</h2>
            <ul className="space-y-1 text-sm">{f.flags.map((x) => <li key={x.key}>{x.label}: <span className="tabular-nums">{x.count ?? "n/a"}</span></li>)}</ul></section>
          {f.notes.length ? <ul className="list-disc pl-5 text-xs text-charcoal/70">{f.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
        </>
      )}
    </div>
  );
}
