"use server";
import { requirePayoutOwner } from "@/lib/admin/server";
import type { ActionResult } from "@/lib/hc/lifecycle";
import { payoutAction, addTermsVersion, resolvePartialRefundHold } from "./actions";

// State-aware wrappers (visible success/error text). Owner only: hc.payout plus the owner role are checked here before delegating, and again in the wrapped action and in
// every database function. NOTHING HERE MOVES MONEY; "record as paid" only records a transfer the owner made elsewhere.
const PATH = "/command-center/hosting-collective/payouts";
export async function payoutForm(_p: ActionResult | null, fd: FormData) { await requirePayoutOwner(PATH); return payoutAction(fd); }
export async function termsForm(_p: ActionResult | null, fd: FormData) { await requirePayoutOwner(PATH); return addTermsVersion(fd); }
export async function partialRefundForm(_p: ActionResult | null, fd: FormData) { await requirePayoutOwner(PATH); return resolvePartialRefundHold(fd); }
