import { requireStaff } from "@/lib/admin/server";
import { parseHealth } from "@/lib/admin/cc";
import { probeAll } from "@/lib/admin/integrations";

// INTEGRATION HEALTH (read-only). Top block: when did our own database last hear from each payment provider. Second block: optional
// live status probes (Stripe, RevenueCat, MailerLite, GA4), each OFF unless its CC_INTEGRATION_* flag is "true" and a read-only key exists.
// Keys are read on the server by name only and never shown. A quiet page is not proof an external service is healthy.
const TONE = { ok: "text-forest", watch: "font-medium text-error", unknown: "text-charcoal/70" } as const;
export default async function HealthPage() {
  const { supabase } = await requireStaff("ops.read", "/command-center/health");
  const { data, error } = await supabase.rpc("admin_integration_health");
  const rows = error ? null : parseHealth(data, new Date());
  const probes = await probeAll(process.env, (url, init) => fetch(url, { ...init, cache: "no-store" }));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Integration health</h1>
      {!rows ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p> : (
        <dl className="divide-y divide-forest/10 rounded-lg border border-forest/15 text-sm">{rows.map((r) => (
          <div key={r.label} className="flex flex-wrap justify-between gap-2 px-3 py-2"><dt>{r.label}</dt><dd className={TONE[r.tone]}>{r.value}</dd></div>))}</dl>)}
      <section aria-labelledby="probes"><h2 id="probes" className="mb-2 font-display text-xl text-forest">Live provider checks</h2>
        <dl className="divide-y divide-forest/10 rounded-lg border border-forest/15 text-sm">{probes.map((p) => (
          <div key={p.id} className="flex flex-wrap justify-between gap-2 px-3 py-2"><dt>{p.label}</dt><dd className={p.status === "failed" ? "font-medium text-error" : p.status === "ok" ? "text-forest" : "text-charcoal/70"}>{p.status.replace(/_/g, " ")}: {p.note}</dd></div>))}</dl>
      </section>
    </div>
  );
}
