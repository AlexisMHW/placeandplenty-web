"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { codeFrom, type ActionResult } from "@/lib/hc/lifecycle";
import { parseTierForm, parseMemberTierForm, parseMemberStatusForm } from "@/lib/hc/tiers";
import { reviewApplication, reviewSubmission, acknowledgeNotification } from "./actions";
import { createCampaign, assignCampaign, closeCampaign } from "./campaigns/actions";

// State-aware wrappers so every HC staff form shows a visible success or error message (useFormState). They add NO new authority: each one
// calls the existing permission-checked action or a database function that re-checks the permission and writes the audit log.
const BASE = "/command-center/hosting-collective";

// Wrappers: gate here (literal permission, same as the wrapped action) so the gate is visible and checked BEFORE delegating.
export async function reviewApplicationForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.applications.review", `${BASE}/applications`); return reviewApplication(fd); }
export async function reviewSubmissionForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.content.review", `${BASE}/content`); return reviewSubmission(fd); }
export async function acknowledgeNotificationForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.manage", BASE); return acknowledgeNotification(fd); }
export async function createCampaignForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.manage", `${BASE}/campaigns`); return createCampaign(fd); }
export async function assignCampaignForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.manage", `${BASE}/campaigns`); return assignCampaign(fd); }
export async function closeCampaignForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.manage", `${BASE}/campaigns`); return closeCampaign(fd); }


export async function upsertTierForm(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff("hc.manage", `${BASE}/tiers`);
  const p = parseTierForm(fd); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const { error } = await supabase.rpc("hc_admin_upsert_tier", {
    p_slug: v.slug, p_label: v.label, p_description: v.description, p_eligibility_notes: v.eligibilityNotes, p_benefits: v.benefits,
    p_referral_eligible: v.referralEligible, p_assignments_enabled: v.assignmentsEnabled, p_sort_order: v.sortOrder, p_active: v.active,
  });
  if (error) return { ok: false, code: codeFrom(error.message) };
  revalidatePath(`${BASE}/tiers`); return { ok: true, code: "saved" };
}

export async function setMemberTierForm(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff("hc.manage", `${BASE}/members`);
  const p = parseMemberTierForm(fd); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("hc_admin_set_member_tier", { p_partner_id: p.value.partnerId, p_tier: p.value.tier });
  if (error) return { ok: false, code: codeFrom(error.message) };
  revalidatePath(`${BASE}/members`); return { ok: true, code: "saved" };
}

export async function setMemberStatusForm(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff("hc.manage", `${BASE}/members`);
  const p = parseMemberStatusForm(fd); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("hc_set_partner_status", { p_partner_id: p.value.partnerId, p_status: p.value.status, p_tier: null });
  if (error) return { ok: false, code: codeFrom(error.message) };
  revalidatePath(`${BASE}/members`); return { ok: true, code: "saved" };
}

export async function ackEventForm(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff("hc.manage", `${BASE}/inbox`);
  const id = Number(fd.get("id")); if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, code: "invalid_id" };
  const { error } = await supabase.rpc("hc_admin_ack_event", { p_id: id });
  if (error) return { ok: false, code: codeFrom(error.message) };
  revalidatePath(`${BASE}/inbox`); return { ok: true, code: "saved" };
}

