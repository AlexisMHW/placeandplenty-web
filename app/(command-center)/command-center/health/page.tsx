import { requireStaff } from "@/lib/admin/server";
import { parseHealth } from "@/lib/admin/cc";

// INTEGRATION HEALTH (read-only). Reads only our own database (when did we last hear from each payment provider). It holds no provider
// keys and makes no calls to Stripe, RevenueCat, the app stores or the email provider. The last row says so, so a quiet page is not
// mistaken for proof that an external service is healthy.
const TONE = { ok: "text-forest", watch: "font-medium text-error", unknown: "text-charcoal/70" } as const;
export default async function HealthPage() {
  const { supabase } = await requireStaff("ops.read", "/command-center/health");
  const { data, error } = await supabase.rpc("admin_integration_health");
  const rows = error ? null : parseHealth(data, new Date());
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-forest">Integration health</h1>
      {!rows ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p> : (
        <dl className="divide-y divide-forest/10 rounded-lg border border-forest/15 text-sm">{rows.map((r) => (
          <div key={r.label} className="flex flex-wrap justify-between gap-2 px-3 py-2"><dt>{r.label}</dt><dd className={TONE[r.tone]}>{r.value}</dd></div>))}</dl>)}
    </div>
  );
}
