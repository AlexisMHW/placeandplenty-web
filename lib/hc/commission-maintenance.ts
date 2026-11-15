// Protected, OFF-by-default trigger for commission maintenance (E-C2, web side). Calls the service-only RPC hc_commission_maintenance exactly once.
// Fails closed: if the function does not exist (database package not applied) nothing is changed and a clear error is returned.
import { timingSafeEqual } from "node:crypto";

export const commissionMaintenanceEnabled = (env: Record<string, string | undefined>) => env.HC_COMMISSION_MAINTENANCE_ENABLED === "true";
export interface MaintenanceClient { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data?: unknown; error: { message?: string; code?: string } | null }> }

export function maintenanceAuthorised(env: Record<string, string | undefined>, authorization: string | null): boolean {
  const secret = env.HC_COMMISSION_MAINTENANCE_SECRET ?? "";
  const given = (authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
const missing = (e: { message?: string; code?: string }) => e.code === "PGRST202" || e.code === "42883" || /does not exist|could not find the function|schema cache/i.test(e.message ?? "");

export async function runCommissionMaintenance(o: { env: Record<string, string | undefined>; authorization: string | null; client: () => MaintenanceClient | null }): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!maintenanceAuthorised(o.env, o.authorization)) return { status: 401, body: { ok: false } };
  if (!commissionMaintenanceEnabled(o.env)) return { status: 200, body: { ok: true, ran: false, reason: "maintenance_disabled" } };
  const client = o.client();
  if (!client) return { status: 503, body: { ok: false, ran: false, error: "service_client_not_configured" } };
  const { data, error } = await client.rpc("hc_commission_maintenance");
  if (error) return missing(error) ? { status: 503, body: { ok: false, ran: false, error: "maintenance_function_not_installed" } } : { status: 500, body: { ok: false, ran: false, error: "maintenance_failed" } };
  return { status: 200, body: { ok: true, ran: true, result: data ?? null } };
}
