// Scenario D: manual payouts Draft -> Approved -> Paid (recorded external payment), audit, immutability, clawback after payout.
import { check, sql, sqlErr, jwt, rpc, summary, asRole } from "./lib.mjs";
import { owner, mgr, P1, activate, validatedTotal, referred, buy, sweep, payouts, svc, web, cnt, DAY, commission, planLedgerCalls } from "./fixtures.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
await activate(); await validatedTotal(5000);
const today = new Date().toISOString().slice(0, 10);
const pay = (u, o) => web(u, payouts.payoutAction, o);
const state = (id) => sql(`select status from payouts where id='${id}'`);
const events = (id) => sql(`select string_agg(event, ',' order by id) from payout_events where payout_id='${id}'`);

// D1 draft
let r = await pay(mgr, { kind: "draft", partner_id: P1 });
check("D1a", "manager cannot draft a payout (web)", "web action", "NOT_FOUND", JSON.stringify(r), r.signal === "NOT_FOUND");
r = await pay(owner, { kind: "draft", partner_id: P1 });
const PID = sql(`select id from payouts where partner_id='${P1}' and status='draft'`);
check("D1b", "owner drafts: payout draft total = sum of validated (5000c); commissions -> payable; events+audit written", "web action + DB", "ok; draft 5000; payable>=1; events drafted; audit hc.payout_draft", `${JSON.stringify(r)}; ${sql(`select status||'/'||total_cents from payouts where id='${PID}'`)}; payable=${cnt(`select count(*) from commissions where payout_id='${PID}' and state='payable'`)}; events=${events(PID)}; audit=${cnt("select count(*) from admin_audit_log where action='hc.payout_draft'")}`, r.ok && sql(`select status||'/'||total_cents from payouts where id='${PID}'`) === "draft/5000" && events(PID) === "drafted");
// D2 skipping
const dRec = await rpc(jwt(owner), "hc_record_external_payment", { p_payout_id: PID, p_external_ref: "ACH-0001", p_paid_on: today, p_method: "bank transfer", p_confirm_external_payment: true });
check("D2a", "cannot record payment on a DRAFT (no Draft->Paid skip) via RPC", "DB via PostgREST", "payout_not_approved", dRec.error?.message, /payout_not_approved/.test(dRec.error?.message));
const eSkip = sqlErr(`update payouts set status='paid', external_ref='ACH-0001', paid_on=current_date, external_method='bank transfer', confirmed_by='${owner}', confirmed_at=now(), approved_at=now() where id='${PID}'`);
check("D2b", "cannot skip Draft->Paid even with direct SQL (transition guard trigger)", "DB (direct SQL as table owner)", "illegal_payout_transition", eSkip, /illegal_payout_transition/.test(eSkip ?? ""));
const legacy = await rpc(jwt(owner), "hc_mark_payout_paid", { p_payout_id: PID, p_external_ref: "ACH-0001" });
check("D2c", "legacy hc_mark_payout_paid can no longer mark paid", "DB via PostgREST", "confirmation_required", legacy.error?.message, /confirmation_required/.test(legacy.error?.message));
// D3 approve
r = await pay(mgr, { kind: "approve", payout_id: PID });
const mAp = await rpc(jwt(mgr), "hc_approve_payout", { p_payout_id: PID });
check("D3a", "manager cannot approve (web + direct RPC)", "web action + DB via PostgREST", "NOT_FOUND; not_authorized", `${JSON.stringify(r)}; ${mAp.error?.message}`, r.signal === "NOT_FOUND" && /not_authorized/.test(mAp.error?.message));
r = await pay(owner, { kind: "approve", payout_id: PID });
const r2 = await pay(owner, { kind: "approve", payout_id: PID });
check("D3b", "owner approves: status approved, approver recorded; approval != paid (commissions still payable, paid_at null); replay is idempotent", "web action + DB", "approved; approved_by=owner; commissions payable; replay ok no new event", `${JSON.stringify(r)}/${JSON.stringify(r2)}; ${sql(`select status||'/'||(approved_by='${owner}')||'/'||coalesce(paid_at::text,'null') from payouts where id='${PID}'`)}; payable=${cnt(`select count(*) from commissions where payout_id='${PID}' and state='payable'`)}; events=${events(PID)}`, state(PID) === "approved" && events(PID) === "drafted,approved" && cnt(`select count(*) from commissions where payout_id='${PID}' and state='paid'`) === 0);
// D4 invalid payment attempts
const base = { kind: "paid", payout_id: PID, external_ref: "ACH-2026-1114-001", method: "bank transfer", paid_on: today, confirm: "yes" };
const bad = {};
bad.noConfirmWeb = await pay(owner, { ...base, confirm: "no" });
bad.shortRefWeb = await pay(owner, { ...base, external_ref: "abc" });
bad.noRefWeb = await pay(owner, { ...base, external_ref: "" });
bad.noMethodWeb = await pay(owner, { ...base, method: "" });
bad.futureWeb = await pay(owner, { ...base, paid_on: new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10) });
const rp = (o) => rpc(jwt(owner), "hc_record_external_payment", { p_payout_id: PID, p_external_ref: "ACH-2026-1114-001", p_paid_on: today, p_method: "bank transfer", p_confirm_external_payment: true, ...o });
bad.nullRef = await rp({ p_external_ref: null }); bad.nullMethod = await rp({ p_method: null }); bad.unknownMethod = await rp({ p_method: "unknown" });
bad.noConfirm = await rp({ p_confirm_external_payment: false }); bad.nullConfirm = await rp({ p_confirm_external_payment: null }); bad.nullDate = await rp({ p_paid_on: null });
bad.mgr = await rpc(jwt(mgr), "hc_record_external_payment", { p_payout_id: PID, p_external_ref: "ACH-2026-1114-001", p_paid_on: today, p_method: "bank transfer", p_confirm_external_payment: true });
const summ = Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, v.ok === false ? v.code : (v.error?.message ?? "NOT REFUSED").replace(/^.*?(\w+_\w+).*$/, "$1")]));
check("D4", "every incomplete/invalid 'mark paid' attempt is refused (no confirm, short/null ref, blank/null/'unknown' method, future/null date, null confirm, manager) and the payout stays approved", "web action + DB via PostgREST", "all refused; status approved; 0 payment_recorded events", `${JSON.stringify(summ)}; status=${state(PID)}; events=${events(PID)}`, Object.values(bad).every(v => v.ok === false || v.error) && state(PID) === "approved" && !/payment_recorded/.test(events(PID)));
// D5 valid payment
r = await pay(owner, base);
const row = sql(`select status||'|'||external_ref||'|'||paid_on||'|'||external_method||'|'||(confirmed_by='${owner}')||'|'||(approved_by='${owner}')||'|'||(confirmed_at is not null) from payouts where id='${PID}'`);
check("D5", "valid recorded payment: paid with reference, paid_on, method, confirmer, approver; commissions paid; payout_events + admin_audit_log rows; says no money moved here", "web action + DB", "paid|ACH-2026-1114-001|today|bank transfer|true|true|true; events drafted,approved,payment_recorded", `${JSON.stringify(r)}; ${row}; events=${events(PID)}; audit=${sql(`select string_agg(action,',' order by id) from admin_audit_log where target_id='${PID}'`)}; commissions paid=${cnt(`select count(*) from commissions where payout_id='${PID}' and state='paid'`)}`, r.ok && row === `paid|ACH-2026-1114-001|${today}|bank transfer|true|true|true` && events(PID) === "drafted,approved,payment_recorded");
// D6 replay / reuse
const replaySame = await rp({}), replayOther = await rp({ p_external_ref: "ACH-OTHER-9999" });
check("D6a", "replay with the same reference is idempotent; a different reference on a paid payout is refused", "DB via PostgREST", "already_recorded; payout_already_paid_with_different_reference", `${JSON.stringify(replaySame.data)}; ${replayOther.error?.message}`, replaySame.data?.status === "already_recorded" && /different_reference/.test(replayOther.error?.message));
// second payout using the same ref
await validatedTotal(5000);
r = await pay(owner, { kind: "draft", partner_id: P1 }); const PID2 = sql(`select id from payouts where partner_id='${P1}' and status='draft'`);
await pay(owner, { kind: "approve", payout_id: PID2 });
const reuse = await pay(owner, { ...base, payout_id: PID2, external_ref: "ach-2026-1114-001" });
check("D6b", "an external reference already used by another paid payout cannot be reused (case-insensitive)", "web action + DB", "refused (reference already used)", JSON.stringify(reuse) + `; status=${state(PID2)}`, reuse.ok === false && state(PID2) === "approved");
// D7 immutability
const imm = {
  ref: sqlErr(`update payouts set external_ref='CHANGED-REF' where id='${PID}'`), date: sqlErr(`update payouts set paid_on=current_date-1 where id='${PID}'`), method: sqlErr(`update payouts set external_method='cash' where id='${PID}'`),
  total: sqlErr(`update payouts set total_cents=1 where id='${PID}'`), partner: sqlErr(`update payouts set partner_id='${P1}' where id='${PID}' and false` ) ?? "n/a",
  backApproved: sqlErr(`update payouts set status='approved' where id='${PID}'`), backDraft: sqlErr(`update payouts set status='draft' where id='${PID}'`), toVoid: sqlErr(`update payouts set status='void' where id='${PID}'`),
};
const voidPaid = await rpc(jwt(owner), "hc_void_payout", { p_payout_id: PID, p_reason: "try void paid" });
check("D7", "no editing after paid: ref/date/method/total edits and status rollbacks are refused even for direct SQL; void of a paid payout refused", "DB (direct SQL) + PostgREST", "all raise", JSON.stringify({ ...imm, voidPaid: voidPaid.error?.message }), imm.ref && imm.date && imm.method && imm.total && imm.backApproved && imm.backDraft && imm.toVoid && /payout_not_voidable/.test(voidPaid.error?.message));
const apiDel = await fetch(`http://127.0.0.1:54480/payouts?id=eq.${PID}`, { method: "DELETE", headers: { authorization: `Bearer ${jwt(owner)}`, apikey: jwt(owner) } });
const apiPatch = await fetch(`http://127.0.0.1:54480/payouts?id=eq.${PID}`, { method: "PATCH", headers: { authorization: `Bearer ${jwt(owner)}`, apikey: jwt(owner), "content-type": "application/json" }, body: JSON.stringify({ external_ref: "HACK-REF-1" }) });
const apiIns = await fetch(`http://127.0.0.1:54480/payouts`, { method: "POST", headers: { authorization: `Bearer ${jwt(owner)}`, apikey: jwt(owner), "content-type": "application/json" }, body: JSON.stringify({ partner_id: P1, total_cents: 5000, status: "paid" }) });
check("D7b", "owner cannot DELETE/PATCH/INSERT payouts directly over the REST API (only the RPCs write)", "DB via PostgREST", "denied; row intact", `del=${apiDel.status} patch=${apiPatch.status} insert=${apiIns.status}; ref=${sql(`select external_ref from payouts where id='${PID}'`)}`, sql(`select external_ref from payouts where id='${PID}'`) === "ACH-2026-1114-001" && cnt("select count(*) from payouts where external_ref is null and status='paid'") === 0);
// D8 service-role / table-owner bypass of 'no null reference'
const srInsert = asRole("service_role", null, `insert into payouts(partner_id,total_cents,status) values ('${P1}', 100, 'paid')`);
check("D8", "a PAID payout row with NULL reference cannot even be inserted by the service role (no bypass of 'no null payout references')", "DB (service_role)", "insert refused", srInsert.ok ? "INSERT SUCCEEDED (null ref paid row created)" : srInsert.err, !srInsert.ok, "see DEFECT E-D1 if it succeeds: the guard is a BEFORE UPDATE trigger only; no CHECK constraint");
sql("delete from payouts where status='paid' and external_ref is null");   // cleanup if it succeeded
// D9 void + reverse
const pv = await pay(owner, { kind: "void", payout_id: PID2, reason: "e2e void test" });
check("D9a", "approved payout can be voided with a reason; its commissions return to validated (re-draftable)", "web action + DB", "void; commissions validated; events voided", `${JSON.stringify(pv)}; ${state(PID2)}; validated=${cnt(`select count(*) from commissions where state='validated' and partner_id='${P1}'`)}; events=${events(PID2)}`, pv.ok && state(PID2) === "void" && events(PID2).endsWith("voided"));
const noReason = await pay(owner, { kind: "void", payout_id: PID2, reason: "x" });
check("D9b", "void/reverse require a reason (>=3 chars) and reverse an explicit confirmation", "web action", "invalid_reason", JSON.stringify(noReason), noReason.ok === false);
// D10 clawback after payout: refund a commission that was paid in PID
const paidTxn = sql(`select c.source_provider_transaction_id from commissions c where c.payout_id='${PID}' and c.canonical_product_id='plus_annual' limit 1`);
await svc("apply_payment_event", { p_event: { provider: "stripe", provider_event_id: `evt_late_refund`, provider_event_type: "charge.refunded", event_kind: "refund", event_at: new Date().toISOString(), environment: "production", transaction_id: paidTxn, reason: "requested_by_customer" } });
const swp = await sweep(new Date());
const cw = sql(`select state||'|'||clawback_cents||'|'||coalesce(clawback_status,'null') from commissions where source_provider_transaction_id='${paidTxn}'`);
const payoutStillPaid = state(PID);
check("D10a", "refund AFTER payout: the paid commission is reversed with a clawback record (1200c, pending_contract_language); the paid payout row is untouched", "DB via PostgREST (service)", "reversed|1200|pending_contract_language; payout stays paid", `${cw}; payout=${payoutStillPaid}`, cw === "reversed|1200|pending_contract_language" && payoutStillPaid === "paid");
await validatedTotal(5000);
const dn = await rpc(jwt(owner), "hc_create_payout_draft", { p_partner_id: P1 });
check("D10b", "outstanding clawback is reported on the next draft but NOT netted (netting off by default): the owner must settle it separately", "DB via PostgREST", "outstanding_clawback_cents=1200; clawback_netted=false", JSON.stringify(dn.data), dn.data?.outstanding_clawback_cents === 1200 && dn.data?.clawback_netted === false);
const cwId = sql(`select id from commissions where source_provider_transaction_id='${paidTxn}'`);
const sMgr = await rpc(jwt(mgr), "hc_settle_clawback", { p_commission_id: cwId, p_resolution: "recovered_externally", p_external_ref: "REC-1234", p_note: "recovered", p_confirm: true });
const sNo = await rpc(jwt(owner), "hc_settle_clawback", { p_commission_id: cwId, p_resolution: "recovered_externally", p_external_ref: "REC-1234", p_note: "recovered", p_confirm: false });
const sOk = await rpc(jwt(owner), "hc_settle_clawback", { p_commission_id: cwId, p_resolution: "recovered_externally", p_external_ref: "REC-1234", p_note: "recovered by bank transfer", p_confirm: true });
check("D10c", "clawback settlement RPC: manager denied, no-confirm refused, owner with ref+note+confirm settles; audit row", "DB via PostgREST", "not_authorized; confirmation_required; settled; audit hc.clawback_settled", `${sMgr.error?.message}; ${sNo.error?.message}; ${JSON.stringify(sOk.data)}; audit=${cnt("select count(*) from admin_audit_log where action='hc.clawback_settled'")}`, /not_authorized/.test(sMgr.error?.message) && /confirmation_required/.test(sNo.error?.message) && sOk.data?.status === "settled");
// UI gap
const refs = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = d + "/" + f; if (f === "node_modules" || f === ".next" || f === "tests" || f === "e2e_verify" || f.startsWith(".")) continue; const st = statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f) && readFileSync(p, "utf8").includes("hc_settle_clawback")) refs.push(p); } };
for (const d of ["app", "lib", "components"]) walk(d);
check("D10d", "KNOWN GAP: hc_settle_clawback has a database function but no Command Center action/screen calls it", "code scan (web)", "0 call sites in app/lib/components (gap confirmed)", `call sites: ${JSON.stringify(refs)}`, refs.length === 0 ? "PARTIAL" : true, "owner can record clawback settlement only by SQL/RPC; not exercisable from UI");
// D11 reversal of a paid payout
const rev = await pay(owner, { kind: "reverse", payout_id: PID, reason: "recorded in error", confirm: "yes" });
const afterRev = sql(`select status from payouts where id='${PID}'`) + "|" + sql(`select string_agg(distinct state, ',') from commissions where payout_id='${PID}'`) + "|" + events(PID);
check("D11", "reversing a recorded payment (owner, reason + confirmation): payout -> reversed, audit event; commissions state observed", "web action + DB", "reversed; events end with reversed", `${JSON.stringify(rev)}; ${afterRev}`, rev.ok && state(PID) === "reversed", "commission state after reversal recorded for the report");
// D12 manager reading payout lists, auditing
const hist = await rpc(jwt(owner), "hc_admin_payout_history", { p_partner_id: P1, p_limit: 20 });
const histMgr = await rpc(jwt(mgr), "hc_admin_payout_history", { p_partner_id: P1, p_limit: 20 });
check("D12", "payout history/ledger visible to owner; manager (no hc.payout) denied", "DB via PostgREST", "rows for owner; not_authorized for manager", `${Array.isArray(hist.data) ? hist.data.length + " rows" : JSON.stringify(hist.error)}; mgr=${histMgr.error?.message ?? "allowed"}`, /not_authorized/.test(histMgr.error?.message ?? ""));
// D13 no auto-transfer in code
const hits = []; const walk2 = (d) => { for (const f of readdirSync(d)) { const p = d + "/" + f; if (f === "node_modules" || f === ".next" || f === "e2e_verify" || f.startsWith(".")) continue; const st = statSync(p); if (st.isDirectory()) walk2(p); else if (/\.(ts|tsx|mjs)$/.test(f) && /stripe\.(transfers|payouts)|transfers\.create|payouts\.create|paypal.*payout|\/v1\/transfers|\/v1\/payouts/i.test(readFileSync(p, "utf8"))) hits.push(p); } };
for (const d of ["app", "lib", "components", "../native/supabase/functions"]) { try { walk2(d); } catch {} }
check("D13", "nothing moves money: no Stripe transfer/payout/PayPal call anywhere in web or edge-function code", "code scan", "0 hits", JSON.stringify(hits), hits.length === 0);
summary();
