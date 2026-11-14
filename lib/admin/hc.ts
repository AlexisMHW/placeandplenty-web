// HOSTING COLLECTIVE ADMIN MODULE: parsing, validation and presentation helpers. Pure, no imports, no I/O.
// Every figure comes from a database function that re-checks hc.* permissions; nothing here estimates or invents data.
// Missing/malformed fields become null and the page says "not available". Email addresses arrive masked unless the
// database says the caller has hc.manage; this file never un-masks anything.

import type { StaffContext } from "./access";

export type ApplicationStatus = "received" | "in_review" | "approved" | "declined" | "withdrawn";
const APPLICATION_STATUSES: ApplicationStatus[] = ["received", "in_review", "approved", "declined", "withdrawn"];

export interface ApplicationRow {
  id: string;
  fullName: string;
  email: string; // possibly masked by the database
  status: ApplicationStatus;
  niches: string[];
  platforms: { platform: string; handle: string | null; url: string | null }[];
  audienceSummary: string;
  priorWorkUrls: string[];
  collaborationInterest: string[];
  duplicateSignals: string[];
  possibleDuplicate: boolean;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseApplications(raw: unknown): ApplicationRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ApplicationRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, any>;
    const id = str(o.id);
    const status = APPLICATION_STATUSES.find((s) => s === o.status);
    if (!id || !status) continue; // a row we cannot classify is skipped, not guessed at
    const platforms = Array.isArray(o.platforms)
      ? o.platforms
          .filter((p: any) => p && typeof p === "object" && typeof p.platform === "string")
          .map((p: any) => ({ platform: p.platform as string, handle: str(p.handle), url: str(p.url) }))
      : [];
    const signals = strArr(o.duplicate_signals);
    out.push({
      id,
      fullName: str(o.full_name) ?? "(no name)",
      email: str(o.email) ?? "(hidden)",
      status,
      niches: strArr(o.niches),
      platforms,
      audienceSummary: str(o.audience_summary) ?? "",
      priorWorkUrls: strArr(o.prior_work_urls),
      collaborationInterest: strArr(o.collaboration_interest),
      duplicateSignals: signals,
      possibleDuplicate: signals.length > 0 || typeof o.duplicate_of === "string",
      reviewedAt: str(o.reviewed_at),
      reviewNote: str(o.review_note),
      createdAt: str(o.created_at),
    });
  }
  return out;
}

export interface ReviewInput {
  id: string;
  decision: "in_review" | "approved" | "declined";
  tier: string | null;
  note: string | null;
  code: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the review form on the server before any RPC call. The database validates again. */
export function parseReviewForm(form: { get(name: string): unknown }): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const id = get("id");
  if (!UUID.test(id)) return { ok: false, error: "invalid_id" };
  const decision = get("decision");
  if (decision !== "in_review" && decision !== "approved" && decision !== "declined") return { ok: false, error: "invalid_decision" };
  const note = get("note");
  if (note.length > 1000) return { ok: false, error: "note_too_long" };
  const tier = get("tier");
  if (tier && !/^[a-z0-9_]{2,32}$/.test(tier)) return { ok: false, error: "invalid_tier" };
  // No tier is required: approving without one makes a BASIC member (no paid terms; any commission is held for the owner). A tier, if given, must exist in the database.
  const code = get("code").toLowerCase();
  if (code && !/^[a-z0-9-]{3,32}$/.test(code)) return { ok: false, error: "invalid_code_format" };
  return { ok: true, value: { id, decision, tier: tier || null, note: note || null, code: code || null } };
}

export function parseSubmissionReviewForm(form: { get(name: string): unknown }): { ok: true; value: { id: string; decision: "approved" | "changes_requested" | "rejected"; note: string | null } } | { ok: false; error: string } {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const id = get("id");
  if (!UUID.test(id)) return { ok: false, error: "invalid_id" };
  const decision = get("decision");
  if (decision !== "approved" && decision !== "changes_requested" && decision !== "rejected") return { ok: false, error: "invalid_decision" };
  const note = get("note");
  if (note.length > 1000) return { ok: false, error: "note_too_long" };
  return { ok: true, value: { id, decision, note: note || null } };
}

/** What the signed-in staff member may do. The database enforces the same rules; this only decides what to show. */
export function hcCapabilities(ctx: StaffContext) {
  const has = (p: string) => (ctx.permissions as string[]).includes(p);
  return {
    canView: has("hc.read"),
    canManage: has("hc.manage"),
    canReviewApplications: has("hc.applications.review"),
    canReviewContent: has("hc.content.review"),
    canSeePayoutActions: has("hc.payout"), // no payout action is built; shown only as an explanation
  };
}

export interface MemberRow {
  partnerId: string; displayName: string; status: string; tier: string | null; accountLinked: boolean;
  codes: number | null; signups: number | null; onboardingDone: number | null; submissions: number | null;
}
export function parseMembers(raw: unknown): MemberRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((r: any) =>
    r && typeof r.partner_id === "string" && typeof r.status === "string"
      ? [{ partnerId: r.partner_id, displayName: str(r.display_name) ?? "(no name)", status: r.status, tier: str(r.tier),
           accountLinked: r.account_linked === true, codes: int(r.codes), signups: int(r.signups),
           onboardingDone: int(r.onboarding_done), submissions: int(r.submissions) }]
      : [],
  );
}

export interface SubmissionRow {
  id: string; displayName: string; url: string; platform: string; status: string; description: string | null;
  reviewerNote: string | null; createdAt: string | null; activePermissions: string[];
}
export function parseSubmissions(raw: unknown): SubmissionRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((r: any) =>
    r && typeof r.id === "string" && typeof r.url === "string"
      ? [{ id: r.id, displayName: str(r.display_name) ?? "(no name)", url: r.url, platform: str(r.platform) ?? "other",
           status: str(r.status) ?? "submitted", description: str(r.description), reviewerNote: str(r.reviewer_note),
           createdAt: str(r.created_at), activePermissions: strArr(r.active_permissions) }]
      : [],
  );
}

export interface NotificationRow { id: number; kind: string; refType: string; refId: string; severity: "info" | "action"; createdAt: string | null; }
export function parseNotifications(raw: unknown): NotificationRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((r: any) =>
    r && typeof r.id === "number" && typeof r.kind === "string"
      ? [{ id: r.id, kind: r.kind, refType: str(r.ref_type) ?? "", refId: str(r.ref_id) ?? "",
           severity: r.severity === "action" ? ("action" as const) : ("info" as const), createdAt: str(r.created_at) }]
      : [],
  );
}

const NOTIFICATION_LABELS: Record<string, string> = {
  application_received: "New creator application",
  application_possible_duplicate: "Application with a possible duplicate (same handle as another application)",
  content_submitted: "Creator submitted content for review",
  content_permission_revoked: "A creator withdrew a content permission",
  member_claimed: "An approved creator connected their account",
};
export const notificationLabel = (kind: string) => NOTIFICATION_LABELS[kind] ?? "Notification";

export interface PayoutPartnerRow {
  partnerId: string; displayName: string; pendingCents: number | null; validatedCents: number | null;
  heldCount: number | null; outstandingClawbackCents: number | null; eligible: boolean;
}
export interface PayoutEligibility {
  programEnabled: boolean; rateConfigured: boolean; paidReferralsEnabled: boolean; live: boolean; minPayoutCents: number | null; partners: PayoutPartnerRow[];
}
export function parsePayoutEligibility(raw: unknown): PayoutEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  if (typeof r.program_enabled !== "boolean" || typeof r.rate_configured !== "boolean" || !Array.isArray(r.partners)) return null;
  return {
    programEnabled: r.program_enabled,
    rateConfigured: r.rate_configured,
    // "live" is only true when the database says so; never inferred here.
    paidReferralsEnabled: r.paid_referrals_enabled === true,
    live: r.live === true,
    minPayoutCents: int(r.min_payout_cents),
    partners: r.partners.flatMap((p: any) =>
      p && typeof p.partner_id === "string"
        ? [{ partnerId: p.partner_id, displayName: str(p.display_name) ?? "(no name)", pendingCents: int(p.pending_cents),
             validatedCents: int(p.validated_cents), heldCount: int(p.held_count),
             outstandingClawbackCents: int(p.outstanding_clawback_cents), eligible: p.eligible === true }]
        : [],
    ),
  };
}

export const dollars = (cents: number | null) => (cents === null ? "n/a" : `$${(cents / 100).toFixed(2)}`);

/** Referral / conversion rows from hc_admin_commission_report(). Counts only; amounts are ledger values, null when absent. */
export interface ReferralRow { partnerId: string; displayName: string; status: string; tier: string | null; signups: number | null; byState: Record<string, { n: number; cents: number }>; }
export function parseCommissionReport(raw: unknown): { enabled: boolean; rateConfigured: boolean; heldCount: number | null; partners: ReferralRow[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  if (!Array.isArray(r.partners)) return null;
  return {
    enabled: r.enabled === true,
    rateConfigured: r.rate_configured === true,
    heldCount: int(r.held_count),
    partners: r.partners.flatMap((p: any) => {
      if (!p || typeof p.partner_id !== "string") return [];
      const byState: Record<string, { n: number; cents: number }> = {};
      if (p.by_state && typeof p.by_state === "object") {
        for (const [k, v] of Object.entries(p.by_state as Record<string, any>)) {
          const n = int(v?.n); const cents = int(v?.cents);
          if (n !== null && cents !== null) byState[k] = { n, cents };
        }
      }
      return [{ partnerId: p.partner_id, displayName: str(p.display_name) ?? "(no name)", status: str(p.status) ?? "unknown", tier: str(p.tier), signups: int(p.signups), byState }];
    }),
  };
}
