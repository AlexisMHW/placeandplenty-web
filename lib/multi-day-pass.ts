import type { Entitlement } from "./entitlements.ts";
import { isLive } from "./entitlements.ts";
import { MULTI_DAY_PRICING } from "./pricing.ts";

// MULTI-DAY PASS AT LOCK-IN — the pure, testable half.
//
// WHY THIS EXISTS. Optional migration 203001 makes the database refuse the
// draft -> active transition of a multi-day gathering unless a valid base
// `multi_day_pass` is bound to that gathering. Until then the wizard locked in
// first and asked for the pass second, which means that with 203001 active the
// lock-in would be refused BEFORE the host was ever shown a pass step. This
// module holds the decisions that put the pass step first.
//
// NOTHING HERE DECIDES ENTITLEMENT. The database decides (the
// `gathering_has_multi_day_access` RPC and, with 203001, the trigger). This
// module only (a) orders the steps, (b) explains WHY access is missing in the
// host's words, and (c) reads the exact refusal the trigger raises. It never
// invents access, and when the state cannot be read it refuses to guess.

/** The literal 203001 raises (errcode 42501). Asserted in tests. */
export const MULTI_DAY_PASS_REQUIRED_CODE = "multi_day_pass_required";

/** True when an error/message carries the 203001 refusal. */
export function isMultiDayPassRequired(
  error: { message?: string; code?: string } | string | null | undefined
): boolean {
  const raw = typeof error === "string" ? error : error?.message ?? "";
  return raw.includes(MULTI_DAY_PASS_REQUIRED_CODE);
}

export type MultiDayPassStatus =
  | "valid"
  | "none"
  | "refunded"
  | "revoked"
  | "expired"
  | "inactive";

/**
 * Why a gathering does or does not hold a valid base Multi-Day Pass.
 * Mirrors the database predicate exactly: scope 'gathering', canonical product
 * 'multi_day_pass', active, not refunded, not revoked, not expired. The
 * extension is an add-on and never counts as the base pass.
 */
export function classifyMultiDayPass(
  rows: Entitlement[],
  gatheringId: string,
  now: Date = new Date()
): MultiDayPassStatus {
  const mine = rows.filter(
    (e) =>
      e.scope === "gathering" &&
      e.canonical_product_id === "multi_day_pass" &&
      e.gathering_id === gatheringId
  );
  if (mine.length === 0) return "none";
  if (mine.some((e) => isLive(e, now))) return "valid";
  const latest = [...mine].sort(
    (a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
  )[0];
  if (latest.refunded_at) return "refunded";
  if (latest.revoked_at) return "revoked";
  if (latest.expires_at && new Date(latest.expires_at) <= now) return "expired";
  return "inactive";
}

/** What the wizard does at "Create gathering" for a given duration. */
export type LockInPlan =
  | { action: "finalise" }
  | { action: "pass_step" }
  | { action: "stop"; message: string };

export const ACCESS_CHECK_FAILED_MESSAGE =
  "We couldn’t verify Multi-Day access, so nothing was changed. Your draft is saved. Please try again.";

/**
 * The order of operations. Multi-day needs a verified pass BEFORE the
 * lock-in is attempted; an unreadable state stops the flow rather than
 * guessing in either direction (guessing "has pass" burns a refused write,
 * guessing "no pass" could send a paid host to buy twice).
 */
export function planMultiDayLockIn(input: {
  durationType: "single_day" | "multi_day";
  access: { ok: true; hasPass: boolean } | { ok: false };
  /**
   * Interim gate mode (migration 203003). Optional so existing callers keep
   * today's behaviour. "off"/"absent" = the database is not enforcing, so the
   * legacy lock-in is used; "enforce" = pass-first (the database would refuse).
   */
  gate?: MultiDayGateMode;
}): LockInPlan {
  if (input.durationType !== "multi_day") return { action: "finalise" };
  if (input.gate === "off" || input.gate === "absent") return { action: "finalise" };
  if (!input.access.ok) return { action: "stop", message: ACCESS_CHECK_FAILED_MESSAGE };
  return input.access.hasPass ? { action: "finalise" } : { action: "pass_step" };
}

/** Interim gate (203003) mode as seen by a client. "absent" = RPC not deployed or unreadable-as-missing. */
export type MultiDayGateMode = "off" | "enforce" | "absent";

/** Parse the get_multi_day_lock_in_gate() payload. Anything unrecognised that is not an explicit "enforce" is treated as not enforcing, never as a bypass of the database (the DB still decides). */
export function parseMultiDayGateMode(payload: unknown): MultiDayGateMode {
  const mode = (payload as { mode?: unknown } | null | undefined)?.mode;
  if (mode === "enforce") return "enforce";
  if (mode === "off") return "off";
  return "absent";
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

/** The pass step. The gathering stays a draft while the host is here. */
export function multiDayPassStepPath(gatheringId: string): string {
  return `/host/create/pass?gatheringId=${encodeURIComponent(gatheringId)}`;
}

/** Where a card checkout returns to, so the host can finish locking in. */
export function multiDayCheckoutReturnPath(gatheringId: string): string {
  return `${multiDayPassStepPath(gatheringId)}&purchase=success`;
}

/* ------------------------------------------------------------------ */
/* Price                                                               */
/* ------------------------------------------------------------------ */

export type MultiDayPurchaseTier = "standard" | "gathering_pass" | "plus";

/**
 * The price line for the host's tier, from the one canonical constants file.
 * An unknown or missing tier falls back to the standard price rather than a
 * lower one, so a failed tier lookup can never advertise a discount.
 */
export function multiDayPassPriceLine(tier: string | null | undefined): string {
  const key: MultiDayPurchaseTier =
    tier === "plus" || tier === "gathering_pass" || tier === "standard" ? tier : "standard";
  return MULTI_DAY_PRICING[key].priceLine;
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

export interface PassStepCopy {
  title: string;
  body: string;
}

export const PASS_STEP_COPY: Record<MultiDayPassStatus, PassStepCopy> = {
  valid: {
    title: "Your Multi-Day Pass is active",
    body: "This gathering has a valid Multi-Day Pass. Finish creating it to start planning across the days.",
  },
  none: {
    title: "A Multi-Day Pass starts this gathering",
    body: "Multi-Day gatherings need a Multi-Day Pass before they can be started. Your draft is saved, and nothing is lost while you decide.",
  },
  refunded: {
    title: "This gathering’s Multi-Day Pass was refunded",
    body: "A refunded pass no longer covers this gathering. Your draft is saved. Add a new Multi-Day Pass to start it.",
  },
  revoked: {
    title: "This gathering’s Multi-Day Pass is no longer active",
    body: "The pass on this gathering was revoked, so it can’t start it. Your draft is saved. If you think this is a mistake, contact support before buying again.",
  },
  expired: {
    title: "This gathering’s Multi-Day Pass has expired",
    body: "An expired pass can’t start a gathering. Your draft is saved. Add a new Multi-Day Pass to start it.",
  },
  inactive: {
    title: "This gathering’s Multi-Day Pass isn’t active",
    body: "The pass on this gathering isn’t active yet, so it can’t start it. If you just paid, give it a minute and check again. Your draft is saved.",
  },
};

/** Said when card checkout is not configured on this deployment. */
export const PURCHASE_IN_APP_MESSAGE =
  "Buying a Multi-Day Pass is available in the Place & Plenty app for now. Sign in with the same account, open this gathering, and choose the Multi-Day Pass. It will unlock here too. Your draft is saved.";

export const CONFIRMING_PURCHASE_MESSAGE =
  "Payment received — we’re confirming it with the store. This usually takes a moment. You won’t be asked to pay again.";

export const LOCK_IN_REFUSED_MESSAGE =
  "A Multi-Day Pass is needed to start this gathering. Your draft is saved.";
