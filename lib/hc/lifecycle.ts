// HOSTING COLLECTIVE LIFECYCLE: pure parsing, state copy and action-feedback text. No I/O.
// Data comes from creator_program_status() (own rows only; the database never returns internal review notes or the applicant's email).
// No commission rate, referral promise or payout amount appears in any text here (D4: nothing is invented).

export type ApplicationState = "received" | "in_review" | "approved" | "declined" | "withdrawn";
export type MemberState = "applied" | "approved" | "declined" | "suspended" | "left";

export interface ProgramStatus {
  application: { status: ApplicationState; submittedAt: string | null; decidedAt: string | null } | null;
  member: {
    status: MemberState;
    tier: { slug: string; label: string; description: string | null; benefits: string[] } | null;
    assignmentsEnabled: boolean;
    referral: { eligible: boolean; reason: string } | null;
  } | null;
}

const APP: readonly string[] = ["received", "in_review", "approved", "declined", "withdrawn"];
const MEM: readonly string[] = ["applied", "approved", "declined", "suspended", "left"];
const str = (v: unknown) => (typeof v === "string" ? v : null);

export function parseProgramStatus(raw: unknown): ProgramStatus {
  const empty: ProgramStatus = { application: null, member: null };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Record<string, any>;
  const a = r.application;
  const m = r.member;
  const application = a && typeof a === "object" && APP.includes(a.status)
    ? { status: a.status as ApplicationState, submittedAt: str(a.submitted_at), decidedAt: str(a.decided_at) } : null;
  let member: ProgramStatus["member"] = null;
  if (m && typeof m === "object" && MEM.includes(m.status)) {
    const t = m.tier && typeof m.tier === "object" && typeof m.tier.slug === "string" && typeof m.tier.label === "string"
      ? { slug: m.tier.slug as string, label: m.tier.label as string, description: str(m.tier.description),
          benefits: Array.isArray(m.tier.benefits) ? (m.tier.benefits as unknown[]).filter((b): b is string => typeof b === "string").slice(0, 12) : [] }
      : null;
    const ref = m.referral && typeof m.referral === "object" ? { eligible: m.referral.eligible === true, reason: str(m.referral.reason) ?? "unknown" } : null;
    member = { status: m.status as MemberState, tier: t, assignmentsEnabled: m.assignments_enabled !== false, referral: ref };
  }
  return { application, member };
}

export const canWithdraw = (s: ApplicationState) => s === "received" || s === "in_review";

/** Applicant-facing state text. Declined never reveals an internal note. No money terms. */
export function applicationCopy(s: ApplicationState): { title: string; body: string } {
  switch (s) {
    case "received": return { title: "Application received", body: "We have your application and will review it. We will email you when there is a decision. You can withdraw it below if you changed your mind." };
    case "in_review": return { title: "Application in review", body: "Your application is being reviewed. You can withdraw it below if you changed your mind." };
    case "approved": return { title: "Application approved", body: "Your application was approved. If you do not see your creator page yet, sign in with the email address you applied with." };
    case "declined": return { title: "Application not accepted", body: "We are not able to offer you a place right now. Reply to our email if you have a question." };
    case "withdrawn": return { title: "Application withdrawn", body: "You withdrew this application. No action is needed." };
  }
}

export function memberStatusCopy(s: MemberState): { title: string; body: string } | null {
  switch (s) {
    case "suspended": return { title: "Your creator account is paused", body: "Your referral link and new campaigns are paused. Please contact Place & Plenty if you have questions." };
    case "applied": return { title: "Membership pending", body: "Your membership is not active yet." };
    case "declined": return { title: "Membership not active", body: "Your membership is not active. Please contact Place & Plenty if you have questions." };
    case "left": return { title: "You have left the Hosting Collective", body: "Your Place & Plenty account and gatherings are not affected. If you have questions about outstanding commissions, please contact Place & Plenty." };
    default: return null;
  }
}

export const REFERRAL_REASON_COPY: Record<string, string> = {
  program_disabled: "Referral tracking is not switched on yet.",
  basic_member_no_paid_terms: "Your membership does not include paid referral terms.",
  tier_not_referral_eligible: "Your membership level does not include paid referrals.",
  tier_inactive: "Your membership level is not active.",
  partner_not_approved: "Your account is not active.",
  ok: "",
};

/** Short, safe, user-visible text for every action code returned by the HC server actions (never database text). */
const FEEDBACK: Record<string, string> = {
  saved: "Saved.", withdrawn: "Your application was withdrawn.", sent: "Done.",
  failed: "That did not work. Nothing was changed. Please try again, and contact us if it keeps happening.",
  not_authorized: "You do not have permission to do that.", not_signed_in: "Please sign in again.",
  invalid_id: "That item could not be found.", invalid_url: "Please enter a valid link starting with https://.",
  invalid_form: "Please check the form and try again.",
  no_application: "We could not find an application for this account.", not_withdrawable: "This application can no longer be withdrawn.",
  tier_not_configured: "That tier is not set up or is not active.", already_approved: "This application is already approved.",
  application_closed: "This application is already closed.", invalid_code_format: "Referral codes use 3-32 lowercase letters, numbers or dashes.",
  partner_not_approved: "That member is not currently approved.", partner_not_found: "Member not found.",
  below_minimum: "Not enough validated commission to reach the minimum payout.",
  payout_not_draft: "That payout is not a draft.", payout_not_approved: "That payout is not approved yet.", payout_not_voidable: "That payout can no longer be voided.",
  terms_must_be_effective_in_the_future: "Terms must take effect in the future.",
  owner_required: "Only the owner can change that setting.", not_verified: "That destination has not been verified yet.",
  invalid_address: "Please enter a valid email address.", invalid_slug: "Tier id: 2-32 lowercase letters, numbers or underscores.",
  invalid_label: "Name must be 2-60 characters.", invalid_benefits: "Benefits: up to 12 short lines.",
  not_offered: "That offer is no longer open.", disclosure_required: "Please confirm you disclosed the partnership.",
  expired: "That item has expired.", closed: "That campaign is closed.", not_found: "That item could not be found.",
  tier_assignments_disabled: "This member's tier does not allow campaign assignments.", campaign_not_found: "Campaign not found.", campaign_closed: "That campaign is closed.", invalid_status: "That status change is not allowed.",
  rejoined: "Welcome back. You are a member of the Hosting Collective again.", requires_staff_review: "Your request to rejoin needs a quick review by our team. We will be in touch.", not_left: "Your membership is not in a state that can be rejoined.",
  left: "You have left the Hosting Collective. Your Place & Plenty account and gatherings are not affected.", not_a_member: "We could not find a membership for this account.",
  application_not_declined: "Only a declined application can have a re-apply setting.", reason_required: "Please add a short reason (3-500 characters).",
  rate_limited: "You have submitted a lot today. Please try again tomorrow.", assignment_not_accepted: "Accept the campaign before submitting content for it.",
};

export function feedbackMessage(code: string | null | undefined): string {
  if (!code) return FEEDBACK.failed;
  return FEEDBACK[code] ?? FEEDBACK.failed;
}

export interface ActionResult { ok: boolean; code: string }
export const OK: ActionResult = { ok: true, code: "saved" };
/** Reduce an error message to a known code, or "failed". Database text is never forwarded. */
export function codeFrom(message: string | null | undefined, extra: RegExp = /(?!)/): string {
  const m = typeof message === "string" ? message : "";
  const k = new RegExp(`${Object.keys(FEEDBACK).filter((x) => /^[a-z_]+$/.test(x) && x !== "failed" && x !== "saved").join("|")}`).exec(m);
  return k?.[0] ?? extra.exec(m)?.[0] ?? "failed";
}
