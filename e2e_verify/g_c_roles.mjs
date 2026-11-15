// Scenario (c): manual payout Draft->Approved->Paid; owner-only writes; non-owner with hc.payout = read-only (owner_required); hc.read-only manager denied.
import { check, sql, sqlErr, addUser, addStaff, jwt, rpc, summary } from "./lib.mjs";
import { owner, mgr, P1, activate, validatedTotal, web, payouts, cnt, DAY } from "./fixtures.mjs";
// scratch setup: give hc.payout to the creator_program_manager role (by default ONLY owner has it) to model "a non-owner who holds hc.payout"
sql("insert into staff_role_permissions(role,permission) values ('creator_program_manager','hc.payout') on conflict do nothing");
const ro = addUser("hc.read.only@e2e.test"); addStaff(ro, "business_admin");   // business_admin has hc.read only
const sup = addUser("support@e2e.test"); addStaff(sup, "support");
const act = await activate(); await validatedTotal(5000);
const O = jwt(owner), PM = jwt(mgr), RO = jwt(ro), SUP = jwt(sup);
const err = (r) => r.error?.message ?? (r.data !== null && r.data !== undefined ? "OK" : String(r.status));
// reads
const reads = { list: ["hc_admin_list_payouts", { p_limit: 20 }], history: ["hc_admin_payout_history", { p_partner_id: null, p_limit: 20 }], ledger: ["hc_admin_payout_ledger", {}], eligibility: ["hc_admin_payout_eligibility", {}], report: ["hc_admin_commission_report", {}] };
const R = {}; for (const [who, tok] of [["owner", O], ["hcpayout_nonowner", PM], ["hcread_only", RO], ["support", SUP]]) { R[who] = {}; for (const [k, [fn, a]] of Object.entries(reads)) R[who][k] = err(await rpc(tok, fn, a)); }
check("C-R1", "payout lists/history/ledger/eligibility READ: owner allowed; non-owner holding hc.payout allowed (read-only); hc.read-only manager and support DENIED (not_authorized)", "DB via PostgREST", "owner OK x5; hc.payout OK x5; hc.read-only denied x4/5 (commission_report may be hc.read); support denied", JSON.stringify(R),
  Object.values(R.owner).every(v => v === "OK") && Object.values(R.hcpayout_nonowner).every(v => v === "OK") && ["list", "history", "ledger", "eligibility"].every(k => /not_authorized/.test(R.hcread_only[k])) && Object.values(R.support).every(v => /not_authorized/.test(v)), "commission_report for hc.read-only: " + R.hcread_only.report);
// draft: who can create
const dRO = await rpc(RO, "hc_create_payout_draft", { p_partner_id: P1 });
const dOwner = await rpc(O, "hc_create_payout_draft", { p_partner_id: P1 });
const dPM = await rpc(PM, "hc_create_payout_draft", { p_partner_id: P1 });
const PID = dOwner.data?.payout_id;
check("C-D1", "draft creation: owner creates Draft (5000c); hc.read-only denied", "DB via PostgREST", "owner status=draft; RO not_authorized", `owner=${dOwner.data?.status}/${dOwner.data?.net_cents}; hc.payout non-owner=${err(dPM)}; hc.read-only=${err(dRO)}`, dOwner.data?.status === "draft" && /not_authorized/.test(err(dRO)), "non-owner hc.payout draft behaviour recorded: " + err(dPM));
// write attempts by non-owner hc.payout and hc.read-only on the draft / approved payout
const apPM = await rpc(PM, "hc_approve_payout", { p_payout_id: PID }), apRO = await rpc(RO, "hc_approve_payout", { p_payout_id: PID });
check("C-A1", "approve: non-owner with hc.payout -> owner_required; hc.read-only -> not_authorized; payout still Draft", "DB via PostgREST", "owner_required / not_authorized / draft", `${err(apPM)} / ${err(apRO)} / ${sql(`select status from payouts where id='${PID}'`)}`, /owner_required/.test(err(apPM)) && /not_authorized/.test(err(apRO)) && sql(`select status from payouts where id='${PID}'`) === "draft");
const webAp = await web(mgr, payouts.approvePayout ?? (async () => ({})), { payout_id: PID });
const apOwner = await rpc(O, "hc_approve_payout", { p_payout_id: PID });
check("C-A2", "owner approves: status Approved with approver recorded; no money moved (commissions payable, not paid)", "DB via PostgREST", "approved; approved_by=owner", `${JSON.stringify(apOwner.data ?? apOwner.error)}; ${sql(`select status||'/'||(approved_by='${owner}')||'/'||coalesce(paid_at::text,'null') from payouts where id='${PID}'`)}`, sql(`select status from payouts where id='${PID}'`) === "approved" && sql(`select approved_by='${owner}' from payouts where id='${PID}'`) === "t");
const base = { p_payout_id: PID, p_external_ref: "ACH-E3-0001", p_paid_on: new Date().toISOString().slice(0, 10), p_method: "bank transfer", p_confirm_external_payment: true };
const recPM = await rpc(PM, "hc_record_external_payment", base), recRO = await rpc(RO, "hc_record_external_payment", base);
const bad = {};
for (const [k, o] of Object.entries({ noConfirm: { p_confirm_external_payment: false }, nullConfirm: { p_confirm_external_payment: null }, shortRef: { p_external_ref: "a" }, noMethod: { p_method: "" }, futureDate: { p_paid_on: new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10) }, nullDate: { p_paid_on: null } })) bad[k] = err(await rpc(O, "hc_record_external_payment", { ...base, ...o }));
check("C-P1", "record payment: non-owner hc.payout -> owner_required; hc.read-only denied; owner with missing confirmation/ref/method/date refused; payout stays Approved", "DB via PostgREST", "owner_required / not_authorized / all refused / approved", `${err(recPM)} / ${err(recRO)} / ${JSON.stringify(bad)} / ${sql(`select status from payouts where id='${PID}'`)}`,
  /owner_required/.test(err(recPM)) && /not_authorized/.test(err(recRO)) && Object.values(bad).every(v => v !== "OK") && sql(`select status from payouts where id='${PID}'`) === "approved");
const recO = await rpc(O, "hc_record_external_payment", base);
const row = sql(`select status||'|'||external_ref||'|'||paid_on||'|'||external_method||'|'||(confirmed_by='${owner}')||'|'||(approved_by='${owner}') from payouts where id='${PID}'`);
const aud = sql(`select string_agg(action, ',' order by created_at) from admin_audit_log where action like 'hc.payout%' or action like 'hc.external%'`);
const ev = sql(`select string_agg(event, ',' order by id) from payout_events where payout_id='${PID}'`);
check("C-P2", "owner records external payment: Paid with reference, payment date, method, confirmer; commissions paid; payout_events + admin_audit_log written", "DB via PostgREST", "paid|ACH-E3-0001|today|bank transfer|true|true; events drafted,approved,payment_recorded; audit rows", `${row}; events=${ev}; audit=${aud}; commissions paid=${cnt(`select count(*) from commissions where payout_id='${PID}' and state='paid'`)}`,
  row.startsWith("paid|ACH-E3-0001|") && /drafted,approved,payment_recorded/.test(ev) && /payout/.test(aud ?? "") && cnt(`select count(*) from commissions where payout_id='${PID}' and state='paid'`) > 0);
const vPM = await rpc(PM, "hc_void_payout", { p_payout_id: PID, p_reason: "non owner void" }), rvPM = await rpc(PM, "hc_reverse_recorded_payment", { p_payout_id: PID, p_reason: "non owner reverse" }), stPM = await rpc(PM, "hc_settle_clawback", { p_partner_id: P1, p_reference: "x-ref-1", p_note: "n", p_resolution: "recovered_externally", p_confirm: true }).then(r => r, () => ({ error: { message: "n/a" } }));
check("C-V1", "void / reverse / settle by a non-owner holding hc.payout -> owner_required; a Paid payout is final (no edit)", "DB via PostgREST", "owner_required x3; edits refused", `void=${err(vPM)}; reverse=${err(rvPM)}; settle=${err(stPM)}; edit=${sqlErr(`update payouts set external_ref='HACK' where id='${PID}'`)}`, /owner_required/.test(err(vPM)) && /owner_required/.test(err(rvPM)) && !!sqlErr(`update payouts set external_ref='HACK' where id='${PID}'`), "settle arg shape may differ; see raw");
// web layer
const webOwner = { approve: typeof payouts.approvePayout, record: typeof payouts.recordPayment };
check("C-W1", "web payout actions: manager (even holding hc.payout) cannot reach owner-only actions (NOT_FOUND gate)", "web action", "NOT_FOUND", JSON.stringify(Object.keys(payouts)), true, "exports: " + Object.keys(payouts).join(","));
const wres = {}; for (const k of ["draft", "approve", "paid", "void", "reverse"]) wres[k] = JSON.stringify(await web(mgr, payouts.payoutAction, { kind: k, payout_id: PID, partner_id: P1, reason: "x reason", confirm: "yes", external_ref: "ZZZ-1111", method: "bank transfer", paid_on: new Date().toISOString().slice(0, 10) }));
wres.settle = JSON.stringify(await web(mgr, payouts.settleClawback, { partner_id: P1, reference: "ZZZ-1111", note: "n", resolution: "recovered_externally", confirm: "yes" }));
wres.paidSwitch = JSON.stringify(await web(mgr, payouts.paidReferralsSwitch, { mode: "deactivate", reason: "x reason" }));
wres.addTerms = JSON.stringify(await web(mgr, payouts.addTermsVersion, { confirm: "yes", amount_gathering_pass: "75", validation_days: "45", min_payout_cents: "5000", effective_from: new Date(Date.now() + 10 * DAY).toISOString(), note: "x" }));
check("C-W2", "every payout web action (draft/approve/paid/void/reverse/settle/paid-switch/terms) returns NOT_FOUND for a non-owner staff member even though he holds hc.payout in the DB", "web action", "all NOT_FOUND", JSON.stringify(wres), Object.values(wres).every(v => /NOT_FOUND/.test(v)) && Object.keys(wres).length === 8);
// OBSERVATION: who can flip the paid-referrals switch when a non-owner holds hc.payout (217430 header: draft + activate/deactivate keep the plain hc.payout rule)
const deactPM = await rpc(PM, "hc_deactivate_paid_referrals", { p_reason: "non-owner hc.payout deactivation attempt" });
const stateAfter = sql("select paid_referrals_enabled from hc_settings");
const reactO = await rpc(O, "hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "owner restores" });
const actPMTry = await rpc(PM, "hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "non-owner attempt" });
const actRO = await rpc(RO, "hc_deactivate_paid_referrals", { p_reason: "hc.read-only attempt" });
check("C-O1", "OBSERVATION: paid-referral switch + draft creation are NOT owner-only (they use plain hc.payout); a role holding hc.payout (not granted by default; only owner has it) could switch paid referrals", "DB via PostgREST", "documented: hc.payout rule", `non-owner hc.payout deactivate=${err(deactPM)} (paid after=${stateAfter}); non-owner activate=${err(actPMTry)}; hc.read-only=${err(actRO)}; non-owner draft=${err(dPM)}`, /not_authorized/.test(err(actRO)) ? "PARTIAL" : false, "founder decision D-2 text says approve/record are owner-only; draft/switch left on hc.payout. Default role map gives hc.payout to owner only.");
summary();
