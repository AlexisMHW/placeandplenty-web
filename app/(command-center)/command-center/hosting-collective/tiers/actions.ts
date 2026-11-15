"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { parseAssignTierForm, parseStatusForm } from "@/lib/admin/tiers";
import { saveTierWith, setTierEligibilityWith } from "@/lib/hc/tier-write";
import { knownCode } from "@/lib/admin/messages";

// TIER, BENEFIT, MEMBER-TIER AND MEMBER-STATUS ACTIONS (founder decision D4). hc.manage is checked here and again in every database function.
// Every change needs a reason and lands in the append-only hc_config_audit. Paid-referral eligibility is changed ONLY by setTierEligibility (owner); saveTier sends NULL = unchanged.
// No commission rate is set here and paid referrals are not switched on by anything on this page.
const PATH = "/command-center/hosting-collective/tiers";
type R = { ok: boolean; code: string };
const done = (r: R): R => { if (!r.ok) return r; revalidatePath(PATH); revalidatePath("/command-center/hosting-collective/members"); return r; };
const finish = (x: R | { message: string } | null): R => { if (x && "ok" in x) return done(x); if (x) return { ok: false, code: knownCode(x.message) }; return done({ ok: true, code: "saved" }); };

export async function saveTier(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  return finish(await saveTierWith(supabase, formData));
}
// Owner only (hc.payout checked here and in the database). The only way to change paid-referral eligibility: explicit yes/no, reason and confirmation.
export async function setTierEligibility(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("hc.payout", PATH);
  return finish(await setTierEligibilityWith(supabase, formData));
}
export async function assignTier(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const p = parseAssignTierForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("hc_admin_assign_tier", { p_partner_id: p.value.partnerId, p_tier: p.value.tier, p_reason: p.value.reason });
  return finish(error);
}
export async function setPartnerStatus(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const p = parseStatusForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("hc_admin_set_partner_status", { p_partner_id: p.value.partnerId, p_status: p.value.status, p_reason: p.value.reason });
  return finish(error);
}
