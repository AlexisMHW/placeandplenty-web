// Transactional email dispatch pipeline (web, pure + injectable). Order of checks is deliberate:
//   1. sending switch (COMMS_SEND_ENABLED exactly "true")  -> otherwise status stays "queued", provider NEVER called
//   2. recipient validity
//   3. suppression (unsubscribe / bounce / complaint)        -> "suppressed", provider NEVER called
//   4. provider.send with a stable idempotency key           -> "sent" (accepted, NOT delivered) or "failed"
// Provider delivery events later move the record via applyProviderEvent (status.ts). Nothing here can reach the network:
// the provider is injected, and the only providers in this repo are the disabled one and the test fake.
import type { EmailProvider } from "./provider.ts";
import type { SuppressionStore } from "./suppression.ts";
import { hashEmail, normalizeEmail } from "./suppression.ts";
import type { CommsStatus } from "./status.ts";

export interface OutboundEmail { to: string; subject: string; body: string; idempotencyKey: string }
export interface DispatchDeps {
  provider: EmailProvider;
  suppression: SuppressionStore;
  hashKey: string | undefined;
  sendEnabled: boolean;
}
export interface DispatchResult {
  status: CommsStatus;
  reason?: "sending_disabled" | "invalid_recipient" | "recipient_suppressed" | "provider_failed" | "provider_error";
  providerMessageId?: string | null;
}

export function sendingEnabled(env: Record<string, string | undefined>): boolean {
  return env.COMMS_SEND_ENABLED === "true"; // exact match only; anything else (unset, "1", "TRUE") is OFF
}

export async function dispatchEmail(deps: DispatchDeps, msg: OutboundEmail): Promise<DispatchResult> {
  if (!deps.sendEnabled) return { status: "queued", reason: "sending_disabled" };
  const to = normalizeEmail(msg.to);
  if (!to) return { status: "failed", reason: "invalid_recipient" };
  const hash = await hashEmail(to, deps.hashKey);
  if (hash && (await deps.suppression.has(hash))) return { status: "suppressed", reason: "recipient_suppressed" };
  try {
    const r = await deps.provider.send({ to, subject: msg.subject, body: msg.body, idempotencyKey: msg.idempotencyKey });
    if (r.status === "sent") return { status: "sent", providerMessageId: r.providerMessageId };
    return { status: "failed", reason: "provider_failed", providerMessageId: r.providerMessageId };
  } catch {
    return { status: "failed", reason: "provider_error" };
  }
}

/** Unsubscribe / bounce / complaint: suppress by keyed address hash only (the address itself is never stored). */
export async function suppressAddress(
  deps: Pick<DispatchDeps, "suppression" | "hashKey">, email: string, reason: "unsubscribe" | "bounce" | "complaint"
): Promise<boolean> {
  const hash = await hashEmail(email, deps.hashKey);
  if (!hash) return false; // fail closed on write: a missing key never silently drops the request
  await deps.suppression.add(hash, reason);
  return true;
}
