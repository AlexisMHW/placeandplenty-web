// HC NOTIFICATION DISPATCH WIRING (web). The enqueue half is atomic in the database: hc_review_application emits the approved/declined event
// and queues exactly one applicant_email delivery in the same transaction (DB suite t215003 C15/C16). This module is the DISPATCH half: it
// drains queued applicant_email deliveries through dispatchDeliveries() (lib/hc/events.ts) and the injected mailer.
//
// SAFETY (all default OFF):
//   * HC_NOTIFY_DISPATCH_ENABLED must be exactly "true", otherwise nothing is claimed, no service client is built, nothing is sent.
//   * COMMS_SEND_ENABLED must be exactly "true", otherwise there is no mailer and deliveries stay queued (never burned as failed).
//   * Only the applicant_email channel is drained here. Founder/staff notifications have ONE canonical path: cc_notifications +
//     cc_notification_settings (Command Center). The legacy staff_email channel is never dispatched from this module.
//   * SMS is not part of this module and stays disabled.
//   * The service-role key is read from the environment only when the flag is on, and is never logged or returned.
import { dispatchDeliveries, rpcDeps, type DispatchSummary, type Mailer, type RpcClient } from "./events.ts";
import { sendingEnabled } from "../comms/dispatch.ts";
import type { EmailProvider } from "../comms/provider.ts";

type Env = Record<string, string | undefined>;
export const hcDispatchEnabled = (env: Env): boolean => env.HC_NOTIFY_DISPATCH_ENABLED === "true"; // exact match; anything else is OFF

/** Adapts the shared provider seam to the HC Mailer. Null (nothing can be sent) unless COMMS_SEND_ENABLED is exactly "true". */
export function mailerFromProvider(provider: EmailProvider, env: Env): Mailer | null {
  if (!sendingEnabled(env)) return null;
  return {
    async send(to, message, opts) {
      const r = await provider.send({ to, subject: message.subject, body: message.text, idempotencyKey: opts.idempotencyKey });
      return r.status === "sent" ? { ok: true, providerId: r.providerMessageId } : { ok: false, code: (r.failureReason ?? "send_failed").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60) || "send_failed" };
    },
  };
}

export interface RunnerDeps {
  env: Env;
  provider: EmailProvider;
  /** Builds the service-role client. Called ONLY when the dispatch flag is on. */
  serviceClient: () => RpcClient | null;
}

export async function runHcDispatch(deps: RunnerDeps, limit = 20): Promise<DispatchSummary> {
  const none: DispatchSummary = { ran: false, claimed: 0, sent: 0, failed: 0, skipped: 0 };
  if (!hcDispatchEnabled(deps.env)) return { ...none, reason: "dispatch_disabled" };
  const mailer = mailerFromProvider(deps.provider, deps.env);
  if (!mailer) return { ...none, reason: "mailer_not_configured" };
  const siteUrl = (deps.env.SITE_URL ?? deps.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!siteUrl) return { ...none, reason: "site_url_missing" };
  let client: RpcClient | null = null;
  try { client = deps.serviceClient(); } catch { client = null; }
  if (!client) return { ...none, reason: "service_client_unavailable" };
  return dispatchDeliveries(rpcDeps(client, { enabled: true, siteUrl, mailer, channel: "applicant_email" }), limit);
}

/**
 * Called after a staff decision on an application has been SAVED. Never throws and never changes the decision result.
 * It does not enqueue anything itself (the database RPC already did, once); it only gives the dispatcher a chance to run.
 */
export async function afterApplicationDecision(decision: string, run: () => Promise<DispatchSummary>): Promise<DispatchSummary | null> {
  if (decision !== "approved" && decision !== "declined") return null;
  try { return await run(); } catch { return null; }
}
