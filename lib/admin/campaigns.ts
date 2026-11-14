// CAMPAIGN / CHALLENGE FORM PARSING + ROW PARSING. Pure. Compensation text is free text typed by staff; nothing is pre-filled or invented.
type Form = { get(name: string): unknown };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const NICHES = ["budget_hosting", "tablescapes_decor", "bachelorette", "bridesmaids_wedding", "group_getaways", "dinner_brunch", "family_celebrations", "hosting_organization", "seasonal_entertaining"] as const;
const s = (f: Form, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string).trim() : "");

export function parseCampaignForm(f: Form): { ok: true; value: { title: string; brief: string; niche: string | null; compensation: string | null } } | { ok: false; error: string } {
  const title = s(f, "title"), brief = s(f, "brief"), niche = s(f, "niche"), comp = s(f, "compensation_terms");
  if (title.length < 2 || title.length > 120) return { ok: false, error: "invalid_title" };
  if (brief.length < 10 || brief.length > 4000) return { ok: false, error: "invalid_brief" };
  if (niche && !(NICHES as readonly string[]).includes(niche)) return { ok: false, error: "invalid_niche" };
  if (comp && (comp.length < 5 || comp.length > 1000)) return { ok: false, error: "invalid_compensation" };
  return { ok: true, value: { title, brief, niche: niche || null, compensation: comp || null } };
}
export function parseAssignForm(f: Form): { ok: true; value: { campaignId: string; partnerId: string } } | { ok: false; error: string } {
  const c = s(f, "campaign_id"), p = s(f, "partner_id");
  return UUID.test(c) && UUID.test(p) ? { ok: true, value: { campaignId: c, partnerId: p } } : { ok: false, error: "invalid_id" };
}
export interface CampaignRow { id: string; title: string; brief: string; niche: string | null; status: "draft" | "open" | "closed"; hasCompensation: boolean; assigned: number | null }
export function parseCampaigns(raw: unknown): CampaignRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CampaignRow[] = [];
  for (const r of raw) {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o.id !== "string" || typeof o.title !== "string" || !["draft", "open", "closed"].includes(o.status as string)) continue;
    out.push({ id: o.id, title: o.title, brief: typeof o.brief === "string" ? o.brief : "", niche: typeof o.niche === "string" ? o.niche : null, status: o.status as CampaignRow["status"], hasCompensation: typeof o.compensation_terms === "string" && o.compensation_terms.length > 0, assigned: typeof o.assigned === "number" ? o.assigned : null });
  }
  return out;
}
