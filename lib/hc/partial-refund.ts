// OWNER-CONTROLLED resolution of a commission held for a partial refund review (follow-up 217490). RECORDS A DECISION ONLY: no money moves here.
//   release: back on the normal path (pending, then validated once the ORIGINAL 45 days have elapsed, payable only through the normal owner-only draft / approve / record).
//   reverse: terminal (the commission is never paid).
// The database function hc_resolve_partial_refund_hold repeats the owner check (owner_required), requires the note and the confirmation, and writes the audit rows.
// Pure parsing + one RPC wrapper; the database error text is never forwarded (only a known short code, lib/admin/messages.ts).
import { knownCode } from "../admin/messages.ts";
import type { RpcClient, TierResult } from "./tier-write.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const g = (f: { get(n: string): unknown }, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };
export type ResolveInput = { commissionId: string; resolution: "release" | "reverse"; note: string };

export function parseResolveHoldForm(form: { get(name: string): unknown }): { ok: true; value: ResolveInput } | { ok: false; error: string } {
  const commissionId = g(form, "commission_id"), resolution = g(form, "resolution"), note = g(form, "note");
  if (!UUID.test(commissionId)) return { ok: false, error: "invalid_id" };
  if (resolution !== "release" && resolution !== "reverse") return { ok: false, error: "invalid_resolution_hold" };
  if (note.length < 3 || note.length > 300 || /[<>]/.test(note)) return { ok: false, error: "invalid_reason" };
  if (g(form, "confirm") !== "yes") return { ok: false, error: "confirmation_required" };
  return { ok: true, value: { commissionId, resolution, note } };
}

const GOOD: Record<ResolveInput["resolution"], string[]> = { release: ["released", "already_resolved"], reverse: ["reversed", "already_resolved"] };

export async function resolvePartialRefundHoldWith(supabase: RpcClient, formData: { get(name: string): unknown }): Promise<TierResult> {
  const p = parseResolveHoldForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const res = await supabase.rpc("hc_resolve_partial_refund_hold", { p_commission_id: v.commissionId, p_resolution: v.resolution, p_note: v.note, p_confirm: true });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  const status = (res.data as { status?: unknown } | null)?.status;
  if (typeof status !== "string" || !GOOD[v.resolution].includes(status)) return { ok: false, code: typeof status === "string" ? knownCode(status) : "failed" };
  return { ok: true, code: "saved" };
}

// ---- read side (hc_admin_list_partial_refund_holds; VIEW for hc.payout) ----
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
export interface PartialRefundHold { commissionId: string; partnerId: string | null; displayName: string; product: string | null; commissionCents: number | null; purchasedAt: string | null; validateAfter: string | null; refundedCents: number | null; disputeStatus: string | null; releaseBlocker: string | null; canRelease: boolean }
export interface PartialRefundResolution { commissionId: string; resolution: "release" | "reverse"; note: string; resolvedAt: string | null; refundedCentsReviewed: number | null }
export function parseHolds(raw: unknown): { holds: PartialRefundHold[]; recent: PartialRefundResolution[] } | null {
  const o = rec(raw); if (!o || !Array.isArray(o.holds)) return null;
  const holds = o.holds.flatMap((x) => { const r = rec(x); const id = str(r?.commission_id); if (!r || !id) return [];
    return [{ commissionId: id, partnerId: str(r.partner_id), displayName: str(r.display_name) ?? "Member", product: str(r.canonical_product_id), commissionCents: int(r.commission_cents), purchasedAt: str(r.purchased_at), validateAfter: str(r.validate_after),
      refundedCents: int(r.refunded_cents), disputeStatus: str(r.dispute_status), releaseBlocker: str(r.release_blocker), canRelease: r.can_release === true }]; });
  const recent = Array.isArray(o.recent_resolutions) ? o.recent_resolutions.flatMap((x) => { const r = rec(x); const id = str(r?.commission_id); const res = r?.resolution;
    return r && id && (res === "release" || res === "reverse") ? [{ commissionId: id, resolution: res as "release" | "reverse", note: str(r.note) ?? "", resolvedAt: str(r.resolved_at), refundedCentsReviewed: int(r.refunded_cents_at_resolution) }] : []; }) : [];
  return { holds, recent };
}
export const BLOCKER_TEXT: Record<string, string> = {
  dispute_open: "A dispute is open. It cannot be released until the dispute is closed.",
  dispute_lost: "The dispute was lost. This commission will be reversed.",
  fully_refunded: "The purchase was fully refunded. This commission will be reversed.",
  entitlement_not_valid: "The purchase is no longer valid (access was revoked).",
  entitlement_not_found: "The purchase could not be found.",
};
