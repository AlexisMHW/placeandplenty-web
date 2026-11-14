// FOUNDER NOTIFICATIONS (decision D5): parsers + form validators for the inbox, the email channel settings and the delivery log.
// Pure, no imports, no I/O. The settings parser never sees the verification code (the database never returns it).
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const g = (form: { get(name: string): unknown }, k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim() : ""; };

export type Severity = "info" | "warning" | "critical";
export interface InboxItem { id: number; category: string; severity: Severity; title: string; body: string | null; link: string | null; occurrences: number; status: "open" | "acknowledged" | "resolved"; firstSeenAt: string | null; lastSeenAt: string | null }
const SEV: Severity[] = ["info", "warning", "critical"];
export function parseInbox(raw: unknown): InboxItem[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const id = int(o?.id); const title = str(o?.title);
    const severity = SEV.find((s) => s === o?.severity); const status = (["open", "acknowledged", "resolved"] as const).find((s) => s === o?.status);
    const link = str(o?.link);
    return o && id !== null && title && severity && status ? [{ id, category: str(o.category) ?? "other", severity, title, body: str(o.body), link: link && /^\/command-center(\/[a-z0-9-]+)*$/.test(link) ? link : null, occurrences: int(o.occurrences) ?? 1, status, firstSeenAt: str(o.first_seen_at), lastSeenAt: str(o.last_seen_at) }] : []; });
}
export interface InboxCounts { open: number; critical: number; warning: number }
export function parseCounts(raw: unknown): InboxCounts | null {
  const o = rec(raw); const open = int(o?.open); if (!o || open === null) return null;
  return { open, critical: int(o.critical) ?? 0, warning: int(o.warning) ?? 0 };
}
export const CATEGORY_LABEL: Record<string, string> = {
  hc_application_received: "New application", hc_application_possible_duplicate: "Possible duplicate application", hc_applications_awaiting_review: "Applications awaiting review",
  hc_application_approved: "Application approved", hc_application_declined: "Application declined", hc_member_onboarded: "New member onboarding", hc_content_submitted: "Creator content",
  hc_payout_needs_approval: "Payout needs approval", comms_failed_or_delayed: "Messages failed or delayed", system_failure: "System failure",
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? "Notification";
export interface NotificationSettings { destination: string | null; destinationStatus: "unset" | "pending_verification" | "verified"; verifiedAt: string | null; emailEnabled: boolean; minSeverity: Severity; awaitingReviewHours: number; payoutApprovalHours: number; canManage: boolean; emailPendingCount: number }
export function parseSettings(raw: unknown): NotificationSettings | null {
  const o = rec(raw); if (!o) return null;
  const ds = (["unset", "pending_verification", "verified"] as const).find((s) => s === o.destination_status);
  const sev = SEV.find((s) => s === o.email_min_severity); const a = int(o.awaiting_review_hours), p = int(o.payout_approval_hours);
  if (!ds || !sev || a === null || p === null) return null;
  return { destination: str(o.destination), destinationStatus: ds, verifiedAt: str(o.verified_at), emailEnabled: o.email_enabled === true, minSeverity: sev, awaitingReviewHours: a, payoutApprovalHours: p, canManage: o.can_manage === true, emailPendingCount: int(o.email_pending_count) ?? 0 };
}
export interface DeliveryRow { id: number; kind: "notification" | "verification"; status: string; attempts: number; lastError: string | null; queuedAt: string | null; sentAt: string | null; deliveredAt: string | null; title: string | null; severity: string | null; retryable: boolean }
export function parseDeliveries(raw: unknown): DeliveryRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((x) => { const o = rec(x); const id = int(o?.id); const status = str(o?.status);
    return o && id !== null && status ? [{ id, kind: o.kind === "verification" ? "verification" as const : "notification" as const, status, attempts: int(o.attempts) ?? 0, lastError: str(o.last_error), queuedAt: str(o.queued_at), sentAt: str(o.sent_at), deliveredAt: str(o.delivered_at), title: str(o.title), severity: str(o.severity), retryable: o.retryable === true }] : []; });
}
/** queued != sent != delivered. Same wording as the email dispatcher's operator labels (lib/comms/status.ts, A4). */
export function deliveryLabel(s: string): string {
  return ({ queued: "Queued (not yet handed to the mail provider)", sending: "Being handed to the mail provider", sent: "Sent to provider (delivery not confirmed)", delivered: "Delivered to recipient's email provider", delayed: "Delayed at recipient's provider", failed: "Failed to send", bounced: "Bounced (address cannot receive mail)", suppressed: "Suppressed (recipient opted out or complained; not sent)" } as Record<string, string>)[s] ?? s;
}
export function parseStateForm(form: { get(name: string): unknown }): { ok: true; value: { id: number; state: "acknowledged" | "resolved" } } | { ok: false; error: string } {
  const id = Number(g(form, "id")); const state = g(form, "state");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "invalid_id" };
  if (state !== "acknowledged" && state !== "resolved") return { ok: false, error: "invalid_state" };
  return { ok: true, value: { id, state } };
}
export function parseDestinationForm(form: { get(name: string): unknown }): { ok: true; value: { email: string } } | { ok: false; error: string } {
  const email = g(form, "email").toLowerCase();
  if (email.length > 254 || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email)) return { ok: false, error: "invalid_email" };
  return { ok: true, value: { email } };
}
export function parseVerifyForm(form: { get(name: string): unknown }): { ok: true; value: { code: string } } | { ok: false; error: string } {
  const code = g(form, "code").toLowerCase();
  return /^[0-9a-f]{8}$/.test(code) ? { ok: true, value: { code } } : { ok: false, error: "wrong_code" };
}
export function parseEmailToggleForm(form: { get(name: string): unknown }): { ok: true; value: { enabled: boolean; minSeverity: Severity } } | { ok: false; error: string } {
  const sev = SEV.find((s) => s === g(form, "min_severity")); if (!sev) return { ok: false, error: "invalid_severity" };
  return { ok: true, value: { enabled: g(form, "enabled") === "yes", minSeverity: sev } };
}
export function parseThresholdsForm(form: { get(name: string): unknown }): { ok: true; value: { review: number; payout: number } } | { ok: false; error: string } {
  const r = Number(g(form, "awaiting_review_hours")), p = Number(g(form, "payout_approval_hours"));
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 720;
  return ok(r) && ok(p) ? { ok: true, value: { review: r, payout: p } } : { ok: false, error: "invalid_hours" };
}
export function parseRetryForm(form: { get(name: string): unknown }): { ok: true; value: { id: number } } | { ok: false; error: string } {
  const id = Number(g(form, "id")); return Number.isInteger(id) && id > 0 ? { ok: true, value: { id } } : { ok: false, error: "invalid_id" };
}
