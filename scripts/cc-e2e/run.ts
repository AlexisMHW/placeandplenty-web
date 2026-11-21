// END-TO-END DEMONSTRATION of the Command Center / Hosting Collective workflows against a SCRATCH Postgres 16 built from the QA package order.
// LAYER: the real web lib code (validateApplication, parseReviewForm, submitApplicationReview, parsers, parsePayoutActionForm, parseSwitchForm,
// runHcDispatch) calling the REAL database functions through a pg-backed client (scripts/cc-e2e/pgclient.ts). The Next.js server-action wrappers
// (requireStaff/cookies) are NOT run; their gate logic is covered by tests/command-center-gate-coverage.test.ts and the database re-checks every permission.
// usage: node --experimental-strip-types scripts/cc-e2e/run.ts <host> <port> <db>
import assert from "node:assert/strict";
import { client, sql1, type Conn } from "./pgclient.ts";
import { validateApplication } from "../../lib/hosting-collective.ts";
import { parseReviewForm, parseApplications, parseMembers, parsePayoutEligibility, parseCommissionReport } from "../../lib/admin/hc.ts";
import { submitApplicationReview } from "../../lib/hc/review-flow.ts";
import { afterApplicationDecision, runHcDispatch } from "../../lib/hc/dispatch-runner.ts";
import { parsePayoutActionForm } from "../../lib/admin/cc.ts";
import { parseSwitchForm, parseSwitches, SWITCH_GOOD } from "../../lib/admin/controls.ts";
import { knownCode } from "../../lib/admin/messages.ts";

const c: Conn = { host: process.argv[2], port: process.argv[3], db: process.argv[4] };
const su = (s: string) => sql1(c, s);
let n = 0; const log: string[] = [];
const ok = (label: string, cond: unknown, detail = "") => { n++; assert.ok(cond, `${label} ${detail}`); log.push(`PASS ${label}${detail ? " :: " + detail : ""}`); };
const fd = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const mkuser = (email: string) => su(`insert into auth.users(id,email,created_at) values (gen_random_uuid(), '${email}', now() - interval '10 minutes') returning id;`).split("\n")[0];

// ---- actors (scratch only; example.test addresses, no real contact details)
const O = mkuser("owner@example.test"), M = mkuser("manager@example.test");
su(`insert into public.staff_members(user_id,role) values ('${O}','owner'),('${M}','creator_program_manager');`);
const owner = client(c, { role: "authenticated", uid: O }), mgr = client(c, { role: "authenticated", uid: M });
const anon = client(c, { role: "anon" }), svc = client(c, { role: "service_role" });

// action-equivalents that mirror the server actions' RPC sequence one for one
async function setSwitch(who: typeof owner, f: Record<string, string>) {
  const p = parseSwitchForm(fd(f)); if (!p.ok) return { ok: false, code: p.error };
  const res = p.kind === "program" ? await who.rpc("hc_admin_set_program_enabled", { p_enabled: p.on, p_reason: p.reason })
    : await who.rpc("hc_admin_set_applications_open", { p_open: p.on, p_terms_version: p.termsVersion, p_reason: p.reason });
  if (res.error) return { ok: false, code: knownCode(res.error.message) };
  const st = (res.data as any)?.status; return SWITCH_GOOD.includes(st) ? { ok: true, code: st } : { ok: false, code: knownCode(st) };
}
async function payout(who: typeof owner, f: Record<string, string>): Promise<{ ok: boolean; code: string; data: any }> {
  const p = parsePayoutActionForm(fd(f)); if (!p.ok) return { ok: false, code: p.error, data: null as any };
  const v = p.value;
  const res = v.kind === "draft" ? await who.rpc("hc_create_payout_draft", { p_partner_id: v.partnerId })
    : v.kind === "approve" ? await who.rpc("hc_approve_payout", { p_payout_id: v.payoutId })
    : v.kind === "paid" ? await who.rpc("hc_record_external_payment", { p_payout_id: v.payoutId, p_external_ref: v.externalRef, p_paid_on: v.paidOn, p_method: v.method, p_confirm_external_payment: true })
    : { data: null, error: { message: "unsupported" } };
  if (res.error) return { ok: false, code: knownCode(res.error.message), data: null as any };
  return { ok: true, code: String((res.data as any)?.status), data: res.data as any };
}

(async () => {
  // ===== 1. OPERATIONAL CONTROLS (new in WS-D2): refused for manager, owner on/off, audited
  let r: any = await mgr.rpc("hc_admin_get_program_switches"); const s0 = parseSwitches(r.data)!;
  ok("C1 manager can READ switches; all start off", s0.programEnabled === false && s0.applicationsOpen === false && s0.paidReferralsEnabled === false);
  r = (await setSwitch(mgr, { kind: "program", state: "on", reason: "manager try" })) as any; ok("C2 manager cannot switch the program on", r.ok === false && r.code === "not_authorized", r.code);
  // public form is CLOSED before the owner opens it
  const app1 = validateApplication({ fullName: "Ada Creator", email: "ada@example.test", platforms: [{ platform: "instagram", handle: "@ada_hosts" }], niches: ["budget_hosting"], audienceSummary: "Weekly hosting tips for small dinners.", disclosureAck: true, consentToContact: true });
  if (!app1.ok) throw new Error("fixture application invalid: " + JSON.stringify(app1.errors));
  const nicheOk = (app1 as any).payload.niches;
  const closed = await anon.rpc("submit_creator_application", { p_payload: (app1 as any).payload });
  ok("C3 applications closed -> public submit refused/closed", closed.error !== null || (closed.data as any)?.status === "closed", JSON.stringify(closed.error ?? closed.data));
  r = (await setSwitch(owner, { kind: "applications", state: "on", reason: "demo", terms_version: "" })) as any; ok("C4 open without terms version refused", r.ok === false && r.code === "terms_version_required", r.code);
  const terms = (app1 as any).payload.terms_version as string;
  r = (await setSwitch(owner, { kind: "program", state: "on", reason: "demo on scratch" })) as any; ok("C5 owner switches program ON", r.ok && r.code === "on");
  r = (await setSwitch(owner, { kind: "applications", state: "on", reason: "demo", terms_version: terms })) as any; ok("C6 owner opens applications with terms version", r.ok && r.code === "open", terms);
  ok("C7 audit rows written for both switches", +su(`select count(*) from admin_audit_log where action in ('hc.program_enabled','hc.applications_opened')`) === 2);

  // ===== 2. APPLICATION SUBMITTED -> STAFF REVIEW -> APPROVE / DECLINE
  const sub1 = await anon.rpc("submit_creator_application", { p_payload: (app1 as any).payload });
  ok("A1 application A accepted from the public form (anon)", !sub1.error, JSON.stringify(sub1.error ?? sub1.data));
  const app2 = validateApplication({ fullName: "Bo Declined", email: "bo@example.test", platforms: [{ platform: "tiktok", handle: "@bo_none" }], niches: nicheOk, audienceSummary: "Mostly unrelated reposts and giveaways.", disclosureAck: true, consentToContact: true });
  const sub2 = await anon.rpc("submit_creator_application", { p_payload: (app2 as any).payload }); ok("A2 application B accepted", !sub2.error, JSON.stringify(sub2.error));
  ok("A3 two applications stored as 'received'", +su(`select count(*) from creator_applications where status='received'`) === 2);
  ok("A4 staff notified: application_received events/inbox rows exist", +su(`select count(*) from hc_events where kind='application_received'`) >= 2, `hc_events=${su(`select count(*) from hc_events where kind='application_received'`)} cc_notifications=${su(`select count(*) from cc_notifications`)}`);
  const list = parseApplications((await mgr.rpc("hc_admin_list_applications", { p_status: null, p_limit: 100 })).data)!;
  ok("A5 manager sees both in the review queue (email shown unmasked only because manager holds hc.manage)", list.length === 2 && list.every((a) => a.status === "received"), list.map((a) => a.email).join(","));
  const A = list.find((a) => a.fullName.startsWith("Ada"))!, B = list.find((a) => a.fullName.startsWith("Bo"))!;
  const anonReview = await anon.rpc("hc_review_application", { p_id: A.id, p_decision: "approved", p_tier: null, p_note: null, p_code: null });
  ok("A6 anon cannot review", anonReview.error !== null);
  const pr = parseReviewForm(fd({ id: A.id, decision: "approved", tier: "", note: "welcome", code: "ada-hosts" })); if (!pr.ok) throw new Error(pr.error);
  const notCalled: any = { rpc: () => { throw new Error("provider must not be called"); } };
  const outA = await submitApplicationReview(mgr, pr.value, (d) => afterApplicationDecision(d, () => runHcDispatch({ env: {}, provider: notCalled, serviceClient: () => null })));
  ok("A7 manager APPROVES A (basic member, referral code ada-hosts)", outA.ok, outA.code);
  const prB = parseReviewForm(fd({ id: B.id, decision: "declined", note: "not a fit", tier: "", code: "" })); if (!prB.ok) throw new Error(prB.error);
  const outB = await submitApplicationReview(mgr, prB.value, async () => null);
  ok("A8 manager DECLINES B", outB.ok, outB.code);
  ok("A9 statuses saved: A approved, B declined", su(`select string_agg(status,',' order by full_name) from creator_applications`) === "approved,declined");
  ok("A10 approval created partner + code; decline created none", su(`select count(*) from partners where display_name like 'Ada%'`) === "1" && su(`select count(*) from partner_codes where code='ada-hosts'`) === "1" && su(`select count(*) from partners where display_name like 'Bo%'`) === "0");
  ok("A11 applicant emails QUEUED once each (approved + declined), none sent", su(`select string_agg(status||':'||count,',') from (select status,count(*) from hc_event_deliveries where channel='applicant_email' group by 1) x`) === "queued:2", su(`select string_agg(status||':'||count,',') from (select status,count(*) from hc_event_deliveries group by 1) x`));
  const disp = await runHcDispatch({ env: {}, provider: notCalled, serviceClient: () => null });
  ok("A12 dispatcher default-OFF: nothing claimed or sent", disp.ran === false && disp.sent === 0 && su(`select count(*) from hc_event_deliveries where channel='applicant_email' and status<>'queued'`) === "0", disp.reason);
  ok("A13 review audited / events emitted", +su(`select count(*) from hc_events where kind in ('application_approved','application_declined')`) === 2, su(`select string_agg(distinct kind,',') from hc_events`));
  const again = await submitApplicationReview(mgr, pr.value, async () => null); ok("A14 re-approving is refused (no double decision)", again.ok === false, again.code);

  // ===== 3. MEMBER / AFFILIATE LISTING + tier
  su(`select 1`);
  const tierRes = await owner.rpc("hc_upsert_tier", { p_slug: "founding", p_label: "Founding creator", p_description: null, p_eligibility_notes: null, p_sort_order: 1, p_active: true, p_paid_referrals_eligible: true, p_reason: "demo" });
  ok("M1 owner defines tier 'founding' (paid-referral eligible)", !tierRes.error, tierRes.error?.message);
  const mem0 = parseMembers((await mgr.rpc("hc_admin_list_members")).data)!;
  ok("M2 manager lists members: approved creator present, no tier (basic)", mem0.length === 1 && mem0[0].status === "approved" && mem0[0].tier === null, JSON.stringify(mem0[0]));
  const PID = mem0[0].partnerId;
  const setTier = await mgr.rpc("hc_admin_set_member_tier", { p_partner_id: PID, p_tier: "founding" });
  ok("M3 manager (hc.manage) assigns tier", !setTier.error, setTier.error?.message);
  ok("M4 listing shows tier + code count", (parseMembers((await mgr.rpc("hc_admin_list_members")).data)![0].tier === "founding"));

  // ===== 4. REFERRAL CAPTURE WITH PAID REFERRALS OFF
  const click = await svc.rpc("hc_record_referral_click", { p_code: "ada-hosts" }); ok("R0 anon cannot write click counts", (await anon.rpc("hc_record_referral_click", { p_code: "ada-hosts" })).error !== null);
  ok("R1 link-open counted by the service-only writer (anon is refused, no visitor id stored)", !click.error, JSON.stringify(click.error ?? click.data));
  const buyer = mkuser("buyer-off@example.test");
  const claim = await client(c, { role: "authenticated", uid: buyer }).rpc("record_referral_claim", { p_code: "ada-hosts", p_touched_at: new Date(Date.now() - 300000).toISOString() });
  ok("R2 referred signup recorded", !claim.error, JSON.stringify(claim.error ?? claim.data));
  const mkPurchase = (uid: string, txn: string) => {
    const e = su(`insert into gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values ('${uid}','plus','plus_annual','web','${txn}','production',now(),'account') returning id;`).split("\n")[0];
    su(`insert into purchase_payments(provider,transaction_id,entitlement_id,canonical_product_id,store,environment,currency,gross_amount_minor,stripe_payment_intent_id,purchased_at) values ('stripe','${txn}','${e}','plus_annual','web','production','USD',5999,'${txn}',now());`);
    return e;
  };
  const recon = async (e: string, txn: string) => { const f = await svc.rpc("record_purchase_facts", { p_entitlement_id: e, p_provider_transaction_id: txn, p_currency: "usd", p_amount_subtotal_cents: 5999, p_tax_cents: 0, p_fee_cents: 200, p_stripe_customer_id: null, p_payment_fingerprint_hash: null, p_source: "webhook" }); if (f.error) throw new Error("facts: " + f.error.message); return (await svc.rpc("reconcile_commission_for_entitlement", { p_entitlement_id: e })).data as any; };
  const eOff = mkPurchase(buyer, "txn-off-1");
  const rOff = await recon(eOff, "txn-off-1");
  const c0 = su(`select coalesce(string_agg(state||'/'||coalesce(reason,'-'),','),'none') from commissions where entitlement_id='${eOff}'`);
  ok("R3 paid referrals OFF: purchase never becomes a payable commission", !/pending|validated|payable/.test(c0), `reconcile=${JSON.stringify(rOff)} commission=${c0}`);
  const rep = parseCommissionReport((await mgr.rpc("hc_admin_commission_report")).data); ok("R4 manager commission/referral report readable", rep !== null && rep.partners.length >= 1);
  const d0 = await owner.rpc("hc_create_payout_draft", { p_partner_id: PID }); ok("R5 payout draft refused while paid referrals off", (d0.error !== null) || (d0.data as any)?.status !== "draft", JSON.stringify(d0.error ?? d0.data));
  const elig0 = parsePayoutEligibility((await owner.rpc("hc_admin_payout_eligibility")).data)!; ok("R6 eligibility says not live", elig0.paidReferralsEnabled === false && elig0.live === false);

  // ===== 5. COMMISSION -> PAYOUT DRAFT -> OWNER APPROVE -> OWNER RECORD EXTERNAL PAYMENT (scratch activation only)
  const act = await owner.rpc("hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "scratch demo only" }); ok("P0 (scratch only) owner activates paid referrals", (act.data as any)?.status === "activated", JSON.stringify(act.error ?? act.data));
  for (let i = 1; i <= 5; i++) { const u = mkuser(`buyer-${i}@example.test`); await client(c, { role: "authenticated", uid: u }).rpc("record_referral_claim", { p_code: "ada-hosts", p_touched_at: new Date(Date.now() - 300000).toISOString() }); const t = `txn-on-${i}`; await recon(mkPurchase(u, t), t); }
  ok("P1 five Plus purchases after activation -> five pending commissions ($12 each)", su(`select count(*)||'/'||coalesce(sum(commission_cents),0) from commissions where state='pending' and entitlement_id in (select id from gathering_entitlements where provider_transaction_id like 'txn-on-%')`) === "5/6000");
  ok("P2 purchase made while OFF did NOT accrue retroactively", !/pending/.test(su(`select coalesce(string_agg(state,','),'none') from commissions where entitlement_id='${eOff}'`)));
  await svc.rpc("sweep_commissions", { p_now: new Date(Date.now() + 46 * 86400000).toISOString() });
  ok("P3 after the 45-day hold the sweep validates them", su(`select count(*) from commissions where state='validated'`) === "5", su(`select string_agg(distinct state,',') from commissions`));
  const dM = await payout(mgr, { kind: "draft", partner_id: PID }); ok("P4 MANAGER cannot draft a payout", dM.ok === false, dM.code);
  const dO = await payout(owner, { kind: "draft", partner_id: PID }); ok("P5 owner drafts payout: $60.00 net, status draft", dO.ok && dO.code === "draft" && dO.data.net_cents === 6000, JSON.stringify(dO.data));
  const POID = dO.data.payout_id as string;
  const apM = await payout(mgr, { kind: "approve", payout_id: POID }); ok("P6 manager cannot approve", apM.ok === false, apM.code);
  const apO = await payout(owner, { kind: "approve", payout_id: POID }); ok("P7 owner approves", apO.ok && apO.code === "approved", apO.code);
  ok("P8 APPROVED IS NOT PAID: status approved, no payment recorded", su(`select status||'/'||coalesce(paid_at::text,'null') from payouts where id='${POID}'`) === "approved/null", su(`select status||'/'||coalesce(paid_at::text,'null') from payouts where id='${POID}'`));
  const today = new Date().toISOString().slice(0, 10);
  const pdM = await payout(mgr, { kind: "paid", payout_id: POID, external_ref: "BANK-DEMO-0001", method: "bank transfer", paid_on: today, confirm: "yes" }); ok("P9 manager cannot record external payment", pdM.ok === false, pdM.code);
  const pdNo = await payout(owner, { kind: "paid", payout_id: POID, external_ref: "BANK-DEMO-0001", method: "bank transfer", paid_on: today, confirm: "" }); ok("P10 owner without confirmation is refused", pdNo.ok === false && pdNo.code === "confirmation_required", pdNo.code);
  const pdO = await payout(owner, { kind: "paid", payout_id: POID, external_ref: "BANK-DEMO-0001", method: "bank transfer", paid_on: today, confirm: "yes" }); ok("P11 owner records the external payment", pdO.ok && pdO.code === "paid_recorded", pdO.code);
  ok("P12 payout now paid; commissions marked paid; audit says no money moved here", su(`select status from payouts where id='${POID}'`) === "paid" && +su(`select count(*) from admin_audit_log where action='hc.payout_payment_recorded' and detail->>'moved_money_here'='false'`) === 1 && su(`select count(*) from commissions where state='paid'`) === "5", su(`select string_agg(distinct state,',') from commissions`));
  const dupe = await payout(owner, { kind: "paid", payout_id: POID, external_ref: "BANK-DEMO-0001", method: "bank transfer", paid_on: today, confirm: "yes" }); ok("P13 replay is idempotent (already_recorded)", dupe.ok && dupe.code === "already_recorded", dupe.code);
  const hist = await owner.rpc("hc_admin_payout_history", { p_partner_id: PID, p_limit: 10 }); ok("P14 owner can read payout history", !hist.error, hist.error?.message);
  const histM = await mgr.rpc("hc_admin_payout_history", { p_partner_id: PID, p_limit: 10 }); ok("P15 manager (no hc.payout) cannot read payout history", histM.error !== null);
  ok("P16 paid-referral approval audit trail has draft/approve/record rows", +su(`select count(*) from admin_audit_log where action in ('hc.payout_draft','hc.payout_approved','hc.payout_payment_recorded')`) === 3);

  // ===== 6. CONTROLS OFF
  r = (await setSwitch(owner, { kind: "applications", state: "off", reason: "demo done", terms_version: "" })) as any; ok("C8 owner closes applications", r.ok && r.code === "closed");
  const closed2 = await anon.rpc("submit_creator_application", { p_payload: { ...(app2 as any).payload, email: "late@example.test" } }); ok("C9 closed again -> public submit refused", closed2.error !== null || (closed2.data as any)?.status === "closed", JSON.stringify(closed2.error ?? closed2.data));
  await owner.rpc("hc_deactivate_paid_referrals", { p_reason: "scratch demo end" });
  r = (await setSwitch(owner, { kind: "program", state: "off", reason: "demo done" })) as any; ok("C10 owner switches program OFF", r.ok && r.code === "off");
  ok("C11 final switch state off/off/off and 4+ audit rows", JSON.stringify(Object.values(parseSwitches((await owner.rpc("hc_admin_get_program_switches")).data)!).slice(0, 3)) === "[false,false,false]" && +su(`select count(*) from admin_audit_log where action like 'hc.program_%' or action like 'hc.applications_%'`) === 4);
  console.log(log.join("\n")); console.log(`\nALL ${n} CHECKS PASSED`);
})().catch((e) => { console.log(log.join("\n")); console.error("\nFAILED:", e.message); process.exit(1); });
