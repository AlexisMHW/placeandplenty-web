import { createClient, getUser } from "@/lib/supabase-server";
import { summarise, type Entitlement, type EntitlementState } from "@/lib/entitlements";

// READING THE CANONICAL ENTITLEMENT ROWS. Server-only, deliberately kept
// apart from lib/entitlements.ts.
//
// WHY THE SPLIT EXISTS. lib/conversion.ts reads WEB_CHECKOUT_LIVE out of
// the model to decide whether to show a "Buy on Web" path, and the site
// header is a client component that renders those paths. With the
// Supabase server client in the same module as the model, next/headers
// ends up in the browser bundle and the build fails outright. The model
// is pure; this is where it meets the database.
//
// Everything here runs as the signed-in user through RLS. No service
// role, no cached copy of anyone's plan, and nothing written — these
// tables are SELECT-only for users by design, because entitlements are
// minted server-side after a payment is verified.

/**
 * Every entitlement the signed-in person BOUGHT, whichever channel it
 * came from.
 *
 * THE `user_id` FILTER IS NOT REDUNDANT WITH RLS, and the difference
 * matters for the billing panel. The SELECT policy on this table is:
 *
 *   (scope = 'gathering' AND is_accepted_gathering_member(gathering_id))
 *   OR (scope = 'account' AND user_id = auth.uid())
 *
 * So a co-host can legitimately READ the Pass on a gathering someone
 * else paid for — correct for deciding what the gathering can do, wrong
 * for a page headed "your plan". Without this filter the account area
 * would show a co-host a purchase they did not make and cannot manage.
 *
 * RLS remains the security boundary; this is the semantic one.
 */
export async function getMyEntitlements(): Promise<Entitlement[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_entitlements")
    .select(
      "id, entitlement_type, canonical_product_id, scope, gathering_id, active, purchased_at, expires_at, consumed_at, refunded_at, revoked_at, provider, source"
    )
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error || !data) return [];
  return data as Entitlement[];
}

/** Convenience: the state for the signed-in account, in one call. */
export async function getMyEntitlementState(): Promise<EntitlementState> {
  return summarise(await getMyEntitlements());
}

