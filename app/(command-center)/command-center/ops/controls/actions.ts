"use server";
import { revalidatePath } from "next/cache";
import { requirePayoutOwner } from "@/lib/admin/server";
import { parseSwitchForm, SWITCH_GOOD } from "@/lib/admin/controls";
import { knownCode } from "@/lib/admin/messages";

// OWNER-ONLY switches (hc.payout + owner role here, hc.payout again inside each database function, each writes an audit row).
// These never change the paid-referrals switch, send nothing and move no money.
const PATH = "/command-center/ops/controls";
export async function setSwitch(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requirePayoutOwner(PATH);
  const p = parseSwitchForm(formData);
  if (!p.ok) return { ok: false, code: p.error };
  const res = p.kind === "program"
    ? await supabase.rpc("hc_admin_set_program_enabled", { p_enabled: p.on, p_reason: p.reason })
    : await supabase.rpc("hc_admin_set_applications_open", { p_open: p.on, p_terms_version: p.termsVersion, p_reason: p.reason });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  const status = (res.data as { status?: unknown } | null)?.status;
  if (typeof status !== "string" || !SWITCH_GOOD.includes(status)) return { ok: false, code: typeof status === "string" ? knownCode(status) : "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}
