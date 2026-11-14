"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { parsePayoutActionForm, parseTermsForm } from "@/lib/admin/cc";

// PAYOUT AND TERMS ACTIONS. Owner only: hc.payout is checked here AND inside every database function, each of which writes an audit row.
// NOTHING HERE MOVES MONEY. "Mark paid" only RECORDS a transfer the owner made elsewhere (bank, PayPal, etc.) with its reference.
// The database error text is never forwarded; only a short known code is returned.
const KNOWN = /below_minimum|partner_not_approved|payout_not_draft|payout_not_approved|payout_not_voidable|not_authorized|terms_must_be_effective_in_the_future|invalid_[a-z_]+/;
const PATH = "/command-center/hosting-collective/payouts";

export async function payoutAction(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.payout", PATH);
  const parsed = parsePayoutActionForm(formData);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  let res: { data?: unknown; error: { message: string } | null };
  if (v.kind === "draft") res = await supabase.rpc("hc_create_payout_draft", { p_partner_id: v.partnerId });
  else if (v.kind === "approve") res = await supabase.rpc("hc_approve_payout", { p_payout_id: v.payoutId });
  else if (v.kind === "paid") res = await supabase.rpc("hc_mark_payout_paid", { p_payout_id: v.payoutId, p_external_ref: v.externalRef });
  else res = await supabase.rpc("hc_void_payout", { p_payout_id: v.payoutId, p_reason: v.reason });
  if (res.error) return { ok: false, code: KNOWN.exec(res.error.message)?.[0] ?? "failed" };
  // hc_create_payout_draft reports business outcomes (for example below_minimum) as data, not as an error.
  if (v.kind === "draft") {
    const status = (res.data as { status?: unknown } | null)?.status;
    if (status !== "draft") return { ok: false, code: typeof status === "string" && KNOWN.test(status) ? status : "failed" };
  }
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}

export async function addTermsVersion(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.payout", PATH);
  const parsed = parseTermsForm(formData, new Date());
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  const { error } = await supabase.rpc("hc_add_terms_version", {
    p_amounts: v.amounts, p_validation_days: v.validationDays, p_min_payout_cents: v.minPayoutCents, p_effective_from: v.effectiveFrom, p_note: v.note,
  });
  if (error) return { ok: false, code: KNOWN.exec(error.message)?.[0] ?? "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}
