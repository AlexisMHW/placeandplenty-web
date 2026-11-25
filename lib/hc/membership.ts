// HC MEMBERSHIP RULES (WS-E3): leave-the-Collective copy and parsing, staff overview parsing, re-apply form parsing. Pure; no I/O.
// Copy below is the founder's exact wording (en) with a Spanish rendering for when the portal gains a language switch.
export type Lang = "en" | "es";
export const LEAVE_COPY: Record<Lang, { open: string; title: string; body: string[]; keep: string; leave: string }> = {
  en: {
    open: "Leave the Hosting Collective",
    title: "Leave the Hosting Collective?",
    body: [
      "We're sorry to see you go! You can leave the Hosting Collective whenever you'd like.",
      "Leaving will end your community membership and access to member-only features. Your Place & Plenty account and gatherings will not be affected.",
      "If you're a Hosting Partner, any outstanding commissions will remain subject to the program's payout and eligibility terms.",
    ],
    keep: "Keep My Membership",
    leave: "Leave the Collective",
  },
  es: {
    open: "Dejar el Hosting Collective",
    title: "¿Dejar el Hosting Collective?",
    body: [
      "¡Lamentamos verte partir! Puedes dejar el Hosting Collective cuando quieras.",
      "Al dejarlo, terminará tu membresía en la comunidad y el acceso a las funciones exclusivas para miembros. Tu cuenta de Place & Plenty y tus reuniones no se verán afectadas.",
      "Si eres Hosting Partner, las comisiones pendientes seguirán sujetas a los términos de pago y elegibilidad del programa.",
    ],
    keep: "Conservar mi membresía",
    leave: "Dejar el Collective",
  },
};

/** Only an approved or paused member can leave; anyone else has nothing to leave. */
export const canLeave = (status: string | null | undefined) => status === "approved" || status === "suspended";

export const REJOIN_COPY: Record<Lang, { title: string; body: string; button: string }> = {
  en: { title: "Want to come back?", body: "You can rejoin the Hosting Collective. Your Place & Plenty account was not affected. Some memberships need a quick review by our team first.", button: "Rejoin the Collective" },
  es: { title: "¿Quieres volver?", body: "Puedes volver a unirte al Hosting Collective. Tu cuenta de Place & Plenty no se vio afectada. Algunas membresías requieren una revisión rápida de nuestro equipo.", button: "Volver al Collective" },
};

/** A member who left can ask to rejoin. Whether it is instant or needs staff review is decided by the database, never here. */
export const canRejoin = (status: string | null | undefined) => status === "left";
export interface RejoinResult { status: "approved"; already: boolean; rejoined: boolean; tier: string | null }
export function parseRejoinResult(raw: unknown): RejoinResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.status !== "approved") return null;
  return { status: "approved", already: r.already === true, rejoined: r.rejoined === true, tier: typeof r.tier === "string" ? r.tier : null };
}

export interface LeaveResult { status: "left"; already: boolean; outstandingCommissions: boolean }
export function parseLeaveResult(raw: unknown): LeaveResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.status !== "left") return null;
  return { status: "left", already: r.already === true, outstandingCommissions: r.outstanding_commissions === true };
}

const str = (v: unknown) => (typeof v === "string" ? v : null);
export interface MembershipOverview {
  leftMembers: { partnerId: string; displayName: string; tier: string | null; leftAt: string | null; leftFromStatus: string | null; outstandingCommissions: boolean }[];
  rejoinedMembers: { partnerId: string; displayName: string; tier: string | null; rejoinedAt: string | null }[];
  drafts: { draftId: string; updatedAt: string | null; expiresAt: string | null; noticeQueuedAt: string | null; expiredAt: string | null }[];
  declined: { applicationId: string; fullName: string; decidedAt: string | null; eligibleAfter: string | null; override: "blocked" | "allowed" | null }[];
  settings: { reapplyWaitDays: number; draftExpiryDays: number; draftNoticeDays: number };
}
export function parseMembershipOverview(raw: unknown): MembershipOverview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  if (!Array.isArray(r.left_members) || !Array.isArray(r.drafts) || !Array.isArray(r.declined) || !r.settings) return null;
  const n = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  return {
    leftMembers: r.left_members.flatMap((m: any) => m && typeof m.partner_id === "string"
      ? [{ partnerId: m.partner_id, displayName: str(m.display_name) ?? "(no name)", tier: str(m.tier), leftAt: str(m.left_at), leftFromStatus: str(m.left_from_status), outstandingCommissions: m.outstanding_commissions === true }] : []),
    rejoinedMembers: (Array.isArray(r.rejoined_members) ? r.rejoined_members : []).flatMap((m: any) => m && typeof m.partner_id === "string"
      ? [{ partnerId: m.partner_id, displayName: str(m.display_name) ?? "(no name)", tier: str(m.tier), rejoinedAt: str(m.rejoined_at) }] : []),
    drafts: r.drafts.flatMap((d: any) => d && typeof d.draft_id === "string"
      ? [{ draftId: d.draft_id, updatedAt: str(d.updated_at), expiresAt: str(d.expires_at), noticeQueuedAt: str(d.notice_queued_at), expiredAt: str(d.expired_at) }] : []),
    declined: r.declined.flatMap((a: any) => a && typeof a.application_id === "string"
      ? [{ applicationId: a.application_id, fullName: str(a.full_name) ?? "(no name)", decidedAt: str(a.decided_at), eligibleAfter: str(a.eligible_after),
           override: a.override === "blocked" || a.override === "allowed" ? a.override : null }] : []),
    settings: { reapplyWaitDays: n(r.settings.reapply_wait_days, 90), draftExpiryDays: n(r.settings.draft_expiry_days, 30), draftNoticeDays: n(r.settings.draft_notice_days, 7) },
  };
}

type FormLike = { get(name: string): unknown };
const field = (f: FormLike, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string).trim() : "");
export function parseReapplyForm(f: FormLike): { ok: true; value: { applicationId: string; mode: "blocked" | "allowed" | "default"; reason: string } } | { ok: false; error: string } {
  const id = field(f, "application_id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "invalid_id" };
  const mode = field(f, "mode");
  if (mode !== "blocked" && mode !== "allowed" && mode !== "default") return { ok: false, error: "invalid_form" };
  const reason = field(f, "reason");
  if (reason.length < 3 || reason.length > 500) return { ok: false, error: "reason_required" };
  return { ok: true, value: { applicationId: id, mode, reason } };
}
