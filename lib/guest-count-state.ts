// ONE definition of "is the guest count unknown?" for the web app. Pure, no
// server imports, so the client wizard, server actions and pages share it.
//
// It mirrors the native app's features/hostready/services/guestCountState.ts
// on purpose; if one changes, change both.
//
// A count is UNKNOWN when the host chose "I'm Not Sure Yet"
// (guest_count_unknown = true) or when expected_guest_count is explicitly
// NULL. Rows from a database that predates the column (field undefined)
// are known. Unknown is never rendered, stored or summed as zero.
//
// Lifecycle the host sees:
//   unknown   -> the host has not given a number ("I'm Not Sure Yet")
//   estimated -> the host entered adults/children (a planning number)
//   confirmed -> the host confirmed final attendance (confirm_gathering_attendance)
// unknown -> estimated happens when the host enters numbers; estimated ->
// confirmed only through the host's explicit attendance confirmation.

export interface GuestCountFields {
  guest_count_unknown?: boolean | null;
  expected_guest_count?: number | null;
}

export type GuestCountState = "unknown" | "estimated" | "confirmed";

export function isGuestCountUnknown(
  g: GuestCountFields | null | undefined
): boolean {
  if (!g) return false;
  if (g.guest_count_unknown === true) return true;
  return g.expected_guest_count === null;
}

export function resolveGuestCountState(
  g: GuestCountFields | null | undefined,
  opts: { attendanceConfirmed?: boolean } = {}
): GuestCountState {
  if (isGuestCountUnknown(g)) return "unknown";
  return opts.attendanceConfirmed === true ? "confirmed" : "estimated";
}

export type GuestCountLocale = "en" | "es";

export const GUEST_COUNT_COPY: Record<
  GuestCountLocale,
  {
    notSureYet: string;
    unknownDisplay: string;
    unknownHelp: string;
    derivedHelp: string;
    estimated: string;
    confirmed: string;
    unsupported: string;
    headcountRequired: string;
  }
> = {
  en: {
    notSureYet: "I'm Not Sure Yet",
    unknownDisplay: "Guest count not set yet",
    unknownHelp:
      "That's fine. Nothing is planned for a headcount until you add one, and you can add it any time.",
    derivedHelp: "Expected guests is worked out from these two.",
    estimated: "Estimated",
    confirmed: "Confirmed",
    unsupported:
      "Saving an unknown guest count isn't available yet. Please enter your best estimate for now.",
    headcountRequired: "Add at least one guest, or choose I'm Not Sure Yet.",
  },
  es: {
    notSureYet: "Aún no estoy seguro/a",
    unknownDisplay: "Cantidad de invitados aún sin definir",
    unknownHelp:
      "No hay problema. No se planifica nada según el número de invitados hasta que lo agregues, y puedes hacerlo cuando quieras.",
    derivedHelp: "El total de invitados se calcula con estos dos números.",
    estimated: "Estimado",
    confirmed: "Confirmado",
    unsupported:
      "Todavía no se puede guardar una cantidad de invitados sin definir. Por ahora, ingresa tu mejor estimación.",
    headcountRequired:
      "Agrega al menos un invitado o elige que aún no estás seguro/a.",
  },
};

/**
 * What to print where a headcount goes. Never "0" for an unknown count.
 */
export function formatGuestCount(
  g: GuestCountFields | null | undefined,
  locale: GuestCountLocale = "en"
): string {
  if (isGuestCountUnknown(g)) return GUEST_COUNT_COPY[locale].unknownDisplay;
  const n = g?.expected_guest_count;
  return typeof n === "number" ? String(n) : "—";
}
