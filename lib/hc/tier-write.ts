// Tier writes, written against a minimal client so they can be tested with a fake. No Next.js imports.
// E-B1/E-B2: the ordinary tier form NEVER sends paid-referral eligibility; it sends NULL, which the database treats as "unchanged"
// (and which a manager may send). Changing eligibility is a separate, owner-only, explicit action with a reason and a confirmation.
import { parseTierEligibilityForm, parseTierForm, parseTiers } from "../admin/tiers.ts";
import { knownCode } from "../admin/messages.ts";

export interface RpcClient { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data?: unknown; error: { message: string } | null }> }
export type TierResult = { ok: boolean; code: string };
type Form = { get(name: string): unknown };

export async function saveTierWith(supabase: RpcClient, formData: Form): Promise<TierResult> {
  const p = parseTierForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const up = await supabase.rpc("hc_upsert_tier", { p_slug: v.slug, p_label: v.label, p_description: v.description, p_eligibility_notes: v.eligibilityNotes, p_sort_order: v.sortOrder, p_active: v.active, p_paid_referrals_eligible: null, p_reason: v.reason });
  if (up.error) return { ok: false, code: knownCode(up.error.message) };
  const b = await supabase.rpc("hc_admin_set_tier_benefits", { p_slug: v.slug, p_benefits: v.benefits, p_reason: v.reason });
  if (b.error) return { ok: false, code: knownCode(b.error.message) };
  return { ok: true, code: "saved" };
}

/** Explicit eligibility change. Re-reads the tier so every other field is passed back unchanged; the database still requires hc.payout. */
export async function setTierEligibilityWith(supabase: RpcClient, formData: Form): Promise<TierResult> {
  const p = parseTierEligibilityForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const list = await supabase.rpc("hc_admin_list_tiers");
  if (list.error) return { ok: false, code: knownCode(list.error.message) };
  const t = (parseTiers(list.data) ?? []).find((x) => x.slug === v.slug);
  if (!t) return { ok: false, code: "not_found" };
  if (t.paidReferralsEligible === v.eligible) return { ok: true, code: "saved" }; // nothing to change
  const up = await supabase.rpc("hc_upsert_tier", { p_slug: t.slug, p_label: t.label, p_description: t.description, p_eligibility_notes: t.eligibilityNotes, p_sort_order: t.sortOrder, p_active: t.active, p_paid_referrals_eligible: v.eligible, p_reason: v.reason });
  if (up.error) return { ok: false, code: knownCode(up.error.message) };
  return { ok: true, code: "saved" };
}
