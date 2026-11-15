// PAYOUT ACCESS DECISIONS (founder decision A). Pure, no imports of runtime code, no I/O.
//   VIEW  (history, ledger, clawbacks, eligibility): the owner and authorized financial staff, i.e. permission hc.payout. A manager with only hc.read sees nothing.
//   ACT   (draft, approve, record an external payment, void, reverse, settle a clawback, change terms or the paid-referrals switch): the OWNER only.
// Nothing here or anywhere in the app moves money. Payments happen outside the app; the app only records them.
import type { StaffContext } from "@/lib/admin/access";

export function canViewPayouts(ctx: StaffContext): boolean {
  return (ctx.permissions as string[]).includes("hc.payout");
}
export function canActOnPayouts(ctx: StaffContext): boolean {
  return ctx.role === "owner" && canViewPayouts(ctx);
}
