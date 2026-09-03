import { createClient, getUser } from "@/lib/supabase-server";
import { summarise, type Entitlement, type EntitlementState } from "@/lib/entitlements";

// Canonical entitlement reads for the signed-in account. Purchase channel is
// provenance; access is always decided by gathering_entitlements.

export async function getMyEntitlements(): Promise<Entitlement[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_entitlements")
    .select(
      "id, entitlement_type, canonical_product_id, scope, gathering_id, active, purchased_at, expires_at, consumed_at, refunded_at, revoked_at, provider, source, provider_customer_id"
    )
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error || !data) return [];
  return data as Entitlement[];
}

export async function getMyEntitlementState(): Promise<EntitlementState> {
  return summarise(await getMyEntitlements());
}
