// Application review flow (testable core of the reviewApplication server action). Exactly ONE database call records the decision; for
// approved/declined that RPC also enqueues the single applicant notification in the same transaction. This function never enqueues a second
// time. After a successful save it calls the injected `afterDecision` hook (dispatch, default OFF) and ignores its outcome.
import type { ReviewInput } from "../admin/hc.ts";

export interface ReviewRpc { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data?: unknown; error: { message: string } | null }>; }

export async function submitApplicationReview(
  supabase: ReviewRpc, v: ReviewInput, afterDecision: (decision: string) => Promise<unknown>,
): Promise<{ ok: boolean; code: string }> {
  const { error } = await supabase.rpc("hc_review_application", { p_id: v.id, p_decision: v.decision, p_tier: v.tier, p_note: v.note, p_code: v.code });
  if (error) return { ok: false, code: /tier_not_configured|already_approved|application_closed|invalid_code_format/.exec(error.message)?.[0] ?? "failed" };
  try { await afterDecision(v.decision); } catch { /* the decision is saved; dispatch problems never change it */ }
  return { ok: true, code: "saved" };
}
