// Host-facing invitation delivery status (web). Pure module: no imports, safe for node --test.
//
// HONESTY RULES
//   * "delivered" is only ever shown when the server's summary says 'delivered' (a provider delivery event was
//     recorded). Without that evidence a provider-accepted message is "accepted", never "delivered".
//   * Nothing here ever says "opened" or "read": open tracking is off.
//   * Complaints, bounces and suppression all read as "undeliverable" server-side, so a guest's spam complaint is
//     never disclosed to the host.
//   * Old schemas: if the summary RPC does not exist, callers pass summaryState = null and we fall back to the
//     released `status` enum (pending/submitted/sent/failed) with the same honesty rules.

export type DeliveryLabelKey = "not_sent" | "queued" | "accepted" | "delivered" | "delayed" | "undeliverable" | "failed";
export type DeliveryLocale = "en" | "es";

export const DELIVERY_COPY: Record<DeliveryLocale, Record<DeliveryLabelKey, { label: string; hint: string }>> = {
  en: {
    not_sent:      { label: "Not sent",             hint: "This invitation has not been sent yet." },
    queued:        { label: "Waiting to send",      hint: "This invitation has not been handed to the mail provider yet." },
    accepted:      { label: "Sent to mail provider", hint: "Handed to our email provider. We have not received confirmation that it reached their inbox." },
    delivered:     { label: "Delivered to their email provider", hint: "Their email provider accepted it. We can't see whether it was opened." },
    delayed:       { label: "Delayed",              hint: "Their email provider is slow to accept it. We'll keep trying for a while." },
    undeliverable: { label: "Email address didn't work", hint: "This address can't receive our email. Ask them for another address, or share the invitation by text." },
    failed:        { label: "Couldn't send",        hint: "We couldn't send this invitation. Try again or share it by text." },
  },
  es: {
    not_sent:      { label: "No enviada",           hint: "Esta invitación aún no se ha enviado." },
    queued:        { label: "En espera de envío",   hint: "Esta invitación aún no se ha entregado al proveedor de correo." },
    accepted:      { label: "Enviada al proveedor de correo", hint: "Se entregó a nuestro proveedor de correo. Aún no recibimos confirmación de que llegara a su bandeja." },
    delivered:     { label: "Entregada a su proveedor de correo", hint: "Su proveedor de correo la aceptó. No podemos ver si la abrieron." },
    delayed:       { label: "Retrasada",            hint: "Su proveedor de correo tarda en aceptarla. Seguiremos intentando durante un tiempo." },
    undeliverable: { label: "El correo no funcionó", hint: "Esta dirección no puede recibir nuestro correo. Pídele otra dirección o comparte la invitación por mensaje de texto." },
    failed:        { label: "No se pudo enviar",    hint: "No pudimos enviar esta invitación. Inténtalo de nuevo o compártela por mensaje de texto." },
  },
};

const SERVER_STATES: ReadonlySet<string> = new Set(["queued", "accepted", "delivered", "delayed", "undeliverable", "failed"]);

/**
 * Resolve the label key.
 * @param firstShareInitiatedAt invitation_parties.first_share_initiated_at ("an invite was initiated")
 * @param legacyStatus  latest communication_deliveries.status (released enum), or null
 * @param summaryState  get_invitation_delivery_summary().delivery_state, or null when the RPC is absent/failed
 */
export function resolveDeliveryLabel(
  firstShareInitiatedAt: string | null | undefined,
  legacyStatus: string | null | undefined,
  summaryState: string | null | undefined
): DeliveryLabelKey {
  if (summaryState && SERVER_STATES.has(summaryState)) {
    return summaryState as DeliveryLabelKey;   // server is authoritative; unknown/future states fall through below
  }
  if (!firstShareInitiatedAt) return "not_sent";
  switch (legacyStatus) {
    case "sent":      return "accepted";   // provider accepted the API call; no delivery evidence
    case "failed":    return "failed";
    case "pending":
    case "submitted":
    case null:
    case undefined:   return "queued";
    default:          return "queued";     // never invent a stronger claim for an unrecognised value
  }
}

export function deliveryCopy(key: DeliveryLabelKey, locale: DeliveryLocale = "en") {
  return DELIVERY_COPY[locale][key];
}

/** Tone for the badge. Calm for expected states, attention for ones the host can act on. */
export function deliveryTone(key: DeliveryLabelKey): "neutral" | "good" | "attention" {
  if (key === "delivered") return "good";
  if (key === "undeliverable" || key === "failed") return "attention";
  return "neutral";
}
