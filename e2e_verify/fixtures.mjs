// Shared fixtures for scenarios D/E: partner + referred buyers through the REAL payment ledger and planner.
import { check, sql, sqlErr, addUser, addStaff, jwt, rpc, summary, uuid } from "./lib.mjs";
import { NextSignal } from "./stubs/next-navigation.mjs";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54481"; globalThis.__e2eAnon = jwt(undefined, "anon");
export const { planLedgerCalls } = await import("../lib/hc/ledger.ts");
export const payouts = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
export const tiers = await import("../app/(command-center)/command-center/hosting-collective/tiers/actions.ts");
export const SVC = () => jwt(undefined, "service_role");
export const svc = (fn, a) => rpc(SVC(), fn, a);
export const cnt = (q) => Number(sql(q));
export const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
export const web = async (u, fn, o) => { globalThis.__e2eJwt = jwt(u); try { return await fn(form(o)); } catch (e) { return e instanceof NextSignal ? { signal: e.kind } : { thrown: e.message }; } };
export const DAY = 86400000;
export const owner = addUser("owner@e2e.test"); addStaff(owner, "owner");
export const mgr = addUser("manager@e2e.test"); addStaff(mgr, "creator_program_manager");
export const pUser = addUser("partner@e2e.test"), pUser2 = addUser("basic.partner@e2e.test"), pUser3 = addUser("susp.partner@e2e.test");
// fixtures (SQL = what the review flow produces; the review flow itself is covered by scenario A)
export const tierR = await web(owner, tiers.saveTier, { slug: "founding", label: "Founding", benefits: "x", reason: "tier for test", active: "yes", paid_referrals_eligible: "yes" });
await web(owner, tiers.saveTier, { slug: "plain", label: "Plain tier", benefits: "x", reason: "non-eligible tier", active: "yes" });
export const mkPartner = (u, name, tier, code, status = "approved") => { const id = uuid(); sql(`insert into partners(id,user_id,display_name,status,tier,approved_at) values('${id}','${u}','${name}','${status}',${tier ? `'${tier}'` : "null"},now())`); sql(`insert into partner_codes(partner_id,code) values('${id}','${code}')`); return id; };
export const P1 = mkPartner(pUser, "Pat Partner", "founding", "pcode"), P2 = mkPartner(pUser2, "Basic Partner", null, "basiccode"), P3 = mkPartner(pUser3, "Suspended Partner", "founding", "suspcode", "suspended");
const P4u = addUser("plain.tier@e2e.test"); const P4 = mkPartner(P4u, "Plain Tier Partner", "plain", "plaincode");

export let n = 0;
export async function referred(code = "pcode", { email, touchedAgoMin = 10, createdAgoMin = 60 } = {}) {
  const u = addUser(email ?? `ref${++n}@e2e.test`);
  sql(`update auth.users set created_at = now() - interval '${createdAgoMin} minutes' where id='${u}'`);
  const touched = new Date(Date.now() - touchedAgoMin * 60000);
  const r = await rpc(jwt(u), "record_referral_claim", { p_code: code, p_touched_at: touched.toISOString() });
  return { u, touched, claim: r.data?.status ?? JSON.stringify(r.error) };
}
export async function buy(u, product, { at, txn = `txn_${++n}`, amount, env = "production", provider = "web", replayEvent, customer = null, fp = null } = {}) {
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
export const commission = (txn) => sql(`select state||'|'||commission_cents||'|'||coalesce(reason,'-') from commissions where source_provider_transaction_id='${txn}'`);
export const nComm = () => cnt("select count(*) from commissions");
export const sweep = (when) => svc("sweep_commissions", { p_now: when.toISOString() });


export async function activate() {
  sql("update hc_settings set enabled=true");
  const act = await web(owner, payouts.paidReferralsSwitch, { mode: "activate", phrase: "ACTIVATE PAID REFERRALS", reason: "e2e scenario activation" });
  return act;
}
export async function validatedTotal(total = 5000) {
  let need = total - Number(sql("select coalesce(sum(commission_cents),0) from commissions where partner_id='" + P1 + "' and state='validated'"));
  while (need >= 1200) { const r = await referred(); await buy(r.u, "plus_annual"); need -= 1200; }
  while (need >= 50) { const r = await referred(); await buy(r.u, "gathering_pass"); need -= 50; }
  await sweep(new Date(Date.now() + 60 * DAY));
}
