"use server";
import { requireStaff } from "@/lib/admin/server";
import type { ActionResult } from "@/lib/hc/lifecycle";
import { payoutAction, addTermsVersion } from "./actions";

// State-aware wrappers (visible success/error text). Owner only: hc.payout is checked here before delegating, and again in the wrapped action and in
// every database function. NOTHING HERE MOVES MONEY; "record as paid" only records a transfer the owner made elsewhere.
const PATH = "/command-center/hosting-collective/payouts";
export async function payoutForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.payout", PATH); return payoutAction(fd); }
export async function termsForm(_p: ActionResult | null, fd: FormData) { await requireStaff("hc.payout", PATH); return addTermsVersion(fd); }
