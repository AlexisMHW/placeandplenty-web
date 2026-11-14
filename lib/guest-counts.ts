// Guest-count arithmetic for a gathering, kept pure and kept apart.
//
// `gatherings.expected_guest_count` is DERIVED from adult_count +
// child_count. All three columns are NOT NULL with a default of 0, so
// there is no "unset" value to fall back on — whatever is written is
// believed.
//
// THE BUG THIS MODULE EXISTS TO PREVENT. The settings patch used to
// compute `(submittedAdults ?? 0) + (submittedChildren ?? 0)`. A form
// that sent one field and not the other therefore scored the missing one
// as zero:
//
//   stored:    20 adults, 5 children, 25 expected
//   submitted: children = 6
//   written:   adult_count 20, child_count 6, expected_guest_count 6
//
// The record then disagreed with itself, and every serving calculation
// downstream of expected_guest_count inherited the wrong number.
//
// A missing field means "leave it alone". That is the whole rule, and it
// has to be applied against the PERSISTED value rather than zero —
// which is why this takes `current` and why it lives in its own module
// with a test beside it rather than inline in a server action.

export interface SubmittedCounts {
  /** null when the field was absent or blank — never "zero". */
  adults: number | null;
  children: number | null;
}

export interface StoredCounts {
  adults: number;
  children: number;
}

export interface MergedCounts {
  adult_count: number;
  child_count: number;
  expected_guest_count: number;
}

export function mergeGuestCounts(
  submitted: SubmittedCounts,
  current: StoredCounts
): MergedCounts {
  const adults = normalise(submitted.adults ?? current.adults);
  const children = normalise(submitted.children ?? current.children);

  return {
    adult_count: adults,
    child_count: children,
    expected_guest_count: adults + children,
  };
}

/** Whole, non-negative people. The columns are integers and counts of humans. */
function normalise(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

// ---------------------------------------------------------------------------
// "I'M NOT SURE YET" — the write side.
//
// Native writes an unknown count as:
//   adult_count 0, child_count 0, expected_guest_count NULL, guest_count_unknown true
// (features/gatherings/services/gatheringService.ts). The web writes the
// same four columns so either client reads the other's gathering correctly.
//
// Two guards keep "unknown" from silently becoming "zero":
//   1. Leaving unknown with no people entered is refused, not stored as 0.
//   2. A database that predates the column (production today) cannot store
//      unknown at all — expected_guest_count is NOT NULL there — so the
//      request is refused with an honest message instead of writing 0.
// ---------------------------------------------------------------------------

export interface GuestCountSubmission {
  /** true = chose "I'm Not Sure Yet"; false = chose to enter numbers; null = field absent, leave alone. */
  unknown: boolean | null;
  adults: number | null;
  children: number | null;
}

export interface GuestCountCurrent {
  adults: number;
  children: number;
  unknown: boolean;
}

export type GuestCountWritePlan =
  | { ok: true; columns: Record<string, unknown> }
  | { ok: false; reason: "unsupported" | "headcount_required" };

export function planGuestCountWrite(
  submitted: GuestCountSubmission,
  current: GuestCountCurrent,
  supportsUnknown: boolean
): GuestCountWritePlan {
  if (submitted.unknown === true) {
    if (!supportsUnknown) return { ok: false, reason: "unsupported" };
    return {
      ok: true,
      columns: {
        adult_count: 0,
        child_count: 0,
        expected_guest_count: null,
        guest_count_unknown: true,
      },
    };
  }

  const touchedNumbers = submitted.adults !== null || submitted.children !== null;
  const leavingUnknown = current.unknown && (submitted.unknown === false || touchedNumbers);

  if (!touchedNumbers && !current.unknown) {
    // Nothing about the headcount changed: leave every column alone.
    return { ok: true, columns: {} };
  }
  if (!touchedNumbers && current.unknown && submitted.unknown === null) {
    return { ok: true, columns: {} };
  }

  // Leaving unknown starts from nothing, never from the stored zeros.
  const base = current.unknown ? { adults: 0, children: 0 } : { adults: current.adults, children: current.children };
  const merged = mergeGuestCounts(
    { adults: submitted.adults, children: submitted.children },
    base
  );

  if (leavingUnknown && merged.expected_guest_count <= 0) {
    return { ok: false, reason: "headcount_required" };
  }

  return {
    ok: true,
    columns: {
      ...merged,
      ...(supportsUnknown ? { guest_count_unknown: false } : {}),
    },
  };
}
