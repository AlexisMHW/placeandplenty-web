import { createClient } from "@supabase/supabase-js";
import { runCommissionMaintenance } from "@/lib/hc/commission-maintenance";

// Scheduled/manual commission maintenance (sweep + reconcile) via the service-only database function hc_commission_maintenance.
// OFF by default (HC_COMMISSION_MAINTENANCE_ENABLED must be exactly "true") and requires the shared secret HC_COMMISSION_MAINTENANCE_SECRET as a Bearer token.
// Fails closed with a clear error if the database function is not installed. Nothing here moves money.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const r = await runCommissionMaintenance({
    env: process.env, authorization: request.headers.get("authorization"),
    client: () => { const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null; },
  });
  return Response.json(r.body, { status: r.status });
}
