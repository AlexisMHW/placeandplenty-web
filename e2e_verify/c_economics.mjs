// Scenario C: affiliate economics end to end. Purchases go through the REAL payment ledger (apply_payment_event, service role) and
// the REAL web ledger planner (lib/hc/ledger.ts planLedgerCalls) whose calls are executed over PostgREST as the service role.
// NOTE: nothing in the repo executes that plan today (see report E-C1); this script plays the webhook's part.
import { check, sql, sqlErr, addUser, addStaff, jwt, rpc, summary, uuid } from "./lib.mjs";
import { NextSignal } from "./stubs/next-navigation.mjs";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54481"; globalThis.__e2eAnon = jwt(undefined, "anon");
const { planLedgerCalls } = await import("../lib/hc/ledger.ts");
const payouts = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
const tiers = await import("../app/(command-center)/command-center/hosting-collective/tiers/actions.ts");
const SVC = () => jwt(undefined, "service_role");
const svc = (fn, a) => rpc(SVC(), fn, a);
const cnt = (q) => Number(sql(q));
const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const web = async (u, fn, o) => { globalThis.__e2eJwt = jwt(u); try { return await fn(form(o)); } catch (e) { return e instanceof NextSignal ? { signal: e.kind } : { thrown: e.message }; } };
const DAY = 86400000;

const owner = addUser("owner@e2e.test"); addStaff(owner, "owner");
const mgr = addUser("manager@e2e.test"); addStaff(mgr, "creator_program_manager");
const pUser = addUser("partner@e2e.test"), pUser2 = addUser("basic.partner@e2e.test"), pUser3 = addUser("susp.partner@e2e.test");
// fixtures (SQL = what the review flow produces; the review flow itself is covered by scenario A)
const tierR = await web(owner, tiers.saveTier, { slug: "founding", label: "Founding", benefits: "x", reason: "tier for test", active: "yes", paid_referrals_eligible: "yes" });
await web(owner, tiers.setTierEligibility, { slug: "founding", eligible: "yes", confirm: "yes", reason: "owner enables paid eligibility (e3)" });
await web(owner, tiers.saveTier, { slug: "plain", label: "Plain tier", benefits: "x", reason: "non-eligible tier", active: "yes" });
const mkPartner = (u, name, tier, code, status = "approved") => { const id = uuid(); sql(`insert into partners(id,user_id,display_name,status,tier,approved_at) values('${id}','${u}','${name}','${status}',${tier ? `'${tier}'` : "null"},now())`); sql(`insert into partner_codes(partner_id,code) values('${id}','${code}')`); return id; };
const P1 = mkPartner(pUser, "Pat Partner", "founding", "pcode"), P2 = mkPartner(pUser2, "Basic Partner", null, "basiccode"), P3 = mkPartner(pUser3, "Suspended Partner", "founding", "suspcode", "suspended");
const P4u = addUser("plain.tier@e2e.test"); const P4 = mkPartner(P4u, "Plain Tier Partner", "plain", "plaincode");

let n = 0;
async function referred(code = "pcode", { email, touchedAgoMin = 10, createdAgoMin = 60 } = {}) {
  const u = addUser(email ?? `ref${++n}@e2e.test`);
  sql(`update auth.users set created_at = now() - interval '${createdAgoMin} minutes' where id='${u}'`);
  const touched = new Date(Date.now() - touchedAgoMin * 60000);
  const r = await rpc(jwt(u), "record_referral_claim", { p_code: code, p_touched_at: touched.toISOString() });
  return { u, touched, claim: r.data?.status ?? JSON.stringify(r.error) };
}
async function buy(u, product, { at, txn = `txn_${++n}`, amount, env = "production", provider = "web", replayEvent, customer = null, fp = null } = {}) {
  const purchasedAt = (at ?? new Date()).toISOString();
  let gid = null;
  if (["gathering_pass", "multi_day_pass"].includes(product)) { gid = uuid(); sql(`insert into gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time) values('${gid}','${u}','G ${n}','dinner',current_date+30,'18:00')`); }
  const ev = { provider: "stripe", provider_event_id: replayEvent ?? `evt_${txn}`, provider_event_type: "checkout.session.completed", event_kind: "grant", event_at: purchasedAt, purchased_at: purchasedAt, environment: env, transaction_id: txn, user_id: u, canonical_product_id: product, gathering_id: gid, entitlement_provider: provider, customer_id: customer, currency: "USD" };
  const a = await svc("apply_payment_event", { p_event: ev });
  const eid = sql(`select id from gathering_entitlements where provider_transaction_id='${txn}'`);
  let rec = null;
  if (eid) {
    const plan = planLedgerCalls({ kind: "purchase", entitlementId: eid, providerTransactionId: txn, product, currency: "usd", subtotalCents: amount ?? (product === "plus_annual" ? 5999 : 599), taxCents: 0, feeCents: 100, stripeCustomerId: customer, paymentFingerprintHash: fp });
    if (plan.ok) for (const c of plan.calls) { const r = await svc(c.rpc, c.args); if (c.rpc === "reconcile_commission_for_entitlement") rec = r.data ?? r.error; }
    else rec = { plan: plan.reason };
  }
  return { eid, txn, apply: a.data, rec, product };
}
const commission = (txn) => sql(`select state||'|'||commission_cents||'|'||coalesce(reason,'-') from commissions where source_provider_transaction_id='${txn}'`);
const nComm = () => cnt("select count(*) from commissions");
const sweep = (when) => svc("sweep_commissions", { p_now: when.toISOString() });

// ---------- C1 paid referrals OFF (default): nothing accrues
sql("update hc_settings set enabled=true");   // program master switch (SQL only; see B20)
const off = await referred(); const offBuy = await buy(off.u, "plus_annual");
check("C1", "paid referrals OFF (default): a referred first purchase accrues NOTHING (no commission row, reconcile says disabled); payout draft refused", "DB via PostgREST (service)", "paid_referrals_disabled; 0 commissions; draft paid_referrals_not_active",
  `claim=${off.claim}; rec=${JSON.stringify(offBuy.rec)}; commissions=${nComm()}; draft=${JSON.stringify((await rpc(jwt(owner), "hc_create_payout_draft", { p_partner_id: P1 })).data)}`,
  off.claim === "claimed" && offBuy.rec?.status === "paid_referrals_disabled" && nComm() === 0);
const swOff = await sweep(new Date(Date.now() + 60 * DAY));
const act = await web(owner, payouts.paidReferralsSwitch, { mode: "activate", phrase: "ACTIVATE PAID REFERRALS", reason: "e2e scenario activation" });
check("C1b", "owner activates paid referrals (typed phrase + reason); economics now computed from hc_terms only", "web action + DB", "ok; paid=true", `${JSON.stringify(act)}; ${sql("select paid_referrals_enabled from hc_settings")}`, act.ok && sql("select paid_referrals_enabled from hc_settings") === "t");
// the purchase made while OFF stays without a commission after activation (no retroactive accrual unless reconcile is re-run)
const offLater = (await svc("reconcile_commission_for_entitlement", { p_entitlement_id: offBuy.eid })).data;
check("C1c", "OBSERVATION: a purchase made while OFF can still be reconciled AFTER activation (retroactive accrual if the wiring re-runs reconcile)", "DB", "informational", JSON.stringify(offLater), "PARTIAL", "see report: no cut-off timestamp between OFF-period purchases and activation");


// ---------- C2 amounts
const a1 = await referred(); const b1 = await buy(a1.u, "plus_annual");
const a2 = await referred(); const b2 = await buy(a2.u, "gathering_pass");
check("C2a", "Plus annual first qualifying purchase = $12.00 (1200c), state pending, snapshot of terms v1", "DB", "pending|1200", `${commission(b1.txn)}; snap=${sql(`select terms_version||'/'||terms_amount_cents||'/'||terms_validation_days||'/'||terms_min_payout_cents||'/'||terms_window_days from commissions where source_provider_transaction_id='${b1.txn}'`)}`, commission(b1.txn).startsWith("pending|1200"));
check("C2b", "Gathering Pass first qualifying purchase = $0.50 (50c)", "DB", "pending|50", commission(b2.txn), commission(b2.txn).startsWith("pending|50"));
check("C2c", "commission is a FIXED amount (independent of the price paid): a discounted/odd subtotal does not change it; rate_bps null", "DB", "1200 with $59.99 and with $9.99 subtotals", (() => { return `rate=${sql("select string_agg(coalesce(rate_bps::text,'null'),',') from commissions")}`; })(), sql("select bool_and(rate_bps is null) from commissions") === "t");
const a2b = await referred(); const b2b = await buy(a2b.u, "plus_annual", { amount: 999 });
check("C2d", "…verify: Plus bought at a different subtotal still pays 1200", "DB", "1200", commission(b2b.txn), commission(b2b.txn).startsWith("pending|1200"));
// validate_after
check("C3a", "45-day validation hold stored on the row (validate_after = purchased_at + 45d)", "DB", "45 days", sql(`select extract(epoch from validate_after-purchased_at)/86400 from commissions where source_provider_transaction_id='${b1.txn}'`), sql(`select extract(epoch from validate_after-purchased_at)/86400 from commissions where source_provider_transaction_id='${b1.txn}'`) === "45.0000000000000000" || Number(sql(`select extract(epoch from validate_after-purchased_at)/86400 from commissions where source_provider_transaction_id='${b1.txn}'`)) === 45);
const pa1 = new Date(sql(`select purchased_at from commissions where source_provider_transaction_id='${b1.txn}'`).replace(" ", "T") + ":00Z");
const pAt = new Date(sql(`select extract(epoch from purchased_at)*1000 from commissions where source_provider_transaction_id='${b1.txn}'`) * 1);
await sweep(new Date(pAt.getTime() + 44 * DAY + 23 * 3600000 + 59 * 60000));
const s44 = commission(b1.txn);
await sweep(new Date(pAt.getTime() + 45 * DAY - 1000));
const s4459 = commission(b1.txn);
await sweep(new Date(pAt.getTime() + 45 * DAY));
const s45 = commission(b1.txn);
check("C3b", "hold edge: day 44 (+23:59) and 44d23:59:59 stay pending; exactly 45d -> validated", "DB", "pending; pending; validated", `${s44}; ${s4459}; ${s45}`, s44.startsWith("pending") && s4459.startsWith("pending") && s45.startsWith("validated"));
// ---------- attribution window edges (claim time rules)
const t = (minAgo, o = {}) => referred("pcode", { touchedAgoMin: minAgo, ...o });
const e1 = await referred("pcode", { touchedAgoMin: 30 * 1440 - 1, createdAgoMin: 30 * 1440 + 30 });   // touch 29d23h59m ago, account created before touch? (created before touch needed: touch <= created+1h)
const e2 = await referred("pcode", { touchedAgoMin: 30 * 1440 + 1, createdAgoMin: 30 * 1440 + 30 });
check("C4a", "claim rules: a touch just inside 30 days is accepted only while the claim grace (24h after signup) still holds", "DB via PostgREST", "claim_too_late for old accounts (grace 24h) — see C4b", `inside=${e1.claim}; outside=${e2.claim}`, "PARTIAL", "informational");
const f1 = await referred("pcode", { touchedAgoMin: 30 * 1440 - 5, createdAgoMin: 30 * 1440 - 5 });  // account created at touch time, claimed now (29d23h later)
const f2 = await referred("pcode", { touchedAgoMin: 30 * 1440 + 5, createdAgoMin: 30 * 1440 + 5 });
const late = await referred("pcode", { touchedAgoMin: 20 * 60, createdAgoMin: 20 * 60 + 1 });   // ok within 24h
const tooLate = await referred("pcode", { touchedAgoMin: 26 * 60, createdAgoMin: 26 * 60 + 1 });
check("C4b", "record_referral_claim: day-30 inside / outside; claim within 24h of signup ok, after 24h refused", "DB via PostgREST", "claim_too_late | expired_touch | claimed | claim_too_late", `${f1.claim} | ${f2.claim} | ${late.claim} | ${tooLate.claim}`, f2.claim === "expired_touch" && late.claim === "claimed" && tooLate.claim === "claim_too_late");
// purchase-window edges relative to a claim (touch = 10 min ago)
const w = {};
for (const [label, off] of [["day29", 29 * DAY], ["day30_exact", 30 * DAY], ["day30_plus_1h", 30 * DAY + 3600000], ["day31", 31 * DAY]]) {
  const r = await referred(); const touched = r.touched;
  const b = await buy(r.u, "plus_annual", { at: new Date(touched.getTime() + off) });
  w[label] = b.rec?.status ?? JSON.stringify(b.rec); }
check("C5", "30-day attribution at PURCHASE time: day 29 and exactly day 30 qualify; 30d+1h and day 31 are outside_window", "DB via PostgREST (service)", "pending; pending; outside_window; outside_window", JSON.stringify(w), w.day29 === "pending" && w.day30_exact === "pending" && w.day30_plus_1h === "outside_window" && w.day31 === "outside_window", "boundary is exact 30*24h from the touch, not calendar day 30");
// ---------- minimum payout $50
// build validated commissions for partner P1 (existing validated: b1=1200 ; others pending/valid)
const baseValidated = async () => { await sweep(new Date(Date.now() + 60 * DAY)); };
await baseValidated();
const bal = () => sql("select coalesce(sum(commission_cents),0) from commissions where partner_id='" + P1 + "' and state='validated'");
const before = bal();
const d1 = await rpc(jwt(owner), "hc_create_payout_draft", { p_partner_id: P1 });
check("C6a", "below $50: draft refused as below_minimum with the eligible amount reported", "DB via PostgREST", "below_minimum", `${before}c -> ${JSON.stringify(d1.data)}`, d1.data?.status === "below_minimum" && Number(before) < 5000);
// top up to 4950, then to exactly 5000
let need = 4950 - Number(before); const adds = [];
while (need >= 1200) { const r = await referred(); const b = await buy(r.u, "plus_annual"); adds.push(b.txn); need -= 1200; }
while (need >= 50) { const r = await referred(); const b = await buy(r.u, "gathering_pass"); adds.push(b.txn); need -= 50; }
await baseValidated();
const d2 = await rpc(jwt(owner), "hc_create_payout_draft", { p_partner_id: P1 });
check("C6b", "4950c (one pass short of $50): still below_minimum", "DB via PostgREST", "below_minimum 4950", `${bal()}c -> ${JSON.stringify(d2.data)}`, bal() === "4950" && d2.data?.status === "below_minimum");
const r5 = await referred(); const b5 = await buy(r5.u, "gathering_pass"); await baseValidated();
const mdraft = await rpc(jwt(mgr), "hc_create_payout_draft", { p_partner_id: P1 });
const d3 = await rpc(jwt(owner), "hc_create_payout_draft", { p_partner_id: P1 });
check("C6c", "exactly $50.00 (5000c): draft created for the owner; manager cannot create it", "DB via PostgREST", "draft total 5000; manager not_authorized", `${JSON.stringify(d3.data)}; mgr=${mdraft.error?.message}`, d3.data?.status === "draft" && d3.data?.net_cents === 5000 && /not_authorized/.test(mdraft.error?.message));
globalThis.__payout = d3.data?.payout_id;
// ---------- renewal / upgrade / repeat
const u1 = await referred(); const g1 = await buy(u1.u, "gathering_pass"); const up = await buy(u1.u, "plus_annual");
check("C7a", "UPGRADE: Gathering Pass first, then Plus -> only the first purchase earns; Plus earns nothing", "DB via PostgREST (service)", "pass pending 50; plus not_new_customer", `${commission(g1.txn)}; plus=${up.rec?.status}`, commission(g1.txn).startsWith("pending|50") && up.rec?.status === "not_new_customer");
const u2 = await referred(); const p1 = await buy(u2.u, "plus_annual"); const rn = await buy(u2.u, "plus_annual", { txn: `renew_${++n}` });
check("C7b", "RENEWAL: Plus then a second Plus purchase row (renewal/new txn) -> second earns nothing", "DB via PostgREST (service)", "first pending 1200; renewal not_new_customer; still 1 commission for the user", `${commission(p1.txn)}; renewal=${rn.rec?.status ?? "(no 2nd entitlement) apply=" + rn.apply?.outcome}; rows=${cnt(`select count(*) from commissions where referred_user_id='${u2.u}'`)}`, (rn.rec?.status === "not_new_customer" || rn.apply?.outcome === "duplicate_purchase") && cnt(`select count(*) from commissions where referred_user_id='${u2.u}'`) === 1);
// real RENEWAL EVENT on the same subscription (apply_payment_event continues the same entitlement)
const ren = await svc("apply_payment_event", { p_event: { provider: "stripe", provider_event_id: `evt_ren_${n}`, provider_event_type: "invoice.paid", event_kind: "grant", event_at: new Date().toISOString(), environment: "production", transaction_id: p1.txn, user_id: u2.u, canonical_product_id: "plus_annual", entitlement_provider: "web" } });
check("C7c", "RENEWAL EVENT on the same subscription (grant event, same transaction): commission count unchanged", "DB via PostgREST (service)", "still 1 commission, amount 1200", `${JSON.stringify(ren.data)}; rows=${cnt(`select count(*) from commissions where referred_user_id='${u2.u}'`)}`, cnt(`select count(*) from commissions where referred_user_id='${u2.u}'`) === 1);
// ---------- self referral
const sr = await rpc(jwt(pUser), "record_referral_claim", { p_code: "pcode", p_touched_at: new Date(Date.now() - 60000).toISOString() });
sql(`update auth.users set created_at=now()-interval '5 minutes' where id='${pUser}'`);
const sr2 = await rpc(jwt(pUser), "record_referral_claim", { p_code: "pcode", p_touched_at: new Date(Date.now() - 60000).toISOString() });
const aliasU = addUser("p.artner+promo@e2e.test"); sql(`update auth.users set created_at=now()-interval '5 minutes' where id='${aliasU}'`);
const sr3 = await rpc(jwt(aliasU), "record_referral_claim", { p_code: "pcode", p_touched_at: new Date(Date.now() - 60000).toISOString() });
check("C8a", "self-referral: partner using own code is not attributed (self_referral); same-mailbox alias (gmail-style) treated the same", "DB via PostgREST", "self_referral (or claim_too_late for old account); alias claimed? (see note)", `own=${sr.data?.status}/${sr2.data?.status}; alias(p.artner+promo@e2e.test vs partner@e2e.test)=${sr3.data?.status}`, sr2.data?.status === "self_referral", "alias variant uses hc_norm_email rules (domain-specific); partner@ vs p.artner+promo@ on e2e.test is not the same mailbox for a non-gmail domain");
// force a claim (bypass the RPC) to test the commission-level guard independently
const selfU = pUser, selfEnt = await buy(selfU, "plus_annual");
sql(`insert into referral_claims(referred_user_id,partner_id,code_id,touched_at,window_ends_at) select '${selfU}','${P1}',id,now()-interval '1 hour',now()+interval '29 days' from partner_codes where partner_id='${P1}' on conflict do nothing`);
const selfRec = (await svc("reconcile_commission_for_entitlement", { p_entitlement_id: selfEnt.eid })).data;
check("C8b", "defence in depth: even if a self-claim row existed, the commission is BLOCKED (self_referral_user)", "DB via PostgREST (service)", "blocked|self_referral_user", JSON.stringify(selfRec), selfRec?.status === "blocked" && selfRec?.reason === "self_referral_user");
const emailAliasU = addUser("PARTNER@e2e.test".toLowerCase().replace("partner", "partner") + ".dup"); // distinct mailbox; just a control
// ---------- refund during hold
const rf = await referred(); const rfb = await buy(rf.u, "plus_annual");
await svc("apply_payment_event", { p_event: { provider: "stripe", provider_event_id: `evt_rf_${n}`, provider_event_type: "charge.refunded", event_kind: "refund", event_at: new Date().toISOString(), environment: "production", transaction_id: rfb.txn, reason: "requested_by_customer" } });
const rfPlan = planLedgerCalls({ kind: "refund", entitlementId: rfb.eid, providerTransactionId: rfb.txn, partial: false });
const rfRec = (await svc(rfPlan.calls[0].rpc, rfPlan.calls[0].args)).data;
const afterPlan = commission(rfb.txn);
await sweep(new Date());
check("C9a", "refund during the hold: the web ledger plan for 'refund' (reconcile only) does NOT reverse the commission; the next sweep does", "DB via PostgREST (service)", "after reconcile: still pending (planner gap); after sweep: reversed|refund_or_dispute", `reconcile=${JSON.stringify(rfRec)}; after reconcile=${afterPlan}; after sweep=${commission(rfb.txn)}`, commission(rfb.txn).startsWith("reversed") && afterPlan.startsWith("pending"), "commission stays live until a sweep runs; no scheduler exists (E-C2)");
// refund AFTER validation but BEFORE sweep -> can it be drafted?
const rv = await referred(); const rvb = await buy(rv.u, "plus_annual");
sql(`update commissions set state='validated' where source_provider_transaction_id='${rvb.txn}'`);   // simulate: sweep validated it before the refund arrived
await svc("apply_payment_event", { p_event: { provider: "stripe", provider_event_id: `evt_rv_${n}`, provider_event_type: "charge.refunded", event_kind: "refund", event_at: new Date().toISOString(), environment: "production", transaction_id: rvb.txn, reason: "requested_by_customer" } });
// (clean slate for payout draft: void earlier draft first)
await rpc(jwt(owner), "hc_void_payout", { p_payout_id: globalThis.__payout, p_reason: "e2e reset for refund-race test" });
const raceDraft = await rpc(jwt(owner), "hc_create_payout_draft", { p_partner_id: P1 });
const inDraft = sql(`select count(*) from commissions where source_provider_transaction_id='${rvb.txn}' and state='payable'`);
check("C9b", "REFUND RACE: purchase refunded after it validated but before any sweep: a payout draft must not include it", "DB via PostgREST", "refunded commission excluded from the draft (0 payable)", `draft=${JSON.stringify(raceDraft.data)}; refunded commission payable=${inDraft}`, inDraft === "0", "see DEFECT E-C3");
// cleanup: void that draft
if (raceDraft.data?.payout_id) await rpc(jwt(owner), "hc_void_payout", { p_payout_id: raceDraft.data.payout_id, p_reason: "e2e cleanup" });
// ---------- dispute
const ds = await referred(); const dsb = await buy(ds.u, "plus_annual");
await svc("record_purchase_dispute", { p_provider_transaction_id: dsb.txn, p_status: "open" }); await sweep(new Date());
const dOpen = commission(dsb.txn);
await svc("record_purchase_dispute", { p_provider_transaction_id: dsb.txn, p_status: "won" }); await sweep(new Date());
const dWon = commission(dsb.txn);
const ds2 = await referred(); const ds2b = await buy(ds2.u, "plus_annual");
await svc("record_purchase_dispute", { p_provider_transaction_id: ds2b.txn, p_status: "open" }); await sweep(new Date());
await svc("record_purchase_dispute", { p_provider_transaction_id: ds2b.txn, p_status: "lost" }); await sweep(new Date());
check("C10", "dispute: open -> held (excluded); won -> released to pending; lost -> reversed", "DB via PostgREST (service)", "held|dispute_open; pending|dispute_won; reversed", `${dOpen}; ${dWon}; lost=${commission(ds2b.txn)}`, dOpen.startsWith("held") && dWon.startsWith("pending") && commission(ds2b.txn).startsWith("reversed"));
// ---------- duplicate replay
const dp = await referred(); const dpb = await buy(dp.u, "plus_annual");
const replay1 = await buy(dp.u, "plus_annual", { txn: dpb.txn, replayEvent: `evt_${dpb.txn}` });   // identical event id
const replay2 = await svc("reconcile_commission_for_entitlement", { p_entitlement_id: dpb.eid });
const replay3 = await buy(dp.u, "plus_annual", { txn: dpb.txn, replayEvent: `evt_other_${dpb.txn}` });   // same transaction, NEW event id
check("C11", "duplicate transaction replay (same event id; reconcile twice; same txn with a new event id): exactly one commission", "DB via PostgREST (service)", "1 commission; 'duplicate'/'already_recorded'", `apply1=${JSON.stringify(replay1.apply)}; recon=${JSON.stringify(replay2.data)}; apply3=${JSON.stringify(replay3.apply)}; rows=${cnt(`select count(*) from commissions where source_provider_transaction_id='${dpb.txn}'`)}`, cnt(`select count(*) from commissions where source_provider_transaction_id='${dpb.txn}'`) === 1);
// ---------- non-qualifying products / env / free
const md = await referred(); const mdb = await buy(md.u, "multi_day_pass");
const sbx = await referred(); const sbb = await buy(sbx.u, "plus_annual", { env: "sandbox" });
const fr = await referred(); const frb = await buy(fr.u, "plus_annual", { amount: 0 });
const ap = await referred(); const apb = await buy(ap.u, "plus_annual", { provider: "apple" });
check("C12", "non-qualifying: Multi-Day Pass, sandbox purchase, $0 (100% coupon), Apple/Google purchase never earn", "DB via PostgREST (service)", "not_qualifying x3 + not_qualifying_no_payment", `multi-day: plan=${mdb.rec?.plan} rec=${mdb.rec?.status}; sandbox: apply=${sbb.apply?.outcome} rec=${sbb.rec?.status}; free: ${frb.rec?.status}; apple: ${apb.rec?.status}; commissions for these users=${cnt(`select count(*) from commissions where referred_user_id in ('${md.u}','${sbx.u}','${fr.u}','${ap.u}')`)}`, cnt(`select count(*) from commissions where referred_user_id in ('${md.u}','${sbx.u}','${fr.u}','${ap.u}')`) === 0);
// ---------- tier gating: basic / not eligible / suspended partner / invalid code
const bm = await referred("basiccode"); const bmb = await buy(bm.u, "plus_annual");
const pt = await referred("plaincode"); const ptb = await buy(pt.u, "plus_annual");
const sp = await referred("suspcode");
check("C13", "members without paid terms never accrue silently: tier-less member -> HELD basic_membership_no_tier; non-eligible tier -> HELD; suspended partner's code is invalid", "DB via PostgREST (service)", "held; held; claim invalid_code", `${commission(bmb.txn)}; ${commission(ptb.txn)}; suspended code claim=${sp.claim}`, commission(bmb.txn).startsWith("held|1200|basic_membership_no_tier") && commission(ptb.txn).startsWith("held|1200|tier_not_eligible") && sp.claim === "invalid_code");
// ---------- terms versioning vs purchase date
const eff = new Date(Date.now() + 20 * DAY);
await rpc(jwt(owner), "hc_add_terms_version", { p_amounts: { gathering_pass: 75 }, p_validation_days: 45, p_min_payout_cents: 5000, p_effective_from: eff.toISOString(), p_note: "e2e v2" });
const v2 = await referred(); const v2b = await buy(v2.u, "gathering_pass", { at: new Date(eff.getTime() + 60000), txn: `v2_${++n}` });
const v1 = await referred(); const v1b = await buy(v1.u, "gathering_pass");
check("C14", "versioned terms: a purchase dated after v2 takes v2's amount; earlier rows keep v1 (frozen); frozen rows cannot be edited", "DB", "v2 purchase 75 (terms_version 2); today's 50 (v1); update blocked", `${commission(v2b.txn)} v${sql(`select terms_version from commissions where source_provider_transaction_id='${v2b.txn}'`)}; ${commission(v1b.txn)}; edit=${sqlErr(`update commissions set commission_cents=99999 where source_provider_transaction_id='${v1b.txn}'`)}`, commission(v2b.txn).startsWith("pending|75") && commission(v1b.txn).startsWith("pending|50") && !!sqlErr(`update commissions set commission_cents=99999 where source_provider_transaction_id='${v1b.txn}'`));
// ---------- partial refund
const pr = await referred(); const prb = await buy(pr.u, "plus_annual");
const prr = await svc("record_purchase_partial_refund", { p_provider_transaction_id: prb.txn, p_refunded_cents: 1000 });
check("C15", "partial refund: commission is HELD for staff review (not auto-reversed, not auto-paid)", "DB via PostgREST (service)", "held_for_review; held|partial_refund_review", `${JSON.stringify(prr.data)}; ${commission(prb.txn)}`, commission(prb.txn).startsWith("held|1200|partial_refund_review"));
// ---------- no automatic discount
import { readFileSync, existsSync } from "node:fs";
const files = ["lib/checkout.ts", "app/api/checkout/route.ts", "lib/checkout-gate.ts", "lib/claimReferral.ts", "app/auth/callback/route.ts"].filter(existsSync);
const hits = files.map(f => [f, (readFileSync(f, "utf8").match(/coupon|discount|promotion_code|promo|allow_promotion/gi) ?? []).length]);
const refInCheckout = /referral|ref_code|partner_code|touch/i.test(readFileSync("app/api/checkout/route.ts", "utf8") + readFileSync("lib/checkout.ts", "utf8"));
check("C16", "no automatic discount: referral attribution does not feed any coupon/discount/promotion in the checkout code", "code scan (web)", "0 discount/coupon hits tied to referral; checkout has no referral input", `${JSON.stringify(hits)}; checkout mentions referral=${refInCheckout}`, !refInCheckout, "static scan only; Stripe dashboard promo config not examined");
summary();
