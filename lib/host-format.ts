// Shared formatting for the host web app.
//
// TIMEZONE NOTE, because this is the easy thing to get wrong.
// `gatherings.gathering_date` is a DATE and `arrival_time` is a TIME
// WITHOUT TIME ZONE — both are wall-clock values in the gathering's own
// `timezone` column, not instants. Parsing "2026-11-26" with `new Date()`
// treats it as UTC midnight, which renders as the 25th for anyone west
// of Greenwich. So the parts are split and passed to the Date
// constructor as local numbers, which never shifts the day.

const TYPE_LABELS: Record<string, string> = {
  birthday: "Birthday",
  dinner: "Dinner",
  brunch: "Brunch",
  holiday: "Holiday",
  shower: "Shower",
  cookout: "Cookout",
  game_night: "Game night",
  family_gathering: "Family gathering",
  repast: "Repast",
  open_house: "Open house",
  other: "Gathering",
};

export function gatheringTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "Gathering";
}

export function formatGatheringDate(
  isoDate: string,
  time?: string | null
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);

  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });

  if (!time) return formatted;

  const [hh, mm] = time.split(":").map(Number);
  if (Number.isNaN(hh)) return formatted;
  const suffix = hh >= 12 ? "pm" : "am";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const minutes = mm ? `:${String(mm).padStart(2, "0")}` : "";

  return `${formatted} at ${hour12}${minutes}${suffix}`;
}

/** Days until the gathering. Negative once it has passed. */
export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const RSVP_LABELS: Record<string, string> = {
  invited: "Invited",
  yes: "Coming",
  no: "Not coming",
  maybe: "Maybe",
  no_response: "No answer yet",
};

export function rsvpLabel(status: string): string {
  return RSVP_LABELS[status] ?? status;
}

const CONTRIBUTION_LABELS: Record<string, string> = {
  needed: "Still needed",
  asked: "Asked",
  claimed: "Claimed",
  confirmed: "Confirmed",
  declined: "Declined",
  completed: "Done",
  cancelled: "Cancelled",
};

export function contributionLabel(status: string): string {
  return CONTRIBUTION_LABELS[status] ?? status;
}

const SHOPPING_LABELS: Record<string, string> = {
  need: "Need",
  have: "Have",
  bought: "Bought",
  borrow: "Borrowing",
  rent: "Renting",
  hire: "Hiring",
  not_needed: "Not needed",
};

export function shoppingLabel(status: string): string {
  return SHOPPING_LABELS[status] ?? status;
}
