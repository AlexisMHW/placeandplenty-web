// Owner-only resolution of a commission held for a PARTIAL REFUND review (follow-up 217490, supabase/qa_package/followup). RECORDS A DECISION ONLY: no money moves here.
// release -> the commission goes back to pending and follows the normal 45-day / draft / approve / record path; reverse -> terminal, nothing is ever paid for it.
// Pure parsers plus one function written against a minimal client so it can be tested with a fake. No Next.js imports.
import { knownCode } from "../admin/messages.ts";
import type { RpcClient, TierResult } from "./tier-write.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const g = (f: { get(n: string): unknown }, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };

export interface PartialRefundHold { commissionId: string; partnerId: string | null; displayName: string; product: string | null; commissionCents: number | null; baseCents: number | null; refundedCents: number | null; purchasedAt: string | null; validateAfter: string | null; releaseBlocker: string | null; canRelease: boolean; inPayout: boolean }
export interface PartialRefundResolution { commissionId: string; resolution: string; note: string | null; resolvedAt: string | null; refundedCents: number | null }
export interface PartialRefundHolds { holds: PartialRefundHold[]; recent: PartialRefundResolution[] }

/** hc_admin_list_partial_refund_holds. Anything that does not look right returns null (the page then says "not available"). */
export function parsePartialRefundHolds(raw: unknown): PartialRefundHolds | null {
  const o = rec(raw); if (!o || !Array.isArray(o.holds)) return null;
  const holds = o.holds.flatMap((x) => { const r = rec(x); const id = str(r?.commission_id);
    return r && id ? [{ commissionId: id, partnerId: str(r.partner_id), displayName: str(r.display_name) ?? "(no name)", product: str(r.canonical_product_id), commissionCents: int(r.commission_cents), baseCents: int(r.base_amount_cents),
      refundedCents: int(r.refunded_cents), purchasedAt: str(r.purchased_at), validateAfter: str(r.validate_after), releaseBlocker: str(r.release_blocker), canRelease: r.can_release === true, inPayout: str(r.payout_id) !== null }] : []; });
  const recent = Array.isArray(o.recent_resolutions) ? o.recent_resolutions.flatMap((x) => { const r = rec(x); const id = str(r?.commission_id); const res = str(r?.resolution);
    return r && id && res ? [{ commissionId: id, resolution: res, note: str(r.note), resolvedAt: str(r.resolved_at), refundedCents: int(r.refunded_cents_at_resolution) }] : []; }) : [];
  return { holds, recent };
}

export type ResolveInput = { commissionId: string; resolution: "release" | "reverse"; note: string };
export function parseResolveHoldForm(form: { get(name: string): unknown }): { ok: true; value: ResolveInput } | { ok: false; error: string } {
  const commissionId = g(form, "commission_id"), resolution = g(form, "resolution"), note = g(form, "note");
  if (!UUID.test(commissionId)) return { ok: false, error: "invalid_id" };
  if (resolution !== "release" && resolution !== "reverse") return { ok: false, error: "invalid_resolution" };
  if (note.length < 3 || note.length > 300 || /[<>]/.test(note)) return { ok: false, error: "invalid_reason" };
  if (g(form, "confirm") !== "yes") return { ok: false, error: "confirmation_required" };
  return { ok: true, value: { commissionId, resolution, note } };
}

export async function resolvePartialRefundHoldWith(supabase: RpcClient, formData: { get(name: string): unknown }): Promise<TierResult> {
  const p = parseResolveHoldForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const res = await supabase.rpc("hc_resolve_partial_refund_hold", { p_commission_id: v.commissionId, p_resolution: v.resolution, p_note: v.note, p_confirm: true });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  const status = (res.data as { status?: unknown } | null)?.status;
  if (status !== "released" && status !== "reversed" && status !== "already_resolved") return { ok: false, code: typeof status === "string" ? knownCode(status) : "failed" };
  return { ok: true, code: "saved" };
}
