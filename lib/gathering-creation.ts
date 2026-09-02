// CREATING A GATHERING: the canonical vocabulary and the deterministic
// rules, in one place, spelled the way the database and the native app
// spell them.
//
// This module exists for the same reason lib/invitations.ts does. Host
// Web spent months comparing `invitation_mode` against `own_artwork`, a
// value no migration has ever contained, because the string was typed
// from memory inside a component. A wizard that writes `food_style` has
// exactly the same exposure — `food_style` is a plain `text` column with
// no CHECK constraint, so Postgres will happily store "Potluck",
// "not_sure" or "I'm cooking" and every downstream reader will simply
// stop recognising the value.
//
// THE VALUES BELOW ARE THE NATIVE APP'S, CHARACTER FOR CHARACTER.
// `FOOD_STYLES` mirrors `FOOD_STYLES` in app/gathering/create.tsx of the
// native repo; `GATHERING_TYPES` mirrors the `public.gathering_type`
// enum in 20260814011948_gatherings.sql, in the order the app offers
// them. `notSure` is camelCase in the database because the app writes
// the same identifier it uses as a translation key. That is not a
// mistake to tidy up here — a "correction" on the web side would write
// a value the phone cannot read back.
//
// LABELS ARE WEB COPY; VALUES ARE THE CONTRACT. The label map may be
// reworded freely. The keys may not.
//
// NOTHING IS IMPORTED HERE, AND THAT IS DELIBERATE. This module is
// asserted directly by tests/contracts.test.ts, which runs under plain
// `node --test` with no bundler and therefore no `@/` path alias. Its
// peers — lib/guest-counts.ts, lib/invitations.ts — are dependency-free
// for the same reason. Gathering-type LABELS live in lib/host-format.ts
// alongside every other label map; import them from there.

/* ------------------------------------------------------------------ */
/* Vocabulary                                                         */
/* ------------------------------------------------------------------ */

/** `public.gathering_type`, in the order the native wizard offers them. */
export const GATHERING_TYPES = [
  "birthday",
  "dinner",
  "brunch",
  "holiday",
  "shower",
  "cookout",
  "game_night",
  "family_gathering",
  "repast",
  "open_house",
  "other",
] as const;

export type GatheringType = (typeof GATHERING_TYPES)[number];

export function isGatheringType(value: string): value is GatheringType {
  return (GATHERING_TYPES as readonly string[]).includes(value);
}

/**
 * `gatherings.food_style`. Five values, and no others — the column is
 * untyped text, so this list is the only thing enforcing them.
 */
export const FOOD_STYLES = [
  "cooking",
  "mixed",
  "catering",
  "potluck",
  "notSure",
] as const;

export type FoodStyle = (typeof FOOD_STYLES)[number];

export function isFoodStyle(value: string): value is FoodStyle {
  return (FOOD_STYLES as readonly string[]).includes(value);
}

/** How each food style is offered to the host. Native's own wording. */
export const FOOD_STYLE_LABELS: Record<FoodStyle, string> = {
  cooking: "I'm cooking",
  mixed: "Some cooking + some purchased",
  catering: "Catering / takeout",
  potluck: "Potluck",
  notSure: "Not sure yet",
};

/* ------------------------------------------------------------------ */
/* The shape the wizard collects                                      */
/* ------------------------------------------------------------------ */

/**
 * Partial, in-progress data — deliberately not the `gatherings` row
 * type. Mirrors `CreateGatheringInput` in the native repo's
 * features/gatherings/types.ts.
 */
export interface CreateGatheringInput {
  name: string;
  gatheringType: GatheringType | null;
  /** "YYYY-MM-DD" */
  gatheringDate: string | null;
  /** "HH:MM", 24-hour */
  arrivalTime: string | null;
  locationName: string;
  adultCount: number;
  childCount: number;
  /** null means the host skipped it, which is a real answer. */
  budgetTarget: number | null;
  foodStyle: FoodStyle | null;
  notes: string;
}

/**
 * 6:00 PM, the same default the native wizard opens on
 * (`DEFAULT_TIME_PARTS` in features/gatherings/services/dateHelpers.ts).
 */
export const DEFAULT_ARRIVAL_TIME = "18:00";

export const EMPTY_GATHERING_INPUT: CreateGatheringInput = {
  name: "",
  gatheringType: null,
  gatheringDate: null,
  arrivalTime: null,
  locationName: "",
  adultCount: 0,
  childCount: 0,
  budgetTarget: null,
  foodStyle: null,
  notes: "",
};

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export type GatheringValidationErrorCode =
  | "name_required"
  | "type_required"
  | "date_required"
  | "arrival_time_required"
  | "headcount_required";

export interface GatheringValidationError {
  code: GatheringValidationErrorCode;
  field: keyof CreateGatheringInput;
}

/**
 * The same five rules the native app applies, in the same order.
 * Deterministic, offline, and advisory — the database remains the source
 * of truth for what may actually be written.
 */
export function validateGatheringInput(
  input: CreateGatheringInput
): GatheringValidationError[] {
  const errors: GatheringValidationError[] = [];

  if (!input.name.trim()) {
    errors.push({ code: "name_required", field: "name" });
  }
  if (!input.gatheringType) {
    errors.push({ code: "type_required", field: "gatheringType" });
  }
  if (!input.gatheringDate) {
    errors.push({ code: "date_required", field: "gatheringDate" });
  }
  if (!input.arrivalTime) {
    errors.push({ code: "arrival_time_required", field: "arrivalTime" });
  }
  // A headcount of zero may be *entered* as a starting point. It may not
  // be saved: a gathering needs someone coming.
  if (input.adultCount + input.childCount <= 0) {
    errors.push({ code: "headcount_required", field: "adultCount" });
  }

  return errors;
}

/**
 * THE AUTOSAVE GATE. A draft row is written the moment — and only the
 * moment — the wizard holds every field the row requires. Before that
 * there is nothing to save that Postgres would accept; after it, every
 * further step updates the same row rather than making another.
 */
export function hasEnoughToSaveDraft(input: CreateGatheringInput): boolean {
  return validateGatheringInput(input).length === 0;
}

export const VALIDATION_MESSAGES: Record<
  GatheringValidationErrorCode,
  string
> = {
  name_required: "Give your gathering a name to continue.",
  type_required: "Choose what kind of gathering this is.",
  date_required: "Enter a date to continue.",
  arrival_time_required: "Enter an arrival time to continue.",
  headcount_required: "Add at least one guest.",
};

/**
 * A warning, never an error. Entering a gathering that has already
 * started is a real thing a host does when they are catching up, so it
 * is surfaced and then got out of the way.
 */
export function isArrivalInPast(
  gatheringDate: string,
  arrivalTime: string,
  now: Date = new Date()
): boolean {
  const [y, m, d] = gatheringDate.split("-").map(Number);
  const [hh, mm] = arrivalTime.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh)) return false;
  // Built from parts as local wall-clock, never parsed as an instant —
  // see the timezone note at the top of lib/host-format.ts.
  return new Date(y, m - 1, d, hh, mm || 0).getTime() < now.getTime();
}

/** Today, as the wizard's opening date. Local, not UTC. */
export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
