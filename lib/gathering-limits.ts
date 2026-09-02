// THREE REFUSALS THAT ARE NOT FAILURES.
//
// A host on Free who already has a gathering open has not done anything
// wrong, and neither has a host on Plus with six. In each case a
// Postgres trigger declined the write for a reason the host can act on,
// and the UI needs to tell them apart from "something went wrong"
// without reading English out of an error message.
//
// WHERE EACH ONE COMES FROM, and it is the database every time:
//
//   free_open_gathering_limit_reached   assert_free_gathering_slot_available()
//   plus_open_gathering_limit_reached     cap of 1 on Free, 6 on Plus,
//                                         raised as the gathering row is
//                                         inserted or reopened
//
//   plus_annual_allowance_reached       enforce_lock_in_rules(), when a
//                                         Plus term's twelve lock-ins are
//                                         spent and the gathering tries to
//                                         leave `draft`
//
// NOTHING HERE COUNTS ANYTHING. No open-gathering tally, no entitlement
// read, no tier inference, no "is this host on Plus" — the caps of 1, 6
// and 12 appear below only inside sentences the host reads, never in a
// comparison. The database decides which limit applies and says so; this
// module maps its answer to copy. The moment it starts deciding
// *whether* a host is at a limit there are two answers to that question,
// and they will disagree.
//
// This is a plain module rather than part of lib/host-actions.ts because
// that file is "use server" and may only export async functions — and
// because keeping the copy here means tests/contracts.test.ts can assert
// it, which a .tsx component would not allow.

export type GatheringLimitCode =
  | "free_open_gathering_limit_reached"
  | "plus_open_gathering_limit_reached"
  | "plus_annual_allowance_reached";

/**
 * The literals the migrations raise, character for character. A typo
 * costs the whole feature silently — the code never matches, and the
 * host gets the generic message instead of the notice — so these are
 * asserted in tests rather than trusted.
 */
export const GATHERING_LIMIT_CODES: GatheringLimitCode[] = [
  "free_open_gathering_limit_reached",
  "plus_open_gathering_limit_reached",
  "plus_annual_allowance_reached",
];

export function isGatheringLimitCode(
  value: string
): value is GatheringLimitCode {
  return (GATHERING_LIMIT_CODES as string[]).includes(value);
}

export interface GatheringLimitCopy {
  title: string;
  body: string;
  primary: { label: string; href: string };
  /** A second way out, where one helps. Plus 6 does not need one. */
  secondary?: { label: string; href: string };
  /** Plus 12's second action is "leave it as it is", which is no link. */
  dismiss?: string;
}

/**
 * THE CALLS TO ACTION DIFFER ON PURPOSE.
 *
 *   Free     is a real upgrade conversation, so it leads to the plans.
 *
 *   Plus 6   is NOT one. Six open gatherings is the plan working exactly
 *            as sold; there is nothing to buy, and a Gathering Pass does
 *            not lift this cap. Offering one here would be selling
 *            against a limit the purchase does not answer, so this
 *            notice deliberately carries NO Pass call to action.
 *
 *   Plus 12  is the one case where a Pass genuinely applies, and it is
 *            offered in the future tense because paid purchasing is not
 *            live on the web. The draft survives the refusal — the
 *            lock-in trigger rejects the transition and leaves the row
 *            in `draft` — so "This draft is saved" is a statement of
 *            fact rather than reassurance.
 */
export const GATHERING_LIMIT_COPY: Record<
  GatheringLimitCode,
  GatheringLimitCopy
> = {
  free_open_gathering_limit_reached: {
    title: "One free gathering at a time",
    body: "Free includes one open gathering at a time. Finish or close your current gathering, or add paid access when purchasing opens.",
    primary: { label: "Compare plans", href: "/pricing" },
    secondary: { label: "My Gatherings", href: "/host" },
  },
  plus_open_gathering_limit_reached: {
    title: "You have six gatherings open",
    body: "Plus includes up to 6 open gatherings at one time. Finish, archive, or cancel one before opening another.",
    primary: { label: "My Gatherings", href: "/host" },
  },
  plus_annual_allowance_reached: {
    title: "You’ve used this term’s 12 Plus lock-ins",
    body: "Your Plus account features stay active. This draft is saved. A Gathering Pass can unlock this gathering when paid purchasing is available.",
    primary: { label: "See Gathering Pass", href: "/pricing" },
    dismiss: "Keep as draft",
  },
};
