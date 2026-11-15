// Owner-only recording of a clawback settlement (E-D3). RECORDS ONLY: no money moves here, nothing is netted automatically.
import { knownCode } from "../admin/messages.ts";
import type { RpcClient, TierResult } from "./tier-write.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const g = (f: { get(n: string): unknown }, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };
export type SettleInput = { commissionId: string; resolution: "recovered_externally" | "waived"; ref: string | null; note: string };

export function parseSettleClawbackForm(form: { get(name: string): unknown }): { ok: true; value: SettleInput } | { ok: false; error: string } {
  const commissionId = g(form, "commission_id"), resolution = g(form, "resolution"), ref = g(form, "external_ref"), note = g(form, "note");
  if (!UUID.test(commissionId)) return { ok: false, error: "invalid_id" };
  if (resolution !== "recovered_externally" && resolution !== "waived") return { ok: false, error: "invalid_state" };
  if (note.length < 3 || note.length > 300 || /[<>]/.test(note)) return { ok: false, error: "invalid_reason" };
  if (ref.length > 120 || /[<>]/.test(ref)) return { ok: false, error: "invalid_text" };
  if (resolution === "recovered_externally" && ref.length < 4) return { ok: false, error: "external_reference_required" };
  if (g(form, "confirm") !== "yes") return { ok: false, error: "confirmation_required" };
  return { ok: true, value: { commissionId, resolution, ref: ref || null, note } };
}

export async function settleClawbackWith(supabase: RpcClient, formData: { get(name: string): unknown }): Promise<TierResult> {
  const p = parseSettleClawbackForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const res = await supabase.rpc("hc_settle_clawback", { p_commission_id: v.commissionId, p_resolution: v.resolution, p_external_ref: v.ref, p_note: v.note, p_confirm: true });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  const status = (res.data as { status?: unknown } | null)?.status;
  if (status !== "settled" && status !== "already_settled") return { ok: false, code: typeof status === "string" ? knownCode(status) : "failed" };
  return { ok: true, code: "saved" };
}
