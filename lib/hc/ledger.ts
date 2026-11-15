// PURCHASE EVENT -> COMMISSION LEDGER CALLS. Pure planner, no imports. The web purchase webhook (service context) imports this, runs the
// plan against the database and nothing else; it never computes a commission itself. Every call is idempotent in the database
// (keyed by provider_transaction_id / entitlement id), so a replayed webhook cannot double-pay.
// Flag: HC_LEDGER_WIRING_ENABLED must be exactly "true" for the webhook to execute a plan; otherwise the webhook behaves as today.
import { isQualifyingProduct } from "./policy.ts";

export type PurchaseEvent =
  | { kind: "purchase"; entitlementId: string; providerTransactionId: string; product: string; currency: string; subtotalCents: number; taxCents: number; feeCents: number; stripeCustomerId: string | null; paymentFingerprintHash: string | null }
  | { kind: "dispute"; providerTransactionId: string; status: "open" | "won" | "lost" | "none" }
  | { kind: "refund"; entitlementId: string; providerTransactionId: string; partial: boolean }
  // H (DEF-2): partial refund; mirrors the planner in the proposed webhook (native supabase/functions_proposed_a7/web-purchase-webhook/hcLedger.ts).
  | { kind: "partial_refund"; entitlementId?: string | null; providerTransactionId: string; refundedCents: number }
  | { kind: "sweep" };

export type LedgerCall = { rpc: string; args: Record<string, unknown> };
export type LedgerPlan = { ok: true; calls: LedgerCall[] } | { ok: false; reason: string };

export const ledgerWiringEnabled = (env: { HC_LEDGER_WIRING_ENABLED?: string }) => env.HC_LEDGER_WIRING_ENABLED === "true";
const nonNegInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export function planLedgerCalls(ev: PurchaseEvent): LedgerPlan {
  switch (ev.kind) {
    case "purchase": {
      if (!ev.entitlementId || !ev.providerTransactionId) return { ok: false, reason: "missing_ids" };
      if (!isQualifyingProduct(ev.product)) return { ok: false, reason: "not_qualifying_product" }; // no ledger row for products that never earn commission
      if (![ev.subtotalCents, ev.taxCents, ev.feeCents].every(nonNegInt)) return { ok: false, reason: "invalid_amounts" };
      return { ok: true, calls: [
        { rpc: "record_purchase_facts", args: { p_entitlement_id: ev.entitlementId, p_provider_transaction_id: ev.providerTransactionId, p_currency: (ev.currency || "usd").toLowerCase(), p_amount_subtotal_cents: ev.subtotalCents, p_tax_cents: ev.taxCents, p_fee_cents: ev.feeCents, p_stripe_customer_id: ev.stripeCustomerId, p_payment_fingerprint_hash: ev.paymentFingerprintHash, p_source: "webhook" } },
        { rpc: "reconcile_commission_for_entitlement", args: { p_entitlement_id: ev.entitlementId } },
      ] };
    }
    case "dispute":
      if (!ev.providerTransactionId) return { ok: false, reason: "missing_ids" };
      return { ok: true, calls: [{ rpc: "record_purchase_dispute", args: { p_provider_transaction_id: ev.providerTransactionId, p_status: ev.status } }] };
    case "refund":
      // Full refund: the entitlement row is refunded by the existing handler; reconcile reverses the commission. Partial refund keeps access
      // and the commission is HELD for staff review (owner decision), so we only reconcile and never reverse automatically.
      if (!ev.entitlementId) return { ok: false, reason: "missing_ids" };
      return { ok: true, calls: [{ rpc: "reconcile_commission_for_entitlement", args: { p_entitlement_id: ev.entitlementId } }] };
    case "partial_refund": {
      // Partial refund keeps access; record_purchase_partial_refund holds the commission for review (refunded purchases are excluded). Reconcile first only when the entitlement is known.
      if (!ev.providerTransactionId) return { ok: false, reason: "missing_ids" };
      if (!Number.isInteger(ev.refundedCents) || ev.refundedCents <= 0) return { ok: false, reason: "invalid_amounts" };
      const calls: LedgerCall[] = [];
      if (ev.entitlementId) calls.push({ rpc: "reconcile_commission_for_entitlement", args: { p_entitlement_id: ev.entitlementId } });
      calls.push({ rpc: "record_purchase_partial_refund", args: { p_provider_transaction_id: ev.providerTransactionId, p_refunded_cents: ev.refundedCents } });
      return { ok: true, calls };
    }
    case "sweep":
      return { ok: true, calls: [{ rpc: "sweep_commissions", args: {} }] };
  }
}
