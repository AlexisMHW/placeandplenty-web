// NEW (final code 217470/217480): dispute / partial-refund commission handling at DB level, then payout blocking. Scratch DB only.
import { check, sql, jwt, rpc, summary } from "./lib.mjs";
import { owner, P1, activate, validatedTotal, referred, buy, svc, sweep, cnt, DAY } from "./fixtures.mjs";
await activate();
const O = jwt(owner), t0 = Date.now() + 1000;
const ev = (id, kind, type, pi, dt, extra = {}) => ({ provider: "stripe", provider_event_id: id, provider_event_type: type, event_kind: kind, event_at: new Date(t0 + dt).toISOString(), payment_intent_id: pi, ...extra });
const st = (txn) => sql(`select state||'/'||coalesce(reason,'-') from commissions where source_provider_transaction_id='${txn}'`);
const dispute = async (txn, kind, status, dt) => { await svc("apply_payment_event", { p_event: ev(`${txn}_${kind}`, kind, kind === "dispute_opened" ? "charge.dispute.created" : "charge.dispute.closed", txn, dt) }); await svc("record_purchase_dispute", { p_provider_transaction_id: txn, p_status: status }); };
const partial = async (txn, dt) => { await svc("apply_payment_event", { p_event: ev(`${txn}_pr`, "refund_partial", "charge.refunded", txn, dt, { amount_refunded_minor: 300, reason: "stripe_partial_refund" }) }); return svc("record_purchase_partial_refund", { p_provider_transaction_id: txn, p_refunded_cents: 300 }); };
// ---- open dispute: held, and stays held through repeated sweeps incl. far in the future
const a = await referred(); await buy(a.u, "plus_annual", { txn: "pi_a" });
await dispute("pi_a", "dispute_opened", "open", 100);
await sweep(new Date()); const a1 = st("pi_a"); await sweep(new Date()); await sweep(new Date(Date.now() + 60 * DAY)); const a2 = st("pi_a");
check("N-D1", "open dispute -> sweep -> commission HELD (dispute_open); repeated sweeps, even 60 days later, keep it held (never reversed, never validated)", "DB via PostgREST (service)", "held/dispute_open x2", `${a1}; ${a2}`, a1 === "held/dispute_open" && a2 === "held/dispute_open");
// ---- won: released, then the normal 45-day rule
await dispute("pi_a", "dispute_won", "won", 200);
await sweep(new Date()); const w1 = st("pi_a");
const vAfter = sql("select validate_after from commissions where source_provider_transaction_id='pi_a'"); const purch = sql("select purchased_at from commissions where source_provider_transaction_id='pi_a'");
const sixty = sql(`select extract(epoch from (validate_after - purchased_at))/86400 from commissions where source_provider_transaction_id='pi_a'`);
await sweep(new Date(Date.now() + 44 * DAY)); const w44 = st("pi_a");
await sweep(new Date(Date.now() + 46 * DAY)); const w46 = st("pi_a");
check("N-D2", "dispute WON -> released to pending/dispute_won at once; NOT payable early (still pending at day 44); validated after the normal 45-day hold (validate_after stays purchased_at+45d)", "DB via PostgREST (service)", "pending/dispute_won; pending; validated; hold=45d", `${w1}; day44=${w44}; day46=${w46}; hold_days=${sixty}`, w1 === "pending/dispute_won" && w44.startsWith("pending") && w46.startsWith("validated") && Number(sixty) === 45);
// ---- payable and payable through the owner-only flow
await validatedTotal(5000);
const d = await rpc(O, "hc_create_payout_draft", { p_partner_id: P1 }); const PID = d.data?.payout_id;
const inDraft = sql(`select state from commissions where source_provider_transaction_id='pi_a'`);
const ap = await rpc(O, "hc_approve_payout", { p_payout_id: PID });
const rec = await rpc(O, "hc_record_external_payment", { p_payout_id: PID, p_external_ref: "ACH-E4-0001", p_paid_on: new Date().toISOString().slice(0, 10), p_method: "bank transfer", p_confirm_external_payment: true });
check("N-D3", "the won-dispute commission becomes payable (state payable in the Draft), the owner approves and records payment; it ends paid", "DB via PostgREST", "draft; payable; approved; paid; commission paid", `draft=${d.data?.status}/${d.data?.net_cents}; in draft=${inDraft}; approve=${JSON.stringify(ap.data ?? ap.error)}; record=${JSON.stringify(rec.data ?? rec.error)}; commission=${st("pi_a")}`, d.data?.status === "draft" && inDraft === "payable" && st("pi_a").startsWith("paid"));
// ---- lost: reversed
const b = await referred(); await buy(b.u, "plus_annual", { txn: "pi_b" });
await dispute("pi_b", "dispute_opened", "open", 300); await sweep(new Date()); const b1 = st("pi_b");
await dispute("pi_b", "dispute_lost", "lost", 400); await sweep(new Date()); const b2 = st("pi_b");
await dispute("pi_b", "dispute_won", "won", 500); await sweep(new Date()); const b3 = st("pi_b");
check("N-D4", "dispute LOST -> reversed (held while open, reversed on loss); a later 'won' event cannot resurrect it", "DB via PostgREST (service)", "held; reversed/refund_or_dispute; reversed", `${b1}; ${b2}; ${b3}`, b1 === "held/dispute_open" && b2 === "reversed/refund_or_dispute" && b3.startsWith("reversed"));
// ---- partial refund
const c = await referred(); await buy(c.u, "plus_annual", { txn: "pi_c" });
const pr = await partial("pi_c", 600); await sweep(new Date()); const c1 = st("pi_c"); await sweep(new Date(Date.now() + 46 * DAY)); const c2 = st("pi_c");
check("N-P1", "partial refund -> HELD with reason partial_refund_review; stays held after the 45-day hold and repeated sweeps (no automatic release)", "DB via PostgREST (service)", "held/partial_refund_review x2", `record=${JSON.stringify(pr.data ?? pr.error)}; ${c1}; day46=${c2}`, c1 === "held/partial_refund_review" && c2 === "held/partial_refund_review");
const pe = await rpc(O, "hc_admin_payout_eligibility", {});
await validatedTotal(5000); const d2 = await rpc(O, "hc_create_payout_draft", { p_partner_id: P1 });
check("N-P2", "a partial-refund-held commission is never drafted into a payout", "DB via PostgREST", "pi_c not in any payout", `pi_c=${st("pi_c")}; payout_id=${sql("select coalesce(payout_id::text,'none') from commissions where source_provider_transaction_id='pi_c'")}; draft=${d2.data?.status}`, sql("select payout_id is null from commissions where source_provider_transaction_id='pi_c'") === "t");
// ---- partial refund AFTER it is in a Draft: draft voided / approve blocked ; after Approved: record blocked
const e = await referred(); await buy(e.u, "plus_annual", { txn: "pi_e" }); await sweep(new Date(Date.now() + 46 * DAY));
await validatedTotal(5000); const d3 = await rpc(O, "hc_create_payout_draft", { p_partner_id: P1 }); const P3 = d3.data?.payout_id;
const e0 = st("pi_e"); const inP3 = sql(`select payout_id::text='${P3}' from commissions where source_provider_transaction_id='pi_e'`);
await partial("pi_e", 700); await sweep(new Date());
const p3s = sql(`select status||'/'||coalesce(void_reason,'-') from payouts where id='${P3}'`);
const ap3 = await rpc(O, "hc_approve_payout", { p_payout_id: P3 });
check("N-P3", "partial refund flagged on a commission already in a DRAFT payout: the draft is voided / cannot be approved by the owner", "DB via PostgREST", "before: payable in draft; after: payout void or approve refused", `before=${e0} in_draft=${inP3}; payout=${p3s}; owner approve=${JSON.stringify(ap3.data ?? ap3.error?.message)}; commission=${st("pi_e")}`, inP3 === "t" && (/^void/.test(p3s) || ap3.error || (ap3.data && ap3.data.status !== "approved")) && sql(`select status from payouts where id='${P3}'`) !== "approved" && sql(`select status from payouts where id='${P3}'`) !== "paid");
const f = await referred(); await buy(f.u, "plus_annual", { txn: "pi_f" }); await sweep(new Date(Date.now() + 46 * DAY));
await validatedTotal(5000); const d4 = await rpc(O, "hc_create_payout_draft", { p_partner_id: P1 }); const P4 = d4.data?.payout_id;
const ap4 = await rpc(O, "hc_approve_payout", { p_payout_id: P4 }); const wasApproved = sql(`select status from payouts where id='${P4}'`);
await partial("pi_f", 800);       // NO sweep here: the owner could act before the next sweep
const rec4 = await rpc(O, "hc_record_external_payment", { p_payout_id: P4, p_external_ref: "ACH-E4-0004", p_paid_on: new Date().toISOString().slice(0, 10), p_method: "bank transfer", p_confirm_external_payment: true });
const p4s = sql(`select status from payouts where id='${P4}'`);
check("N-P4", "partial refund flagged on a commission inside an APPROVED payout (no sweep yet): the owner cannot record the payment", "DB via PostgREST", "approved first; record refused; payout not paid", `status before=${wasApproved}; record=${JSON.stringify(rec4.data ?? rec4.error?.message)}; payout after=${p4s}; commission=${st("pi_f")}`, wasApproved === "approved" && p4s !== "paid" && (rec4.error || rec4.data?.status !== "paid_recorded"));
const bl = sql("select count(*) from commissions where state='paid' and source_provider_transaction_id in ('pi_c','pi_e','pi_f','pi_b')");
check("N-P5", "none of the refunded/disputed-lost/partial-refund-held commissions was ever paid", "DB", "0 paid among pi_b/pi_c/pi_e/pi_f", `paid=${bl}`, bl === "0");
summary();
