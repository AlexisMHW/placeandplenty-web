"use server";
import { revalidatePath } from "next/cache";
import { requirePayoutOwner } from "@/lib/admin/server";
import { parsePayoutActionForm, parseTermsForm } from "@/lib/admin/cc";
import { knownCode } from "@/lib/admin/messages";
import { parsePaidSwitchForm } from "@/lib/admin/tiers";
import { settleClawbackWith } from "@/lib/hc/clawback";
import { resolvePartialRefundHoldWith } from "@/lib/hc/partial-refund";

// MANUAL PAYOUT ACTIONS (founder decisions D3 and A). OWNER ONLY: hc.payout plus the owner role are checked here (requirePayoutOwner) AND inside every database function, each of which writes an audit row.
// NOTHING HERE MOVES MONEY, EVER. "Record external payment" only RECORDS a transfer the owner already made elsewhere (bank, PayPal, etc.),
// with that transfer's reference, the date sent, and an explicit confirmation. Approved is not paid. A paid payout can be reversed with a reason.
// The database error text is never forwarded; only a short known code is returned (lib/admin/messages.ts).
const PATH = "/command-center/hosting-collective/payouts";
type State = { ok: boolean; code: string };

export async function payoutAction(formData: FormData): Promise<State> {
  const { supabase } = await requirePayoutOwner(PATH);
  const parsed = parsePayoutActionForm(formData);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  let res: { data?: unknown; error: { message: string } | null };
  if (v.kind === "draft") res = await supabase.rpc("hc_create_payout_draft", { p_partner_id: v.partnerId });
  else if (v.kind === "approve") res = await supabase.rpc("hc_approve_payout", { p_payout_id: v.payoutId });
  else if (v.kind === "paid") res = await supabase.rpc("hc_record_external_payment", { p_payout_id: v.payoutId, p_external_ref: v.externalRef, p_paid_on: v.paidOn, p_method: v.method, p_confirm_external_payment: true });
  else if (v.kind === "reverse") res = await supabase.rpc("hc_reverse_recorded_payment", { p_payout_id: v.payoutId, p_reason: v.reason });
  else res = await supabase.rpc("hc_void_payout", { p_payout_id: v.payoutId, p_reason: v.reason });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  // The database reports business outcomes (below_minimum, paid_referrals_not_active ...) as data, not as an error. Anything that is not the success status is shown as a refusal.
  const status = (res.data as { status?: unknown } | null)?.status;
  const GOOD: Record<string, string[]> = { draft: ["draft"], approve: ["approved", "already_approved"], paid: ["paid_recorded", "already_recorded"], reverse: ["reversed", "already_reversed"], void: ["void", "already_void"] };
  if (typeof status === "string" && !GOOD[v.kind].includes(status)) return { ok: false, code: knownCode(status) };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}

export async function addTermsVersion(formData: FormData): Promise<State> {
  const { supabase } = await requirePayoutOwner(PATH);
  const parsed = parseTermsForm(formData, new Date());
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  const { error } = await supabase.rpc("hc_add_terms_version", {
    p_amounts: v.amounts, p_validation_days: v.validationDays, p_min_payout_cents: v.minPayoutCents, p_effective_from: v.effectiveFrom, p_note: v.note,
  });
  if (error) return { ok: false, code: knownCode(error.message) };
  revalidatePath(PATH); revalidatePath("/command-center/hosting-collective/tiers");
  return { ok: true, code: "saved" };
}

// Paid-referrals switch (owner only). Activation needs the typed phrase and a reason; both are re-checked in the database. Local code never turns it on by itself.
export async function paidReferralsSwitch(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requirePayoutOwner(PATH);
  const parsed = parsePaidSwitchForm(formData);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  const res = v.on ? await supabase.rpc("hc_activate_paid_referrals", { p_confirm: v.phrase, p_reason: v.reason }) : await supabase.rpc("hc_deactivate_paid_referrals", { p_reason: v.reason });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  const status = (res.data as { status?: unknown } | null)?.status;
  if (status !== "activated" && status !== "deactivated" && status !== "already_active" && status !== "already_inactive") return { ok: false, code: typeof status === "string" ? knownCode(status) : "failed" };
  revalidatePath(PATH);
  return { ok: true, code: "saved" };
}

// Clawback settlement (owner only). RECORDS that a clawback was recovered outside this system or waived. Moves no money and nets nothing automatically.
export async function settleClawback(formData: FormData): Promise<State> {
  const { supabase } = await requirePayoutOwner(PATH);
  const r = await settleClawbackWith(supabase, formData);
  if (r.ok) revalidatePath(PATH);
  return r;
}

// Partial-refund hold resolution (owner only; follow-up 217490). RECORDS a decision on a commission held for a partial refund review: release (back on the normal path, never early)
// or reverse (terminal). Moves no money. A commission already inside an approved / paid payout is refused by the database (commission_in_payout): use the payout controls above.
export async function resolvePartialRefundHold(formData: FormData): Promise<State> {
  const { supabase } = await requirePayoutOwner(PATH);
  const r = await resolvePartialRefundHoldWith(supabase, formData);
  if (r.ok) revalidatePath(PATH);
  return r;
}
