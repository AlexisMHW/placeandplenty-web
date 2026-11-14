// FOUNDER NOTIFICATIONS (D5). Two channels:
//   A. Command Center inbox: ALWAYS recorded (persistent, permission-controlled by A3's RBAC; this module only produces the records).
//   B. Designated business email: sent ONLY when ALL hold: enabled, destination configured (env, never hardcoded), destination
//      marked verified, and COMMS sending is on. Otherwise the inbox record still exists and email status says why it was skipped.
// Truthfulness: email status uses the shared CommsStatus vocabulary. "sent" = provider accepted; "delivered" only via a provider event.
// Minimal data: the email body is rendered by the "founder_notification" template (category, severity, count, link). Nothing else.
import { renderTemplate } from "./templates.ts";
import { applyProviderEvent, type CommsStatus, type ProviderEventType } from "./status.ts";
import { dispatchEmail, type DispatchDeps } from "./dispatch.ts";

export const FOUNDER_CATEGORIES = {
  hc_application_new:            { label: "New Hosting Collective application", severity: "attention" },
  hc_application_awaiting_review:{ label: "Hosting Collective applications awaiting review", severity: "attention" },
  hc_application_decided:        { label: "Hosting Collective application decided", severity: "info" },
  hc_member_onboarded:           { label: "New Hosting Collective member onboarded", severity: "info" },
  creator_content_submitted:     { label: "Creator content submitted for review", severity: "attention" },
  payout_needs_approval:         { label: "Payout needs approval", severity: "urgent" },
  comms_failed_or_delayed:       { label: "Communications failed or delayed", severity: "attention" },
  system_failure:                { label: "Significant system failure", severity: "urgent" },
} as const;
export type FounderCategory = keyof typeof FOUNDER_CATEGORIES;
export type Severity = "info" | "attention" | "urgent";

export interface FounderNotifyConfig {
  enabled: boolean;
  destination: string | null;
  destinationVerified: boolean;
  maxAttempts: number;
  backoffSeconds: number[];   // delay before attempt n+1 (index n-1); last value repeats
  baseUrl: string | null;
}
/** Config comes from the environment only. There is no hardcoded address anywhere in this module. */
export function loadFounderNotifyConfig(env: Record<string, string | undefined>): FounderNotifyConfig {
  const csv = (env.FOUNDER_NOTIFY_RETRY_SECONDS ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  const attempts = Number(env.FOUNDER_NOTIFY_MAX_ATTEMPTS);
  return {
    enabled: env.FOUNDER_NOTIFY_ENABLED === "true",
    destination: env.FOUNDER_NOTIFY_EMAIL?.trim() || null,
    destinationVerified: env.FOUNDER_NOTIFY_EMAIL_VERIFIED === "true",
    maxAttempts: Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 10) : 4,
    backoffSeconds: csv.length ? csv : [60, 300, 1800],
    baseUrl: env.NEXT_PUBLIC_SITE_URL?.trim() || env.SITE_URL?.trim() || null,
  };
}

export type EmailChannelState = "not_attempted" | "skipped" | CommsStatus;
export interface AuditEntry { at: string; action: string; detail?: string }   // detail is never PII
export interface FounderNotification {
  id: string;
  category: FounderCategory;
  severity: Severity;
  dedupKey: string;
  createdAt: string;
  lastSeenAt: string;
  occurrences: number;
  resolved: boolean;
  email: {
    state: EmailChannelState;
    skipReason?: "disabled" | "no_destination" | "destination_unverified" | "sending_disabled" | "template_error";
    attempts: number;
    nextAttemptAt: string | null;
    lastFailure: string | null;
    providerMessageId: string | null;
  };
  audit: AuditEntry[];
}
export interface FounderNotificationStore {
  findOpenByDedupKey(key: string): Promise<FounderNotification | null>;
  insert(n: FounderNotification): Promise<void>;
  update(n: FounderNotification): Promise<void>;
}
export function createMemoryFounderStore(): FounderNotificationStore & { all: FounderNotification[] } {
  const all: FounderNotification[] = [];
  return {
    all,
    async findOpenByDedupKey(k) { return all.find((n) => n.dedupKey === k && !n.resolved) ?? null; },
    async insert(n) { all.push(n); },
    async update(n) { const i = all.findIndex((x) => x.id === n.id); if (i >= 0) all[i] = n; },
  };
}

/** Dedup key = category + entity (+ optional bucket). Same open key => one inbox item with a rising occurrence count, no extra email. */
export function founderDedupKey(category: FounderCategory, entityId: string, bucket?: string): string {
  return [category, String(entityId).slice(0, 80), bucket ?? ""].join("|");
}

export interface RaiseInput { category: FounderCategory; entityId: string; bucket?: string; severity?: Severity }
export interface RaiseDeps { store: FounderNotificationStore; config: FounderNotifyConfig; newId: () => string; nowIso: () => string }

/** Channel A (always) + decides whether channel B is attempted. Returns the record and whether it was a duplicate. */
export async function raiseFounderNotification(deps: RaiseDeps, input: RaiseInput): Promise<{ notification: FounderNotification; deduped: boolean; emailEligible: boolean }> {
  const key = founderDedupKey(input.category, input.entityId, input.bucket);
  const now = deps.nowIso();
  const existing = await deps.store.findOpenByDedupKey(key);
  if (existing) {
    existing.occurrences += 1; existing.lastSeenAt = now;
    existing.audit.push({ at: now, action: "deduplicated", detail: `occurrences=${existing.occurrences}` });
    await deps.store.update(existing);
    return { notification: existing, deduped: true, emailEligible: false };
  }
  const meta = FOUNDER_CATEGORIES[input.category];
  const n: FounderNotification = {
    id: deps.newId(), category: input.category, severity: input.severity ?? meta.severity, dedupKey: key,
    createdAt: now, lastSeenAt: now, occurrences: 1, resolved: false,
    email: { state: "not_attempted", attempts: 0, nextAttemptAt: null, lastFailure: null, providerMessageId: null },
    audit: [{ at: now, action: "inbox_recorded", detail: input.category }],
  };
  const skip = emailSkipReason(deps.config);
  if (skip) { n.email.state = "skipped"; n.email.skipReason = skip; n.audit.push({ at: now, action: "email_skipped", detail: skip }); }
  await deps.store.insert(n);
  return { notification: n, deduped: false, emailEligible: skip === null };
}

function emailSkipReason(c: FounderNotifyConfig): FounderNotification["email"]["skipReason"] | null {
  if (!c.enabled) return "disabled";
  if (!c.destination) return "no_destination";
  if (!c.destinationVerified) return "destination_unverified";
  return null;
}

/** One delivery attempt (called on raise and by a retry sweep). Honors backoff via nextAttemptAt. */
export async function attemptFounderEmail(
  deps: RaiseDeps & { dispatch: DispatchDeps }, n: FounderNotification
): Promise<FounderNotification> {
  const now = deps.nowIso();
  const skip = emailSkipReason(deps.config);
  if (skip) return n;                                                   // config can change between attempts; never send without verified destination
  if (n.email.state === "delivered" || n.email.state === "sent" || n.email.state === "bounced" || n.email.state === "suppressed") return n;
  if (n.email.attempts >= deps.config.maxAttempts) return n;
  if (n.email.nextAttemptAt && Date.parse(n.email.nextAttemptAt) > Date.parse(now)) return n; // backoff not elapsed
  const tpl = renderTemplate("founder_notification",
    { categoryLabel: FOUNDER_CATEGORIES[n.category].label, severity: n.severity, inboxId: n.id, count: n.occurrences },
    { baseUrl: deps.config.baseUrl ?? undefined });
  if (!tpl.ok) {
    n.email.state = "skipped"; n.email.skipReason = "template_error";
    n.audit.push({ at: now, action: "email_skipped", detail: `template_${tpl.error}` });
    await deps.store.update(n); return n;
  }
  n.email.attempts += 1;
  const res = await dispatchEmail(deps.dispatch, {
    to: deps.config.destination as string, subject: tpl.subject, body: tpl.text,
    idempotencyKey: `founder/${n.id}/${n.email.attempts}`,
  });
  if (res.reason === "sending_disabled") {
    n.email.attempts -= 1; n.email.state = "skipped"; n.email.skipReason = "sending_disabled";
    n.audit.push({ at: now, action: "email_skipped", detail: "sending_disabled" });
  } else if (res.status === "sent") {
    n.email.state = "sent"; n.email.providerMessageId = res.providerMessageId ?? null; n.email.nextAttemptAt = null; n.email.lastFailure = null;
    n.audit.push({ at: now, action: "email_sent_to_provider", detail: `attempt=${n.email.attempts}` });
  } else if (res.status === "suppressed") {
    n.email.state = "suppressed"; n.email.nextAttemptAt = null;
    n.audit.push({ at: now, action: "email_suppressed" });
  } else {
    n.email.lastFailure = res.reason ?? "unknown";
    if (n.email.attempts >= deps.config.maxAttempts) { n.email.state = "failed"; n.email.nextAttemptAt = null; n.audit.push({ at: now, action: "email_failed_final", detail: n.email.lastFailure }); }
    else {
      const delay = deps.config.backoffSeconds[Math.min(n.email.attempts - 1, deps.config.backoffSeconds.length - 1)];
      n.email.state = "queued"; n.email.nextAttemptAt = new Date(Date.parse(now) + delay * 1000).toISOString();
      n.audit.push({ at: now, action: "email_retry_scheduled", detail: `attempt=${n.email.attempts};in=${delay}s` });
    }
  }
  await deps.store.update(n);
  return n;
}

/** Provider webhook event -> status. Out-of-order events never downgrade; "delivered" appears only from a delivery event. */
export async function recordFounderEmailEvent(store: FounderNotificationStore, n: FounderNotification, event: ProviderEventType, nowIso: string): Promise<FounderNotification> {
  const current: CommsStatus = n.email.state === "not_attempted" || n.email.state === "skipped" ? "queued" : n.email.state;
  const next = applyProviderEvent(current, event);
  n.email.state = next;
  n.audit.push({ at: nowIso, action: `provider_event_${event}`, detail: `status=${next}` });
  await store.update(n);
  return n;
}
