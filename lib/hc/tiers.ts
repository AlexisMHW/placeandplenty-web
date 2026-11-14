// HC TIER CONFIGURATION (D4): configurable, no invented benefits, rates or tiers. Pure parsing/validation for the staff forms.
// Commission amounts are NOT part of a tier here: money terms live only in the owner's versioned terms (hc_terms_versions).
export interface TierRow {
  slug: string; label: string; description: string | null; eligibilityNotes: string | null; benefits: string[];
  referralEligible: boolean; assignmentsEnabled: boolean; sortOrder: number; active: boolean; members: number;
}
const str = (v: unknown) => (typeof v === "string" ? v : null);

export function parseTiers(raw: unknown): TierRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((t: any) => t && typeof t.slug === "string" && typeof t.label === "string" ? [{
    slug: t.slug, label: t.label, description: str(t.description), eligibilityNotes: str(t.eligibility_notes),
    benefits: Array.isArray(t.benefits) ? t.benefits.filter((b: unknown): b is string => typeof b === "string") : [],
    referralEligible: t.referral_eligible === true, assignmentsEnabled: t.assignments_enabled !== false,
    sortOrder: typeof t.sort_order === "number" ? t.sort_order : 0, active: t.active !== false, members: typeof t.members === "number" ? t.members : 0,
  }] : []);
}

export interface TierInput {
  slug: string; label: string; description: string | null; eligibilityNotes: string | null; benefits: string[];
  referralEligible: boolean; assignmentsEnabled: boolean; sortOrder: number; active: boolean;
}
type FormLike = { get(name: string): unknown };
const field = (f: FormLike, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string).trim() : "");

export function parseTierForm(f: FormLike): { ok: true; value: TierInput } | { ok: false; error: string } {
  const slug = field(f, "slug");
  if (!/^[a-z0-9_]{2,32}$/.test(slug)) return { ok: false, error: "invalid_slug" };
  const label = field(f, "label");
  if (label.length < 2 || label.length > 60) return { ok: false, error: "invalid_label" };
  const description = field(f, "description");
  const notes = field(f, "eligibility_notes");
  if (description.length > 600 || notes.length > 600) return { ok: false, error: "invalid_form" };
  const benefits = field(f, "benefits").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (benefits.length > 12 || benefits.some((b) => b.length > 200)) return { ok: false, error: "invalid_benefits" };
  const so = field(f, "sort_order") === "" ? 100 : Number(field(f, "sort_order"));
  if (!Number.isInteger(so) || so < 0 || so > 10000) return { ok: false, error: "invalid_form" };
  const on = (k: string) => f.get(k) === "on" || f.get(k) === "true" || f.get(k) === "1";
  return { ok: true, value: { slug, label, description: description || null, eligibilityNotes: notes || null, benefits, referralEligible: on("referral_eligible"), assignmentsEnabled: on("assignments_enabled"), sortOrder: so, active: on("active") } };
}

export function parseMemberTierForm(f: FormLike): { ok: true; value: { partnerId: string; tier: string | null } } | { ok: false; error: string } {
  const id = field(f, "partner_id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "invalid_id" };
  const tier = field(f, "tier");
  if (tier !== "" && !/^[a-z0-9_]{2,32}$/.test(tier)) return { ok: false, error: "invalid_slug" };
  return { ok: true, value: { partnerId: id, tier: tier || null } };
}

export function parseMemberStatusForm(f: FormLike): { ok: true; value: { partnerId: string; status: "approved" | "suspended"; tier: string | null } } | { ok: false; error: string } {
  const id = field(f, "partner_id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "invalid_id" };
  const status = field(f, "status");
  if (status !== "approved" && status !== "suspended") return { ok: false, error: "invalid_form" };
  const tier = field(f, "tier");
  if (tier !== "" && !/^[a-z0-9_]{2,32}$/.test(tier)) return { ok: false, error: "invalid_slug" };
  return { ok: true, value: { partnerId: id, status, tier: tier || null } };
}
