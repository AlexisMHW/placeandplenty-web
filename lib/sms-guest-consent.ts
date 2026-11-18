// Guest SMS opt-in (web). OFF by default: nothing renders and the API route answers 404 unless NEXT_PUBLIC_SMS_GUEST_OPT_IN is exactly "true".
// Pure module (no Next imports) so node:test can import it.
//
// The consent wording below is a COPY of CONSENT_WORDING in the app repo (supabase/proposed/sms-edge/src/consent.ts, versions v2 and v2-es).
// The edge function stores ITS OWN text for the version we send, so the stored evidence is what the guest saw only while these two stay identical.
// tests/sms-guest-opt-in.test.ts compares them when the app repo sits next to this one. COUNSEL MUST APPROVE THE WORDING BEFORE ANY LIVE USE.

export type SmsLocale = "en" | "es";
export type SmsWordingVersion = "v2" | "v2-es";

export const SMS_WORDING_VERSION: Record<SmsLocale, SmsWordingVersion> = { en: "v2", es: "v2-es" };

export const SMS_TERMS_URL_TEXT = "placeandplenty.com/terms";
export const SMS_PRIVACY_URL_TEXT = "placeandplenty.com/privacy";

export const SMS_CONSENT_WORDING: Record<SmsWordingVersion, string> = {
  v2: "Text me reminders and updates about this gathering from Place & Plenty at this number. Message frequency varies, usually a few per gathering. Message and data rates may apply. Consent is not required to RSVP or to buy anything. Reply STOP to opt out at any time or HELP for help. Terms: placeandplenty.com/terms. Privacy: placeandplenty.com/privacy.",
  "v2-es": "Envíenme recordatorios y novedades sobre esta reunión de Place & Plenty a este número. La frecuencia de los mensajes varía, normalmente unos pocos por reunión. Pueden aplicarse tarifas de mensajes y datos. No es necesario dar este consentimiento para confirmar asistencia ni para comprar nada. Responda STOP para cancelar en cualquier momento o HELP para obtener ayuda. Términos: placeandplenty.com/terms. Privacidad: placeandplenty.com/privacy.",
};

export interface SmsOptInCopy {
  heading: string;
  intro: string;
  phoneLabel: string;
  phoneHint: string;
  submit: string;
  sending: string;
  needCheckbox: string;
  needPhone: string;
  success: string;
  successStillOptedOut: string;
  rateLimited: string;
  unavailable: string;
  failed: string;
  helpLine: string;
  termsLink: string;
  privacyLink: string;
}

export const SMS_COPY: Record<SmsLocale, SmsOptInCopy> = {
  en: {
    heading: "Text reminders (optional)",
    intro: "Want reminders by text? This is optional and separate from your RSVP.",
    phoneLabel: "Mobile number",
    phoneHint: "US mobile numbers only.",
    submit: "Sign me up for texts",
    sending: "Saving…",
    needCheckbox: "Please tick the box to agree to texts.",
    needPhone: "Please enter a US mobile number.",
    success: "You're set. You'll get texts about this gathering. Reply STOP to any text to opt out.",
    successStillOptedOut: "We saved your choice, but this number previously replied STOP, so no texts will be sent. Reply START to that number to turn texts back on.",
    rateLimited: "Too many attempts. Please wait a few minutes and try again.",
    unavailable: "Text reminders aren't available right now. Your RSVP is not affected.",
    failed: "Something went wrong. Please try again.",
    helpLine: "Already get our texts? Reply STOP to any text to opt out, or HELP for help.",
    termsLink: "Terms",
    privacyLink: "Privacy Policy",
  },
  es: {
    heading: "Recordatorios por mensaje de texto (opcional)",
    intro: "¿Quieres recordatorios por mensaje de texto? Es opcional y independiente de tu confirmación de asistencia.",
    phoneLabel: "Número de celular",
    phoneHint: "Solo números de celular de EE. UU.",
    submit: "Quiero recibir mensajes de texto",
    sending: "Guardando…",
    needCheckbox: "Marca la casilla para aceptar los mensajes de texto.",
    needPhone: "Ingresa un número de celular de EE. UU.",
    success: "Listo. Recibirás mensajes de texto sobre esta reunión. Responde STOP a cualquier mensaje para cancelar.",
    successStillOptedOut: "Guardamos tu elección, pero este número respondió STOP antes, así que no se enviará ningún mensaje. Responde START a ese número para reactivar los mensajes.",
    rateLimited: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    unavailable: "Los recordatorios por texto no están disponibles ahora. Tu confirmación de asistencia no se ve afectada.",
    failed: "Algo salió mal. Inténtalo de nuevo.",
    helpLine: "¿Ya recibes nuestros mensajes? Responde STOP a cualquier mensaje para cancelar, o HELP para ayuda.",
    termsLink: "Términos",
    privacyLink: "Política de privacidad",
  },
};

/** The feature flag. Anything other than the exact string "true" is OFF (unset, "1", "TRUE", " true " all read as off). */
export function isSmsGuestOptInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_SMS_GUEST_OPT_IN === "true";
}

export function pickSmsLocale(language: string | null | undefined): SmsLocale {
  return /^es\b/i.test((language ?? "").trim()) ? "es" : "en";
}

const TOKEN = /^[0-9a-fA-F-]{16,64}$/;

export interface ConsentInput { publicToken: string; phone: string; accepted: boolean; locale: SmsLocale }

/** Server-side shape check before anything is forwarded. The edge function validates again (and normalises the number). */
export function validateConsentInput(body: unknown): { ok: true; value: ConsentInput } | { ok: false; error: "bad_request" | "invalid_phone" | "consent_required" } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.publicToken !== "string" || !TOKEN.test(b.publicToken)) return { ok: false, error: "bad_request" };
  if (b.accepted !== true) return { ok: false, error: "consent_required" };
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  if (phone.length > 32 || !(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) return { ok: false, error: "invalid_phone" };
  const locale: SmsLocale = b.locale === "es" ? "es" : "en";
  return { ok: true, value: { publicToken: b.publicToken, phone, accepted: true, locale } };
}

export interface ConsentConfig { supabaseUrl?: string; anonKey?: string; flagEnv?: Record<string, string | undefined> }

/**
 * Forwards a validated opt-in to the sms-consent edge function. Server-only: runs inside the Next route, so no key, URL path or edge response
 * detail reaches the browser. The edge function is public (verify_jwt false); the anon (publishable) key is only the gateway header.
 * The browser never sends the wording: we send the VERSION and the edge function records its own text for that version.
 */
export async function forwardSmsConsent(body: unknown, cfg: ConsentConfig, transport: typeof fetch = fetch): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isSmsGuestOptInEnabled(cfg.flagEnv ?? process.env)) return { status: 404, body: { error: "not_found" } };
  const v = validateConsentInput(body);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  if (!cfg.supabaseUrl || !cfg.anonKey) return { status: 503, body: { error: "unavailable" } };
  let res: Response;
  try {
    res = await transport(`${cfg.supabaseUrl}/functions/v1/sms-consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
      body: JSON.stringify({ public_token: v.value.publicToken, phone: v.value.phone, accepted: true, wording_version: SMS_WORDING_VERSION[v.value.locale] }),
      cache: "no-store",
    });
  } catch {
    return { status: 503, body: { error: "unavailable" } };
  }
  let data: { ok?: boolean; still_opted_out?: boolean } | null = null;
  try { data = await res.json(); } catch { data = null; }
  if (res.ok && data?.ok === true) return { status: 200, body: { ok: true, stillOptedOut: data.still_opted_out === true } };
  if (res.status === 429) return { status: 429, body: { error: "rate_limited" } };
  if (res.status === 400) return { status: 400, body: { error: "invalid_phone" } };
  if (res.status === 404) return { status: 404, body: { error: "not_found" } };
  return { status: 503, body: { error: "unavailable" } };
}
