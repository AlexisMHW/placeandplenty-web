// COMMAND CENTER ACCESS DECISIONS. Pure functions, no imports, no I/O, so they can be tested
// without a browser, a database or Next.
//
// THE RULE: nothing in the browser decides who may see business data. The signed-in user's role
// comes from the database (public.get_my_staff_context(), which reads auth.uid() server-side).
// This file only turns that answer into one of three outcomes. The same permission is enforced
// again inside every admin_* RPC (staff_has_permission), so a bug here still cannot return data.
//
// Not staff and not permitted both look like a missing page (404), never a 403. The existence of
// the Command Center is not confirmed to people who cannot use it.

export const STAFF_ROLES = [
  "owner",
  "business_admin",
  "marketing_pr",
  "creator_program_manager",
  "support",
  "limited_contributor",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PERMISSIONS = [
  "overview.read",
  "growth.read",
  "revenue.read",
  "analytics.read",
  "hc.read",
  "hc.manage",
  "hc.applications.review",
  "hc.content.review",
  "hc.payout",
  "marketing.read",
  "marketing.manage",
  "support.read",
  "support.manage",
  "ops.read",
  "staff.manage",
  "audit.read",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export interface StaffContext {
  role: StaffRole;
  permissions: StaffPermission[];
}

export type AccessDecision =
  | { kind: "login" }
  | { kind: "not_found" }
  | { kind: "allow"; context: StaffContext };

/** Validates the JSON from get_my_staff_context(). Anything unexpected means "not staff". */
export function parseStaffContext(raw: unknown): StaffContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { role?: unknown; permissions?: unknown };
  if (typeof r.role !== "string" || !(STAFF_ROLES as readonly string[]).includes(r.role)) return null;
  if (!Array.isArray(r.permissions)) return null;
  const permissions = r.permissions.filter(
    (p): p is StaffPermission => typeof p === "string" && (STAFF_PERMISSIONS as readonly string[]).includes(p),
  );
  return { role: r.role as StaffRole, permissions };
}

export function decideAccess(
  input: { signedIn: boolean; rawContext: unknown },
  permission?: StaffPermission,
): AccessDecision {
  if (!input.signedIn) return { kind: "login" };
  const context = parseStaffContext(input.rawContext);
  if (!context) return { kind: "not_found" };
  if (permission && !context.permissions.includes(permission)) return { kind: "not_found" };
  return { kind: "allow", context };
}
