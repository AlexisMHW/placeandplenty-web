// HC EVENTS (D5): event labels, row parsing, and the delivery dispatcher. The DATABASE emits events (triggers on applications, members,
// payouts and content); this file only reads them and drives delivery. Pure except for the injected deps. No addresses are hardcoded:
// staff email destinations are rows owned by the owner (verified before use) and applicant addresses come from the database resolver.
// Statuses are kept honest: "sent" means the provider accepted it, never "delivered". Only a provider confirmation records "delivered".
import { applicationApprovedMessage, applicationDeclinedMessage } from "./notifications.ts";

export type EventSeverity = "info" | "action" | "critical";
export const EVENT_LABELS: Record<string, { label: string; staffEmailSubject: string }> = {
  application_received: { label: "New creator application", staffEmailSubject: "New Hosting Collective application" },
  application_possible_duplicate: { label: "Application may be a duplicate", staffEmailSubject: "Hosting Collective application needs a duplicate check" },
  application_awaiting_review: { label: "Application waiting for review", staffEmailSubject: "A Hosting Collective application is waiting for review" },
  application_approved: { label: "Application approved", staffEmailSubject: "Hosting Collective application approved" },
  application_declined: { label: "Application declined", staffEmailSubject: "Hosting Collective application declined" },
  application_withdrawn: { label: "Application withdrawn by applicant", staffEmailSubject: "A Hosting Collective application was withdrawn" },
  member_onboarded: { label: "New member signed in", staffEmailSubject: "A new Hosting Collective member is on board" },
  content_submitted: { label: "Content submitted for review", staffEmailSubject: "Hosting Collective content is waiting for review" },
  content_permission_revoked: { label: "Content permission revoked", staffEmailSubject: "A creator revoked a content permission" },
  member_suspended: { label: "Member suspended", staffEmailSubject: "A Hosting Collective member was suspended" },
  member_reinstated: { label: "Member reinstated", staffEmailSubject: "A Hosting Collective member was reinstated" },
  payout_needs_approval: { label: "Payout draft needs your approval", staffEmailSubject: "A Hosting Collective payout needs your approval" },
};
export const eventLabel = (kind: string) => EVENT_LABELS[kind]?.label ?? "Notification";

/** Where an inbox row links to. Ids only; never a name, email or amount. */
export function eventHref(kind: string, refType: string): string {
  if (refType === "creator_application") return "/command-center/hosting-collective/applications";
  if (refType === "payout") return "/command-center/hosting-collective/payouts";
  if (refType === "submission") return "/command-center/hosting-collective/content";
  return "/command-center/hosting-collective/members";
}

export interface EventRow { id: number; kind: string; refType: string; refId: string; severity: EventSeverity; createdAt: string | null; acknowledgedAt: string | null; deliveries: Record<string, number>; }
export function parseEvents(raw: unknown): EventRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((e: any) => e && typeof e.id === "number" && typeof e.kind === "string" && typeof e.ref_type === "string" && typeof e.ref_id === "string" ? [{
    id: e.id, kind: e.kind, refType: e.ref_type, refId: e.ref_id, severity: (["info", "action", "critical"].includes(e.severity) ? e.severity : "info") as EventSeverity,
    createdAt: typeof e.created_at === "string" ? e.created_at : null, acknowledgedAt: typeof e.acknowledged_at === "string" ? e.acknowledged_at : null,
    deliveries: e.deliveries && typeof e.deliveries === "object" ? Object.fromEntries(Object.entries(e.deliveries).filter(([, v]) => typeof v === "number")) as Record<string, number> : {},
  }] : []);
}

export interface DestinationRow { id: string; label: string | null; addressMasked: string; verified: boolean; active: boolean; }
export function parseDestinations(raw: unknown): DestinationRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((d: any) => d && typeof d.id === "string" ? [{ id: d.id, label: typeof d.label === "string" ? d.label : null, addressMasked: typeof d.address_masked === "string" ? d.address_masked : "", verified: d.verified === true, active: d.active === true }] : []);
}

export interface DeliveryHealth { byStatus: Record<string, number>; oldestQueuedMinutes: number | null; failed: number; activeDestinations: number; unverifiedDestinations: number; }
export function parseHealth(raw: unknown): DeliveryHealth | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { byStatus: r.by_status && typeof r.by_status === "object" ? Object.fromEntries(Object.entries(r.by_status).filter(([, v]) => typeof v === "number")) as Record<string, number> : {},
    oldestQueuedMinutes: typeof r.oldest_queued_minutes === "number" ? r.oldest_queued_minutes : null, failed: num(r.failed), activeDestinations: num(r.active_destinations), unverifiedDestinations: num(r.unverified_destinations) };
}

// ---------------- dispatcher ----------------
export interface ClaimedDelivery { id: number; event_id: number; channel: "staff_email" | "applicant_email"; destination_id: string | null; attempts: number; kind: string; ref_type: string; ref_id: string; severity: string; }
export interface Recipient { email: string; display_name?: string; kind: string }
export type SendResult = { ok: true; providerId?: string | null } | { ok: false; code: string };
/** Implemented by the email stream (A4) behind its own on/off flags. This file never talks to a provider. */
export interface Mailer { send(to: string, message: { subject: string; text: string }, opts: { idempotencyKey: string }): Promise<SendResult>; }
export interface DispatchDeps {
  enabled: boolean;                       // HC_NOTIFY_DISPATCH_ENABLED === "true"
  siteUrl: string;
  mailer: Mailer | null;                  // null => nothing can be sent
  claim(limit: number): Promise<ClaimedDelivery[]>;
  recipient(deliveryId: number): Promise<Recipient | null>;
  record(deliveryId: number, outcome: "sent" | "delivered" | "failed" | "skipped", errorCode?: string, providerId?: string | null): Promise<void>;
}
export interface DispatchSummary { ran: boolean; reason?: string; claimed: number; sent: number; failed: number; skipped: number }

const CODE = /^[a-z0-9_]{1,60}$/;
export function composeMessage(d: ClaimedDelivery, r: Recipient, siteUrl: string): { subject: string; text: string } | null {
  if (d.channel === "applicant_email") {
    if (d.kind === "application_approved") return applicationApprovedMessage(r.display_name ?? "", `${siteUrl}/creator`);
    if (d.kind === "application_declined") return applicationDeclinedMessage(r.display_name ?? "", null);   // internal review notes are never sent
    return null;
  }
  const meta = EVENT_LABELS[d.kind];
  if (!meta) return null;
  // Minimal sensitive data: no names, emails, amounts or free text. A link to the inbox only.
  return { subject: meta.staffEmailSubject, text: [meta.label + ".", "", "Open the Hosting Collective inbox in the Command Center to see it:", `${siteUrl}/command-center/hosting-collective`].join("\n") };
}

export async function dispatchDeliveries(deps: DispatchDeps, limit = 20): Promise<DispatchSummary> {
  const out: DispatchSummary = { ran: false, claimed: 0, sent: 0, failed: 0, skipped: 0 };
  if (!deps.enabled) return { ...out, reason: "dispatch_disabled" };
  if (!deps.mailer) return { ...out, reason: "mailer_not_configured" };
  out.ran = true;
  const batch = await deps.claim(Math.min(Math.max(limit, 1), 50));
  out.claimed = batch.length;
  for (const d of batch) {
    try {
      const rcpt = await deps.recipient(d.id);
      if (!rcpt) { await deps.record(d.id, "skipped", "no_recipient"); out.skipped++; continue; }
      const msg = composeMessage(d, rcpt, deps.siteUrl);
      if (!msg) { await deps.record(d.id, "skipped", "no_template"); out.skipped++; continue; }
      const res = await deps.mailer.send(rcpt.email, msg, { idempotencyKey: `hc-delivery-${d.id}` });
      if (res.ok) { await deps.record(d.id, "sent", undefined, res.providerId ?? null); out.sent++; }
      else { await deps.record(d.id, "failed", CODE.test(res.code) ? res.code : "send_failed"); out.failed++; }
    } catch {
      try { await deps.record(d.id, "failed", "dispatch_error"); } catch { /* the lease expires and the delivery is retried */ }
      out.failed++;
    }
  }
  return out;
}

/**
 * Adapter from a Supabase-like client to DispatchDeps. The client MUST be a service-role client held by a trusted runner (an edge function or
 * a scheduled job that A4/A1 own). The Next.js app does not hold a service-role key and does not run this.
 */
export interface RpcClient { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>; }
export function rpcDeps(client: RpcClient, cfg: { enabled: boolean; siteUrl: string; mailer: Mailer | null; channel?: "staff_email" | "applicant_email" | null }): DispatchDeps {
  return {
    enabled: cfg.enabled, siteUrl: cfg.siteUrl, mailer: cfg.mailer,
    async claim(limit) {
      const { data, error } = await client.rpc("hc_claim_deliveries", { p_limit: limit, p_channel: cfg.channel ?? null });
      if (error || !Array.isArray(data)) return [];
      return data.filter((d: any) => d && typeof d.id === "number" && (d.channel === "staff_email" || d.channel === "applicant_email")) as ClaimedDelivery[];
    },
    async recipient(id) {
      const { data, error } = await client.rpc("hc_delivery_recipient", { p_delivery_id: id });
      if (error || !data || typeof data !== "object" || typeof (data as any).email !== "string") return null;
      return data as Recipient;
    },
    async record(id, outcome, errorCode, providerId) {
      const { error } = await client.rpc("hc_record_delivery_result", { p_id: id, p_outcome: outcome, p_error: errorCode ?? null, p_provider_id: providerId ?? null });
      if (error) throw new Error("record_failed");
    },
  };
}
