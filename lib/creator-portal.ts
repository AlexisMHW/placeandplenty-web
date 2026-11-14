// CREATOR PORTAL: parsing and presentation. Pure. Data comes from creator_portal_summary() which only ever returns the signed-in
// creator's own rows. Anything missing is shown as unavailable, never estimated. Money here is TRACKED, never "earned" or "paid".

export const SITE = "https://placeandplenty.com";
export type PortalState =
  | { kind: "not_member" }
  | { kind: "inactive"; status: string }
  | { kind: "member"; data: PortalData };

export interface PortalData {
  displayName: string;
  tierLabel: string | null;
  codes: string[];
  signups: number | null;
  commissionCents: Record<string, number>;
  conversions: Record<string, number>;
  minPayoutCents: number | null;
  onboarding: { slug: string; title: string; required: boolean; done: boolean }[];
  assignments: { id: string; status: string; title: string; brief: string; compensationTerms: string | null }[];
  submissions: { id: string; url: string; platform: string; status: string; activePermissions: string[] }[];
  announcements: { id: string; title: string; body: string }[];
}

const s = (v: unknown) => (typeof v === "string" ? v : null);
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const numMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) { const m = n(x); if (m !== null) out[k] = m; }
  return out;
};

export function parsePortal(raw: unknown): PortalState {
  if (!raw || typeof raw !== "object") return { kind: "not_member" };
  const r = raw as Record<string, any>;
  if (r.member !== true) return { kind: "not_member" };
  if (r.status !== "approved") return { kind: "inactive", status: s(r.status) ?? "unknown" };
  const ref = r.referral && typeof r.referral === "object" ? r.referral : {};
  return {
    kind: "member",
    data: {
      displayName: s(r.display_name) ?? "",
      tierLabel: s(r.tier?.label),
      codes: Array.isArray(ref.codes) ? ref.codes.filter((c: unknown): c is string => typeof c === "string" && /^[a-z0-9-]{3,32}$/.test(c)) : [],
      signups: n(ref.signups),
      commissionCents: numMap(ref.commission_cents),
      conversions: numMap(ref.conversions),
      minPayoutCents: n(ref.min_payout_cents),
      onboarding: Array.isArray(r.onboarding) ? r.onboarding.flatMap((o: any) => o && typeof o.slug === "string" && typeof o.title === "string" ? [{ slug: o.slug, title: o.title, required: o.required === true, done: o.done === true }] : []) : [],
      assignments: Array.isArray(r.assignments) ? r.assignments.flatMap((a: any) => a && typeof a.id === "string" ? [{ id: a.id, status: s(a.status) ?? "offered", title: s(a.title) ?? "", brief: s(a.brief) ?? "", compensationTerms: s(a.compensation_terms) }] : []) : [],
      submissions: Array.isArray(r.submissions) ? r.submissions.flatMap((x: any) => x && typeof x.id === "string" && typeof x.url === "string" ? [{ id: x.id, url: x.url, platform: s(x.platform) ?? "other", status: s(x.status) ?? "submitted", activePermissions: Array.isArray(x.permissions) ? x.permissions.flatMap((p: any) => typeof p?.scope === "string" ? [p.scope] : []) : [] }] : []) : [],
      announcements: Array.isArray(r.announcements) ? r.announcements.flatMap((a: any) => a && typeof a.id === "string" ? [{ id: a.id, title: s(a.title) ?? "", body: s(a.body) ?? "" }] : []) : [],
    },
  };
}

/** Referral URL for display. Only a well-formed code produces a link; anything else returns null. */
export function referralUrl(code: string, site = SITE): string | null {
  return /^[a-z0-9-]{3,32}$/.test(code) ? `${site}/r/${code}` : null;
}

export const dollars = (cents: number | null | undefined) => (typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "n/a");

/** The portal must not present links as live until the attribution route and flag are on. */
export function referralsLive(env: { NEXT_PUBLIC_HC_REFERRALS_LIVE?: string }): boolean {
  return env.NEXT_PUBLIC_HC_REFERRALS_LIVE === "1";
}
