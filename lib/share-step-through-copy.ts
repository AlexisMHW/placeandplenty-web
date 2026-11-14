// Host-facing strings for the bulk "text every household, one at a time" step-through (web).
// Honest by construction: nothing here may say a message was sent, delivered or read.
export type StepCopyLocale = "en" | "es";
export interface StepThroughCopy {
  entry: string; title: string; explainer: string; progress: (current: number, total: number) => string;
  openMessages: string; copyAndNext: string; skip: string; back: string; close: string;
  noLinkNote: (count: number) => string; doneTitle: string; doneBody: (opened: number, skipped: number) => string; doneHonest: string;
  desktopHint: string; noPhoneHint: string;
}
export const STEP_THROUGH_COPY: Record<StepCopyLocale, StepThroughCopy> = {
  en: {
    entry: "Text everyone, one at a time",
    title: "Text every household, one at a time",
    explainer: "Your messaging app opens once for each household with that household's own private link. Nothing is sent until you press Send there. Each household gets its own message, never a group text.",
    progress: (c, t) => `Household ${c} of ${t}`,
    openMessages: "Open messaging app", copyAndNext: "Copy text", skip: "Skip this household", back: "Back", close: "Close",
    noLinkNote: (n) => `${n} ${n === 1 ? "household has" : "households have"} no invitation link yet and ${n === 1 ? "was" : "were"} left out.`,
    doneTitle: "All households reviewed",
    doneBody: (o, s) => `You opened or copied the text for ${o} and skipped ${s}.`,
    doneHonest: "Place & Plenty cannot see whether those texts were sent, delivered or read.",
    desktopHint: "On a computer, copy the text and paste it into your messaging app.",
    noPhoneHint: "No phone number on file. You will choose the contact in your messaging app.",
  },
  es: {
    entry: "Enviar texto a todos, uno por uno",
    title: "Enviar texto a cada hogar, uno por uno",
    explainer: "Tu app de mensajes se abre una vez por cada hogar con el enlace privado de ese hogar. No se envía nada hasta que pulses Enviar allí. Cada hogar recibe su propio mensaje, nunca un chat de grupo.",
    progress: (c, t) => `Hogar ${c} de ${t}`,
    openMessages: "Abrir app de mensajes", copyAndNext: "Copiar texto", skip: "Omitir este hogar", back: "Atrás", close: "Cerrar",
    noLinkNote: (n) => `${n} ${n === 1 ? "hogar aún no tiene" : "hogares aún no tienen"} enlace de invitación y se ${n === 1 ? "dejó" : "dejaron"} fuera.`,
    doneTitle: "Todos los hogares revisados",
    doneBody: (o, s) => `Abriste o copiaste el texto de ${o} y omitiste ${s}.`,
    doneHonest: "Place & Plenty no puede ver si esos textos se enviaron, se entregaron o se leyeron.",
    desktopHint: "En una computadora, copia el texto y pégalo en tu app de mensajes.",
    noPhoneHint: "No hay número de teléfono guardado. Elegirás el contacto en tu app de mensajes.",
  },
};
