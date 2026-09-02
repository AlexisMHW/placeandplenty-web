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
