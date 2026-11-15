import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { decideAccess, type StaffContext, type StaffPermission } from "@/lib/admin/access";
import { canActOnPayouts } from "@/lib/admin/payout-access";

// THE SERVER-SIDE GATE for every Command Center page and action.
//
// 1. getUser() revalidates the session with the auth server (never getSession(), which trusts a cookie).
// 2. The role is read from the database as the signed-in user (get_my_staff_context), not from a cookie,
//    a header, a query string or any client-supplied flag.
// 3. Unauthenticated -> login. Signed in but not permitted -> 404.
// 4. Every admin_* RPC repeats the permission check inside Postgres, so this layer cannot be the only one.
//
// No service-role key is used anywhere in the Command Center (see lib/supabase-server.ts).
export async function requireStaff(
  permission: StaffPermission | undefined,
  nextPath: string,
): Promise<{ context: StaffContext; supabase: ReturnType<typeof createClient> }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rawContext: unknown = null;
  if (user) {
    const { data } = await supabase.rpc("get_my_staff_context");
    rawContext = data;
  }

  const decision = decideAccess({ signedIn: !!user, rawContext }, permission);
  if (decision.kind === "login") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (decision.kind === "not_found") notFound();
  return { context: decision.context, supabase };
}

/**
 * Gate for every payout ACTION (founder decision A): hc.payout AND the owner role. Anyone else gets a 404, exactly like a missing page.
 * The database functions repeat the owner check; this layer only decides first.
 */
export async function requirePayoutOwner(nextPath: string): Promise<{ context: StaffContext; supabase: ReturnType<typeof createClient> }> {
  const r = await requireStaff("hc.payout", nextPath);
  if (!canActOnPayouts(r.context)) notFound();
  return r;
}
