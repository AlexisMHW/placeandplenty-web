// Communications status vocabulary (web). Pure module, no imports besides types, safe for node --test.
//
// TWO VOCABULARIES, ON PURPOSE
//   * CommsStatus: what staff/operators see. Granular and truthful about what we actually know.
//   * Host label (DeliveryLabelKey in ../invitation-delivery.ts): what a host sees about their guest. Bounces,
//     complaints and suppression all collapse to "undeliverable" so a guest's spam complaint or unsubscribe is never disclosed.
//
// HONESTY RULES
//   * "sent" = the provider accepted our API call. It is NOT delivery.
//   * "delivered" requires a provider delivery event. Never inferred.
//   * Nothing here says "opened" or "read": open tracking is off.
import type { DeliveryLabelKey } from "../invitation-delivery.ts";

export type CommsStatus = "queued" | "sent" | "delivered" | "delayed" | "failed" | "bounced" | "suppressed";
export type ProviderEventType = "accepted" | "delivered" | "delayed" | "bounced" | "complained" | "failed";

export const COMMS_STATUSES: readonly CommsStatus[] = ["queued", "sent", "delivered", "delayed", "failed", "bounced", "suppressed"];

// Higher rank = stronger evidence. A status never moves to a lower rank except via the explicit terminal rules below.
const RANK: Record<CommsStatus, number> = { queued: 0, failed: 1, sent: 2, delayed: 3, delivered: 4, suppressed: 5, bounced: 5 };

/** Next status after a provider event. Out-of-order or duplicate events never downgrade (a late "accepted" cannot undo "delivered"). */
export function applyProviderEvent(current: CommsStatus, event: ProviderEventType): CommsStatus {
  const target: CommsStatus =
    event === "accepted" ? "sent"
    : event === "delivered" ? "delivered"
    : event === "delayed" ? "delayed"
    : event === "bounced" ? "bounced"
    : event === "complained" ? "suppressed" // a complaint suppresses future sends; never shown to the host
    : "failed";
  if (current === "bounced" || current === "suppressed") return current; // terminal
  if (event === "bounced" || event === "complained") return target;         // terminal evidence wins over anything earlier
  return RANK[target] > RANK[current] ? target : current;
}

/** Host-facing label key. Unknown input degrades to "queued" (never a stronger claim). */
export function hostLabelFor(status: CommsStatus | string | null | undefined): DeliveryLabelKey {
  switch (status) {
    case "queued": return "queued";
    case "sent": return "accepted";
    case "delivered": return "delivered";
    case "delayed": return "delayed";
    case "failed": return "failed";
    case "bounced":
    case "suppressed": return "undeliverable";
    default: return "queued";
  }
}

/** Operator-facing plain-language label (no disclosure rules apply to staff). */
export const OPERATOR_LABEL: Record<CommsStatus, string> = {
  queued: "Queued (not yet handed to the mail provider)",
  sent: "Sent to provider (delivery not confirmed)",
  delivered: "Delivered to recipient's email provider",
  delayed: "Delayed at recipient's provider",
  failed: "Failed to send",
  bounced: "Bounced (address cannot receive mail)",
  suppressed: "Suppressed (recipient opted out or complained; not sent)",
};
