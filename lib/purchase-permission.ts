// FOUNDER DECISION C: only the OWNER and a FULL-ACCESS (legacy_full) co-host may start a Gathering Pass purchase. Planner and manager co-hosts may not.
// The rule is the existing capability `start_purchase` (lib/cohost-permissions.ts `can`, database has_gathering_capability / get_my_gathering_capabilities).
// This module only decides what to SHOW and how to word a refusal; the database (create_purchase_intent) is the real gate and /api/checkout re-checks first.
// Pure: no React, no "@/" imports, importable from the route, the page and node tests.
import { can, isMissingRpc, isNotAuthorized, parseMyCapabilities, LEGACY_ALL_CAPABILITIES, type MyCapabilities } from "./cohost-permissions.ts";

export const PURCHASE_NOT_ALLOWED_MESSAGE =
  "Only the host or a co-host with full access can buy a Gathering Pass for this gathering. Ask the host to buy it or to change your co-host access.";

/** True for the owner and for a co-host holding start_purchase (legacy_full). Planner and manager co-hosts: false. */
export function canStartPurchase(caps: MyCapabilities): boolean {
  return can(caps, "start_purchase");
}

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> };

/** What this person may do on one gathering. Backend predating permission levels or a failed lookup = legacy (the database still decides at purchase time). */
export async function myPurchaseCapabilities(supabase: RpcClient, gatheringId: string): Promise<MyCapabilities> {
  try {
    const { data, error } = await supabase.rpc("get_my_gathering_capabilities", { p_gathering_id: gatheringId });
    if (error) return LEGACY_ALL_CAPABILITIES;
    return parseMyCapabilities(data);
  } catch {
    return LEGACY_ALL_CAPABILITIES;
  }
}

/** Splits gatherings into those the person may buy for and those they may not (shown as "ask the host"). */
export async function splitPurchasable<T extends { id: string }>(supabase: RpcClient, gatherings: T[]): Promise<{ allowed: T[]; blocked: T[] }> {
  const verdicts = await Promise.all(gatherings.map(async (g) => canStartPurchase(await myPurchaseCapabilities(supabase, g.id))));
  return { allowed: gatherings.filter((_, i) => verdicts[i]), blocked: gatherings.filter((_, i) => !verdicts[i]) };
}

/** True when a create_purchase_intent failure is the capability refusal (maps to PURCHASE_NOT_ALLOWED_MESSAGE, never raw database text). */
export function isPurchaseRefusal(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && !isMissingRpc(error) && isNotAuthorized(error);
}
