"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { parseAssignTierForm, parseStatusForm, parseTierForm } from "@/lib/admin/tiers";
import { knownCode } from "@/lib/admin/messages";

// TIER, BENEFIT, MEMBER-TIER AND MEMBER-STATUS ACTIONS (founder decision D4). hc.manage is checked here and again in every database function.
// Every change needs a reason and lands in the append-only hc_config_audit. Only the owner (hc.payout) can make a tier paid-eligible (database rule).
// No commission rate is set here and paid referrals are not switched on by anything on this page.
const PATH = "/command-center/hosting-collective/tiers";
type R = { ok: boolean; code: string };
const finish = (error: { message: string } | null): R => { if (error) return { ok: false, code: knownCode(error.message) }; revalidatePath(PATH); revalidatePath("/command-center/hosting-collective/members"); return { ok: true, code: "saved" }; };

export async function saveTier(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const p = parseTierForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const up = await supabase.rpc("hc_upsert_tier", { p_slug: v.slug, p_label: v.label, p_description: v.description, p_eligibility_notes: v.eligibilityNotes, p_sort_order: v.sortOrder, p_active: v.active, p_paid_referrals_eligible: v.paidReferralsEligible, p_reason: v.reason });
  if (up.error) return { ok: false, code: knownCode(up.error.message) };
  const b = await supabase.rpc("hc_admin_set_tier_benefits", { p_slug: v.slug, p_benefits: v.benefits, p_reason: v.reason });
  return finish(b.error);
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
