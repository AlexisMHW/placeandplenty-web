// STAFF GRANT / REVOKE FORM PARSING. Pure. The database (admin_grant_staff_role / admin_revoke_staff_role) re-checks staff.manage, refuses to remove
// the last owner, and writes the audit row. Granting "owner" needs an explicit confirmation box so it cannot happen by a stray click.
import { STAFF_ROLES, type StaffRole } from "./access.ts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Form = { get(name: string): unknown };
export type StaffAction = { kind: "grant"; userId: string; role: StaffRole } | { kind: "revoke"; userId: string };

export function parseStaffForm(form: Form): { ok: true; value: StaffAction } | { ok: false; error: string } {
  const kind = form.get("kind");
  const userId = typeof form.get("user_id") === "string" ? (form.get("user_id") as string).trim() : "";
  if (!UUID.test(userId)) return { ok: false, error: "invalid_user_id" };
  if (kind === "revoke") return { ok: true, value: { kind: "revoke", userId } };
  if (kind !== "grant") return { ok: false, error: "invalid_action" };
  const role = form.get("role");
  if (typeof role !== "string" || !(STAFF_ROLES as readonly string[]).includes(role)) return { ok: false, error: "invalid_role" };
  if (role === "owner" && form.get("confirm_owner") !== "yes") return { ok: false, error: "owner_confirmation_required" };
  return { ok: true, value: { kind: "grant", userId, role: role as StaffRole } };
}
export const STAFF_ERROR_CODES = /not_authorized|invalid_role|user_not_found|last_owner_required|staff_not_found/;
