// HOSTING COLLECTIVE TIERS, COMMISSION VERSIONS AND CONFIG HISTORY: parsers + form validators. Pure, no imports, no I/O.
// Commission amounts are never invented: they come from versioned terms (hc_terms_*). Paid referrals stay off until the owner enables them elsewhere.
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const g = (form: { get(name: string): unknown }, k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim() : ""; };

export interface TierRow { slug: string; label: string; description: string | null; eligibilityNotes: string | null; sortOrder: number; active: boolean; benefits: string[]; paidReferralsEligible: boolean; memberCount: number }
export function parseTiers(raw: unknown): TierRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const slug = str(o?.slug); const label = str(o?.label);
    return o && slug && label ? [{ slug, label, description: str(o.description), eligibilityNotes: str(o.eligibility_notes), sortOrder: int(o.sort_order) ?? 0, active: o.active !== false,
      benefits: Array.isArray(o.benefits) ? o.benefits.filter((b): b is string => typeof b === "string") : [], paidReferralsEligible: o.paid_referrals_eligible === true, memberCount: int(o.member_count) ?? 0 }] : []; });
}
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const reasonOf = (form: { get(name: string): unknown }) => g(form, "reason");
const badReason = (r: string) => r.length < 3 || r.length > 200 || /[<>]/.test(r);
export interface TierInput { slug: string; label: string; description: string | null; eligibilityNotes: string | null; sortOrder: number; active: boolean; paidReferralsEligible: boolean; reason: string; benefits: string[] }
export function parseTierForm(form: { get(name: string): unknown }): { ok: true; value: TierInput } | { ok: false; error: string } {
  const slug = g(form, "slug"), label = g(form, "label");
  if (!SLUG.test(slug)) return { ok: false, error: "invalid_slug" };
  if (label.length < 2 || label.length > 60) return { ok: false, error: "invalid_label" };
  const description = g(form, "description"), notes = g(form, "eligibility_notes");
  if (description.length > 400 || notes.length > 400 || /[<>]/.test(description + notes + label)) return { ok: false, error: "invalid_text" };
  const benefits = g(form, "benefits").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (benefits.length > 12 || benefits.some((b) => b.length > 120 || /[<>]/.test(b))) return { ok: false, error: "invalid_benefits" };
  const sort = g(form, "sort_order") === "" ? 100 : Number(g(form, "sort_order"));
  if (!Number.isInteger(sort) || sort < 0 || sort > 999) return { ok: false, error: "invalid_sort" };
  const reason = reasonOf(form); if (badReason(reason)) return { ok: false, error: "invalid_reason" };
  // Only the owner can change paid eligibility; the checkbox is rendered only for the owner and the database refuses anyone else.
  return { ok: true, value: { slug, label, description: description || null, eligibilityNotes: notes || null, sortOrder: sort, active: g(form, "active") === "yes", paidReferralsEligible: g(form, "paid_referrals_eligible") === "yes", reason, benefits } };
}
export function parseAssignTierForm(form: { get(name: string): unknown }): { ok: true; value: { partnerId: string; tier: string | null; reason: string } } | { ok: false; error: string } {
  const partnerId = g(form, "partner_id"), tier = g(form, "tier"), reason = reasonOf(form);
  if (!UUID.test(partnerId)) return { ok: false, error: "invalid_id" };
  if (tier !== "" && !SLUG.test(tier)) return { ok: false, error: "invalid_slug" };
  if (badReason(reason)) return { ok: false, error: "invalid_reason" };
  return { ok: true, value: { partnerId, tier: tier || null, reason } };
}
export function parseStatusForm(form: { get(name: string): unknown }): { ok: true; value: { partnerId: string; status: "approved" | "suspended"; reason: string } } | { ok: false; error: string } {
  const partnerId = g(form, "partner_id"), status = g(form, "status"), reason = reasonOf(form);
  if (!UUID.test(partnerId)) return { ok: false, error: "invalid_id" };
  if (status !== "approved" && status !== "suspended") return { ok: false, error: "invalid_state" };
  if (badReason(reason)) return { ok: false, error: "invalid_reason" };
  return { ok: true, value: { partnerId, status, reason } };
}
export function parsePaidSwitchForm(form: { get(name: string): unknown }): { ok: true; value: { on: boolean; phrase: string; reason: string } } | { ok: false; error: string } {
  const on = g(form, "mode") === "activate"; const reason = reasonOf(form); const phrase = g(form, "phrase");
  if (badReason(reason)) return { ok: false, error: "invalid_reason" };
  // The exact phrase is checked by the database too; checking it here gives a clear message before any call is made.
  if (on && phrase !== "ACTIVATE PAID REFERRALS") return { ok: false, error: "confirmation_required" };
  return { ok: true, value: { on, phrase, reason } };
}
export interface TermsVersionRow { version: number; effectiveFrom: string | null; validationDays: number | null; minPayoutCents: number | null; note: string | null; inForce: boolean; amounts: Record<string, number> }
export function parseTermsHistory(raw: unknown): TermsVersionRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const v = int(o?.version); if (!o || v === null) return [];
    const am = rec(o.amounts) ?? {}; const amounts: Record<string, number> = {};
    for (const [k, n] of Object.entries(am)) if (typeof n === "number" && Number.isFinite(n)) amounts[k] = n;
    return [{ version: v, effectiveFrom: str(o.effective_from), validationDays: int(o.validation_days), minPayoutCents: int(o.min_payout_cents), note: str(o.note), inForce: o.in_force === true, amounts }]; });
}
/** hc_admin_config_audit (216100, append-only): who changed which tier/terms/switch/member, when, before/after and the reason. */
export interface ConfigEvent { id: number; at: string | null; entity: string; key: string; action: string; label: string; reason: string | null; summary: string }
const ENTITY_LABEL: Record<string, string> = { tier: "Tier", terms: "Commission terms version", terms_amount: "Commission amount", settings: "Program setting", partner: "Member tier or status" };
const FIELDS = ["tier", "status", "active", "paid_referrals_eligible", "paid_referrals_enabled", "label", "validation_days", "min_payout_cents", "amount_cents"];
export function parseConfigAudit(raw: unknown): ConfigEvent[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const id = int(o?.id); const entity = str(o?.entity); const action = str(o?.action); if (!o || id === null || !entity || !action) return [];
    const before = rec(o.before) ?? {}, after = rec(o.after) ?? {}; const bits: string[] = [];
    for (const f of FIELDS) { const b = before[f], a = after[f]; if (a === undefined && b === undefined) continue; if (JSON.stringify(a) === JSON.stringify(b)) continue;
      const show = (v: unknown) => (v === null || v === undefined ? "none" : String(v).slice(0, 60)); bits.push(`${f.replace(/_/g, " ")}: ${show(b)} → ${show(a)}`); }
    return [{ id, at: str(o.at), entity, key: str(o.entity_key) ?? "", action, label: ENTITY_LABEL[entity] ?? "Configuration", reason: str(o.reason), summary: bits.join("; ") }]; });
}
