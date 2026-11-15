// Minimal reproductions of the two defects found while testing the webhook commission wiring (sweep after a dispute-open; partial refund never held).
import { check, sql, jwt, rpc, summary } from "./lib.mjs";
import { owner, P1, referred, buy, svc, activate, planLedgerCalls, DAY, sweep } from "./fixtures.mjs";
await activate();
const ev = (id, kind, type, pi, at) => ({ provider: "stripe", provider_event_id: id, provider_event_type: type, event_kind: kind, event_at: new Date(at).toISOString(), payment_intent_id: pi });
// ---- DEFECT 1: dispute OPEN then the webhook's sweep reverses the commission; dispute WON restores access but the commission stays reversed
const r1 = await referred(); const b1 = await buy(r1.u, "gathering_pass", { txn: "pi_def1" });
const t0 = Date.now() + 1000;
await svc("apply_payment_event", { p_event: ev("def1_open", "dispute_opened", "charge.dispute.created", "pi_def1", t0) });
await svc("record_purchase_dispute", { p_provider_transaction_id: "pi_def1", p_status: "open" });
const ent1 = sql("select active||'/'||coalesce(revoked_reason,'-') from gathering_entitlements where provider_transaction_id='pi_def1'");
const s1 = await svc("sweep_commissions", {});                       // what the webhook does right after a dispute event (hcAfterLifecycle alsoSweep=true)
const afterOpen = sql("select state||'/'||coalesce(reason,'-') from commissions where source_provider_transaction_id='pi_def1'");
await svc("apply_payment_event", { p_event: ev("def1_won", "dispute_won", "charge.dispute.closed", "pi_def1", t0 + 5000) });
await svc("record_purchase_dispute", { p_provider_transaction_id: "pi_def1", p_status: "won" });
await svc("sweep_commissions", {});
const afterWon = sql("select state||'/'||coalesce(reason,'-') from commissions where source_provider_transaction_id='pi_def1'");
const entWon = sql("select active from gathering_entitlements where provider_transaction_id='pi_def1'");
check("DEF-1", "dispute OPENED then WON on a commission-earning purchase, with a sweep between (the webhook runs sweep after every dispute event): commission should be held while open and released (pending) when won", "DB via PostgREST (service)", "open: held/dispute_open; won: pending/dispute_won", `entitlement while open=${ent1}; after open+sweep=${afterOpen}; entitlement after won active=${entWon}; commission after won+sweep=${afterWon}`, afterOpen.startsWith("held") && afterWon.startsWith("pending"),
  "root cause: ledger marks the entitlement revoked_at/revoked_reason='dispute_open' while a dispute is open; 217300 sweep step 1 reverses any commission whose entitlement has revoked_at set unless revoked_reason='subscription_deleted'; reversal is terminal, so 'won' cannot release it");
// ---- DEFECT 2: partial refund never holds the commission when driven by the webhook plan
const r2 = await referred(); const b2 = await buy(r2.u, "gathering_pass", { txn: "pi_def2" });
await svc("apply_payment_event", { p_event: { ...ev("def2_pr", "refund_partial", "charge.refunded", "pi_def2", t0 + 1000), amount_refunded_minor: 300, reason: "stripe_partial_refund" } });
const eid = sql("select id from gathering_entitlements where provider_transaction_id='pi_def2'");
await svc("reconcile_commission_for_entitlement", { p_entitlement_id: eid });   // refund plan = reconcile only (hcLedger.ts 'refund')
await svc("sweep_commissions", {});
const afterPartial = sql("select state||'/'||coalesce(reason,'-') from commissions where source_provider_transaction_id='pi_def2'");
await sweep(new Date(Date.now() + 46 * DAY));
const after46 = sql("select state||'/'||coalesce(reason,'-') from commissions where source_provider_transaction_id='pi_def2'");
const callers = sql("select count(*) from pg_proc where prosrc ilike '%record_purchase_partial_refund%' and proname <> 'record_purchase_partial_refund'");
check("DEF-2", "PARTIAL refund of a commission-earning purchase via the webhook's plan (reconcile + sweep): commission should be HELD for staff review (founder rule) and never auto-validate", "DB via PostgREST (service)", "held/partial_refund_review; stays held after 45 days", `after partial refund=${afterPartial}; after +46 days sweep=${after46}; DB callers of record_purchase_partial_refund=${callers}; webhook/web callers=0 (grep)`, afterPartial.startsWith("held") && after46.startsWith("held"),
  "record_purchase_partial_refund (214003/217440) exists but neither hcLedger.ts planLedgerCalls('refund') nor handler.ts calls it; reconcile does not hold; the commission validates after the 45-day hold and becomes payable");
summary();
