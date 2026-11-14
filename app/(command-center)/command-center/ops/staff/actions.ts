"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { parseStaffForm, STAFF_ERROR_CODES } from "@/lib/admin/staff";

// STAFF ACCESS ACTIONS. staff.manage re-checked here and inside admin_grant_staff_role / admin_revoke_staff_role, which refuse to remove the last
// owner and write the audit row. The FIRST owner is not created here (there is nobody with staff.manage yet): see the prepared bootstrap runbook.
const PATH = "/command-center/ops/staff";
export async function staffAction(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("staff.manage", PATH);
  const p = parseStaffForm(formData);
  if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const { error } = v.kind === "grant"
    ? await supabase.rpc("admin_grant_staff_role", { p_user_id: v.userId, p_role: v.role })
    : await supabase.rpc("admin_revoke_staff_role", { p_user_id: v.userId });
  if (error) return { ok: false, code: STAFF_ERROR_CODES.exec(error.message)?.[0] ?? "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}
