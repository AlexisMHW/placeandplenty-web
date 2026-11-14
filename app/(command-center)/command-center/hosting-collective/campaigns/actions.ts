"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { parseAssignForm, parseCampaignForm } from "@/lib/admin/campaigns";

// CAMPAIGN / CHALLENGE ACTIONS. hc.manage re-checked here and inside each database function (which also writes the audit row).
// Compensation wording is whatever staff type; nothing is prefilled. Database error text is never forwarded.
const PATH = "/command-center/hosting-collective/campaigns";
const KNOWN = /not_authorized|partner_not_approved|campaign_not_found|tier_assignments_disabled|campaign_closed/;

export async function createCampaign(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const p = parseCampaignForm(formData);
  if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("hc_admin_create_campaign", { p_title: p.value.title, p_brief: p.value.brief, p_niche: p.value.niche, p_compensation_terms: p.value.compensation });
  if (error) return { ok: false, code: KNOWN.exec(error.message)?.[0] ?? "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}

export async function assignCampaign(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const p = parseAssignForm(formData);
  if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("hc_admin_assign_campaign", { p_campaign_id: p.value.campaignId, p_partner_id: p.value.partnerId });
  if (error) return { ok: false, code: KNOWN.exec(error.message)?.[0] ?? "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}

export async function closeCampaign(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const id = formData.get("campaign_id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, code: "invalid_id" };
  const { error } = await supabase.rpc("hc_admin_close_campaign", { p_campaign_id: id });
  if (error) return { ok: false, code: KNOWN.exec(error.message)?.[0] ?? "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}
