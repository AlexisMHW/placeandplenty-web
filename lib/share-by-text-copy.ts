// Host-facing strings for Share by Text (web). Honest by construction:
// nothing here may say a message was sent, delivered or read. The host's
// own messaging app sends it; Place & Plenty only prepares the text.

export type ShareCopyLocale = "en" | "es";

export interface ShareByTextCopy {
  textButton: string;
  copyButton: string;
  shareButton: string;
  opened: string;
  openedNoPhone: string;
  copied: string;
  copyFailed: string;
  noPhoneHint: string;
  noLink: string;
  desktopHint: string;
  a11yText: (name: string) => string;
}

export const SHARE_BY_TEXT_COPY: Record<ShareCopyLocale, ShareByTextCopy> = {
  en: {
    textButton: "Text this invitation",
    copyButton: "Copy invitation text",
    shareButton: "Share…",
    opened:
      "Your messaging app opened with the invitation ready. Nothing is sent until you press Send there, and Place & Plenty cannot see whether it was delivered or read.",
    openedNoPhone:
      "Your messaging app opened with the invitation ready. Choose who to send it to and press Send there. Place & Plenty cannot see whether it was delivered or read.",
    copied: "Invitation text copied. Paste it into any message.",
    copyFailed: "Could not copy automatically. Select and copy the text manually.",
    noPhoneHint: "No phone number on file. You will choose the contact in your messaging app.",
    noLink: "This invitation does not have a link yet. Try again in a moment.",
    desktopHint: "On a computer, copy the text and paste it into your messaging app.",
    a11yText: (name) => `Text the invitation to ${name}`,
  },
  es: {
    textButton: "Enviar esta invitación por mensaje",
    copyButton: "Copiar texto de la invitación",
    shareButton: "Compartir…",
    opened:
      "Se abrió tu app de mensajes con la invitación lista. No se envía nada hasta que pulses Enviar allí, y Place & Plenty no puede saber si se entregó o se leyó.",
    openedNoPhone:
      "Se abrió tu app de mensajes con la invitación lista. Elige a quién enviarla y pulsa Enviar allí. Place & Plenty no puede saber si se entregó o se leyó.",
    copied: "Texto de la invitación copiado. Pégalo en cualquier mensaje.",
    copyFailed: "No se pudo copiar automáticamente. Selecciona y copia el texto manualmente.",
    noPhoneHint: "No hay número de teléfono guardado. Elegirás el contacto en tu app de mensajes.",
    noLink: "Esta invitación todavía no tiene enlace. Inténtalo de nuevo en un momento.",
    desktopHint: "En una computadora, copia el texto y pégalo en tu app de mensajes.",
    a11yText: (name) => `Enviar la invitación por mensaje a ${name}`,
  },
};
