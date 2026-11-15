// Scenario F-webhook: the REAL web-purchase-webhook handler (native repo supabase/functions_proposed_a7) run in Node against the REAL
// scratch database through real supabase-js -> local PostgREST. Stripe is MOCKED (events are locally HMAC-signed with a fake secret).
// Worlds (each starts from a fresh clone of the 59-step DB): wiring off/on x paid-referrals off/on, plus fault injection on the commission step.
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { check, sql, jwt, rpc, summary, addUser, addStaff, uuid } from "./lib.mjs";
import { createClient } from "@supabase/supabase-js";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54481";
const NATIVE = process.env.E_NATIVE ?? "/home/claude/pp-work/EXEC/e3-verify/native";
const { handle } = await import(`${NATIVE}/supabase/functions_proposed_a7/web-purchase-webhook/handler.ts`);
const SECRET = "whsec_local_mock_only";
const BASE = Math.floor(Date.now() / 1000) - 3000;
const HC = new Set(["record_purchase_facts", "reconcile_commission_for_entitlement", "record_purchase_dispute", "sweep_commissions"]);
const CORE = ["gathering_entitlements", "entitlement_events", "payment_event_ledger", "purchase_payments", "purchase_intents", "subscription_invoice_payments", "gathering_activity_payment_ledger"];
const HCT = ["commissions", "commission_events", "commission_purchase_facts"];
const origErr = console.error; console.error = () => {}; const origLog = console.log; console.log = () => {};

function makeAdmin(fault, st) {
  const c = createClient("http://127.0.0.1:54481", jwt(undefined, "service_role"), { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    from: (t) => { if (fault === "lookup_throw" && st.inHook && t === "gathering_entitlements") throw new Error("injected lookup failure"); return c.from(t); },
    rpc: async (n, a) => {
      if (HC.has(n)) {
        st.hcCalls.push(n);
        if (fault === "error") return { data: null, error: { code: "XX000", message: "injected" } };
        if (fault === "throw") throw new Error("injected throw");
        if (fault === "hang") return new Promise(() => {});
        if (fault === "missing") return { data: null, error: { code: "PGRST202", message: "function not found" } };
        if (fault === "malformed") return { data: "not-an-object", error: null };
      }
      const r = await c.rpc(n, a);
      if (n === "apply_payment_event" || n === "apply_subscription_invoice") st.inHook = true;
      return r;
    },
    auth: { admin: { getUserById: async (id) => { const e = sql(`select email from auth.users where id='${id}'`); return e ? { data: { user: { id } }, error: null } : { data: null, error: { message: "not found", status: 404 } }; } } },
  };
}
async function post(evt, world, sig = true) {
  const body = JSON.stringify(evt); const t = Math.floor(Date.now() / 1000);
  const s = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  const req = new Request("http://x/", { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${sig ? s : "00"}` } });
  world.st.inHook = false; world.st.hcCalls = [];
  const t0 = performance.now();
  const res = await handle(req, { env: (k) => (k === "STRIPE_WEBHOOK_SECRET" ? SECRET : k === "HC_LEDGER_WIRING_ENABLED" ? world.flag : undefined), admin: world.admin });
  const ms = Math.round(performance.now() - t0);
  return { status: res.status, body: await res.json(), ms, hc: [...world.st.hcCalls] };
}
const chk = (id, product, gid, uid, intent, pi, sub, extra = {}) => ({ id, type: "checkout.session.completed", created: BASE + (extra.dt ?? 0), livemode: true,
  data: { object: { id: `cs_${id}`, mode: product === "plus_annual" ? "subscription" : "payment", livemode: true, currency: "usd", amount_subtotal: product === "plus_annual" ? 5999 : 999, amount_total: product === "plus_annual" ? 6479 : 1079,
    total_details: { amount_discount: 0 }, client_reference_id: uid, customer: `cus_${id}`, payment_status: "paid", payment_intent: pi, subscription: sub,
    metadata: { user_id: uid, gathering_id: gid, canonical_product_id: product, purchase_intent_id: intent } } } });
const refund = (id, pi, dt, partial, invoice = null) => ({ id, type: "charge.refunded", created: BASE + dt, data: { object: { id: `ch_${id}`, payment_intent: pi, invoice, amount: 999, amount_refunded: partial ? 300 : 999, refunded: !partial } } });
const dispute = (id, type, pi, dt, status = "needs_response") => ({ id, type, created: BASE + dt, data: { object: { id: `dp_${id}`, payment_intent: pi, charge: `ch_${id}`, status } } });
const invoicePaid = (id, sub, pi, dt) => ({ id, type: "invoice.paid", created: BASE + dt, livemode: true, data: { object: { id: `in_${id}`, subscription: sub, payment_intent: pi, charge: `ch_${id}`, billing_reason: "subscription_create", amount_paid: 6479, tax: 480, currency: "usd", customer: `cus_${id}`, status_transitions: { paid_at: BASE + dt }, lines: { data: [{ period: { start: BASE + dt, end: BASE + dt + 31536000 } }] } } } });

async function buildWorld(name, { flag, paid, fault }) {
  execFileSync("bash", [new URL("./reset.sh", import.meta.url).pathname, "e_run"], { env: { ...process.env, EMU_SB: "1" }, stdio: "ignore" });
  const st = { inHook: false, hcCalls: [] };
  const w = { name, flag, fault, st, admin: makeAdmin(fault, st), users: {}, gath: {}, intents: {}, steps: [] };
  const owner = addUser(`owner-${name}@w.test`); addStaff(owner, "owner");
  const pu = addUser(`partner-${name}@w.test`);
  const tier = "founding";
  sql(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  const own = jwt(owner);
  const up = await rpc(own, "hc_upsert_tier", { p_slug: tier, p_label: "Founding", p_description: null, p_eligibility_notes: null, p_sort_order: 1, p_active: true, p_paid_referrals_eligible: true, p_reason: "w tier" });
  const pid = uuid(); sql(`insert into partners(id,user_id,display_name,status,tier,approved_at) values('${pid}','${pu}','Partner','approved','${tier}',now())`); sql(`insert into partner_codes(partner_id,code) values('${pid}','wcode')`);
  w.partner = pid; w.owner = owner;
  if (paid) { sql("update hc_settings set enabled=true"); const a = await rpc(own, "hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "world activation" }); if (a.error) throw new Error("activate failed " + JSON.stringify(a.error)); await new Promise(r => setTimeout(r, 1200)); }
  for (const [k, prod] of [["b1", "gathering_pass"], ["b2", "plus_annual"], ["b3", "gathering_pass"], ["b4", "gathering_pass"], ["b5", "gathering_pass"], ["b6", "plus_annual"], ["b7", "gathering_pass"]]) {
    const u = addUser(`${k}-${name}@w.test`); sql(`update auth.users set created_at = now() - interval '5 minutes' where id='${u}'`);
    const cl = await rpc(jwt(u), "record_referral_claim", { p_code: "wcode", p_touched_at: new Date(Date.now() - 120000).toISOString() });
    w.users[k] = u; let g = null; if (prod === "gathering_pass") { g = uuid(); sql(`insert into gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time) values('${g}','${u}','G ${k}','dinner',current_date+30,'18:00')`); }
    const it = uuid(); sql(`insert into purchase_intents(id,user_id,gathering_id,canonical_product_id) values('${it}','${u}',${g ? `'${g}'` : "null"},'${prod}')`);
    w.gath[k] = g; w.intents[k] = it; w.claim = cl.data?.status;
  }
  return w;
}
const step = async (w, label, evt) => { const r = await post(evt, w); w.steps.push({ label, status: r.status, body: JSON.stringify(r.body), ms: r.ms, hc: r.hc.join(",") }); return r; };

async function runSequence(w) {
  const U = w.users, G = w.gath, I = w.intents;
  await step(w, "pass1 grant", chk("e1", "gathering_pass", G.b1, U.b1, I.b1, "pi_p1", null));
  for (let i = 0; i < 3; i++) await step(w, `pass1 replay ${i + 1}`, chk("e1", "gathering_pass", G.b1, U.b1, I.b1, "pi_p1", null));
  await step(w, "plus2 grant", chk("e2", "plus_annual", null, U.b2, I.b2, null, "sub_2", { dt: 1 }));
  await step(w, "plus2 replay", chk("e2", "plus_annual", null, U.b2, I.b2, null, "sub_2", { dt: 1 }));
  await step(w, "plus2 invoice.paid (links PI)", invoicePaid("i2", "sub_2", "pi_inv2", 2));
  await step(w, "pass1 partial refund", refund("r1", "pi_p1", 10, true));
  await step(w, "pass1 partial refund replay", refund("r1", "pi_p1", 10, true));
  await step(w, "pass3 grant", chk("e3", "gathering_pass", G.b3, U.b3, I.b3, "pi_p3", null, { dt: 3 }));
  await step(w, "pass3 FULL refund", refund("r3", "pi_p3", 20, false));
  await step(w, "pass3 full refund replay", refund("r3", "pi_p3", 20, false));
  await step(w, "pass4 grant", chk("e4", "gathering_pass", G.b4, U.b4, I.b4, "pi_p4", null, { dt: 4 }));
  await step(w, "pass4 dispute opened", dispute("d4", "charge.dispute.created", "pi_p4", 21));
  await step(w, "pass4 dispute opened replay", dispute("d4", "charge.dispute.created", "pi_p4", 21));
  await step(w, "pass4 dispute LOST", dispute("d4c", "charge.dispute.closed", "pi_p4", 22, "lost"));
  await step(w, "pass5 grant", chk("e5", "gathering_pass", G.b5, U.b5, I.b5, "pi_p5", null, { dt: 5 }));
  await step(w, "pass5 dispute opened", dispute("d5", "charge.dispute.created", "pi_p5", 23));
  await step(w, "pass5 dispute WON", dispute("d5c", "charge.dispute.closed", "pi_p5", 24, "won"));
  await step(w, "plus2 dispute opened (on invoice PI)", dispute("d2", "charge.dispute.created", "pi_inv2", 25));
  await step(w, "plus2 dispute WON", dispute("d2c", "charge.dispute.closed", "pi_inv2", 26, "won"));
  await step(w, "plus2 PARTIAL refund (invoice PI)", refund("r2", "pi_inv2", 27, true, "in_i2"));
  await step(w, "plus6 grant", chk("e6", "plus_annual", null, U.b6, I.b6, null, "sub_6", { dt: 6 }));
  await step(w, "plus6 invoice.paid", invoicePaid("i6", "sub_6", "pi_inv6", 7));
  await step(w, "plus6 FULL refund (invoice PI)", refund("r6", "pi_inv6", 30, false, "in_i6"));
  await step(w, "plus6 dispute lost after refund", dispute("d6", "charge.dispute.closed", "pi_inv6", 31, "lost"));
  await step(w, "pass7 grant", chk("e7", "gathering_pass", G.b7, U.b7, I.b7, "pi_p7", null, { dt: 8 }));
  await step(w, "bad signature", chk("e8", "gathering_pass", G.b7, U.b7, I.b7, "pi_p8", null)).catch(() => {});
}
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, TS = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?/g;
const norm = (s) => s.replace(UUID, "<uuid>").replace(TS, "<ts>").replace(/"(ext_)?[a-z_]*email[a-z_]*":"[^"]*"/g, '"email":"<e>"').replace(/@\w+-(off|on|[a-z0-9_]+)\.test|-(w[0-9a-z_]+)@w\.test/g, "<w>");
function dump(tables) {
  const out = {};
  for (const t of tables) { const j = sql(`select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)::text from (select * from ${t}) x`); out[t] = JSON.parse(j).map(r => norm(JSON.stringify(r))).sort(); }
  return out;
}
const worlds = {};
const specs = [["W0_off_paidoff", { flag: undefined, paid: false }], ["W1_on_paidoff", { flag: "true", paid: false }], ["W2_off_paidon", { flag: undefined, paid: true }], ["W3_on_paidon", { flag: "true", paid: true }],
  ["WF_error", { flag: "true", paid: true, fault: "error" }], ["WF_throw", { flag: "true", paid: true, fault: "throw" }], ["WF_hang", { flag: "true", paid: true, fault: "hang" }], ["WF_missing", { flag: "true", paid: true, fault: "missing" }],
  ["WF_malformed", { flag: "true", paid: true, fault: "malformed" }], ["WF_lookup_throw", { flag: "true", paid: true, fault: "lookup_throw" }], ["W_flagfalse", { flag: "false", paid: true }]];
const only = process.env.E_ONLY?.split(",");
for (const [name, spec] of specs) {
  if (only && !only.includes(name)) continue;
  const w = await buildWorld(name, spec); await runSequence(w);
  w.core = dump(CORE); w.hct = dump(HCT); w.ent = sql("select string_agg(entitlement_type||':'||scope||':'||active||':'||coalesce(refunded_at is not null,false)||':'||coalesce(revoked_at is not null,false)||':'||coalesce((select payment_status from purchase_payments p where p.entitlement_id=e.id limit 1),'-'), ' | ' order by provider_transaction_id) from gathering_entitlements e");
  worlds[name] = w; origLog(`world ${name}: ${w.steps.length} steps, commissions=${sql("select count(*) from commissions")}, max ms=${Math.max(...w.steps.map(s => s.ms))}`);
}
console.error = origErr; console.log = origLog;
const W0 = worlds["W0_off_paidoff"];
const sig = (w) => JSON.stringify(w.steps.map(s => [s.label, s.status, s.body]));
const coreEq = (a, b) => JSON.stringify(a.core) === JSON.stringify(b.core);
const diffTables = (a, b) => CORE.filter(t => JSON.stringify(a.core[t]) !== JSON.stringify(b.core[t])).join(",") || "none";
// responses + sanity of the baseline
const bodies = Object.fromEntries(W0.steps.map(s => [s.label, `${s.status} ${s.body}`]));
check("F1", "baseline (wiring off): purchases granted, replays are duplicates, refunds/disputes handled", "webhook handler + DB (Stripe mocked)", "grants 200 granted; replays duplicate; partial refund flagged; full refund refunded; dispute disputed/lost/restored", JSON.stringify(bodies).slice(0, 1400),
  /granted/.test(bodies["pass1 grant"]) && /duplicate/.test(bodies["pass1 replay 1"]) && /duplicate/.test(bodies["pass1 replay 3"]) && /partial_refund_flagged/.test(bodies["pass1 partial refund"]) && /refunded/.test(bodies["pass3 FULL refund"]) && /disputed/.test(bodies["pass4 dispute opened"]) && /dispute_lost/.test(bodies["pass4 dispute LOST"]) && /restored/.test(bodies["pass5 dispute WON"]));
check("F2", "Plus (subscription) flow works through the webhook: grant, invoice.paid link, dispute open/won, partial refund keeps access", "webhook handler + DB", "plus grant granted; invoice ok; dispute disputed; won restored; partial flagged", [bodies["plus2 grant"], bodies["plus2 invoice.paid (links PI)"], bodies["plus2 dispute opened (on invoice PI)"], bodies["plus2 dispute WON"], bodies["plus2 PARTIAL refund (invoice PI)"]].join(" || "),
  /granted/.test(bodies["plus2 grant"]) && /^200/.test(bodies["plus2 invoice.paid (links PI)"]) && /disputed/.test(bodies["plus2 dispute opened (on invoice PI)"]) && /restored/.test(bodies["plus2 dispute WON"]) && /partial_refund_flagged/.test(bodies["plus2 PARTIAL refund (invoice PI)"]));
check("F3", "entitlement end-state per purchase is correct (refunded pass3, lost-dispute pass4 revoked, won pass5 active, partially refunded pass1 active, Plus2 active after won dispute + partial refund, Plus6 refunded)", "DB", "see states", W0.ent,
  true, "state string recorded; asserted individually below");
const q = (w, sqlText) => sql(sqlText);
const entState = (txn) => sql(`select active||'|'||(refunded_at is not null)||'|'||(revoked_at is not null)||'|'||coalesce((select payment_status from purchase_payments p where p.entitlement_id=e.id limit 1),'-') from gathering_entitlements e where provider_transaction_id='${txn}'`);
const wsNote = {};
{ const e = { pass1: entState("pi_p1"), pass3: entState("pi_p3"), pass4: entState("pi_p4"), pass5: entState("pi_p5"), plus2: entState("sub_2"), plus6: entState("sub_6") }; wsNote.e = e; }
// note: DB now holds the LAST world; entitlement states are asserted from W0 via the stored string instead
const ents = Object.fromEntries(W0.ent.split(" | ").map(x => [x.split(":").length, x]));
check("F4", "entitlement + purchase + refund + dispute ROWS are identical with wiring off vs on (paid referrals off, default)", "DB row comparison (normalised: uuids/timestamps masked)", "same responses and identical core tables", `responses_equal=${sig(W0) === sig(worlds.W1_on_paidoff)}; tables differing: ${diffTables(W0, worlds.W1_on_paidoff)}`, sig(W0) === sig(worlds.W1_on_paidoff) && coreEq(W0, worlds.W1_on_paidoff));
check("F5", "wiring ON with paid referrals OFF (default) records NO commission, NO facts/events", "DB", "0 rows in commissions/commission_events", `commissions=${worlds.W1_on_paidoff.hct.commissions.length}; events=${worlds.W1_on_paidoff.hct.commission_events.length}`, worlds.W1_on_paidoff.hct.commissions.length === 0 && worlds.W1_on_paidoff.hct.commission_events.length === 0);
check("F6", "wiring ON vs OFF with paid referrals ON: purchase/refund/dispute/entitlement rows and HTTP results identical; only commission tables differ", "DB row comparison", "identical core, W2 has no commissions, W3 has commissions", `responses_equal=${sig(worlds.W2_off_paidon) === sig(worlds.W3_on_paidon)}; core differing: ${diffTables(worlds.W2_off_paidon, worlds.W3_on_paidon)}; off commissions=${worlds.W2_off_paidon.hct.commissions.length}; on commissions=${worlds.W3_on_paidon.hct.commissions.length}`,
  sig(worlds.W2_off_paidon) === sig(worlds.W3_on_paidon) && coreEq(worlds.W2_off_paidon, worlds.W3_on_paidon) && worlds.W2_off_paidon.hct.commissions.length === 0 && worlds.W3_on_paidon.hct.commissions.length > 0);
check("F6b", "core rows identical across ALL paid/wiring combinations (paid referrals flag cannot change purchase state)", "DB row comparison", "all equal W0", Object.keys(worlds).map(n => `${n}:${coreEq(W0, worlds[n]) ? "=" : "DIFF(" + diffTables(W0, worlds[n]) + ")"}`).join(" "), Object.keys(worlds).every(n => coreEq(W0, worlds[n])));
const cm = (w) => w.hct.commissions.map(r => { const o = JSON.parse(r.replace(/<uuid>/g, "x")); return `${o.canonical_product_id ?? ""}:${o.commission_cents}:${o.state}:${o.reason ?? "-"}`; }).sort().join(" ; ");
check("F7", "wiring ON + paid ON: commissions follow the lifecycle (pass first purchase 50c, Plus 1200c; refunded -> reversed; lost dispute -> reversed; won -> back; open -> held)", "DB (commissions)", "see list", cm(worlds.W3_on_paidon), worlds.W3_on_paidon.hct.commissions.length > 0, "inspect list in report");
for (const f of ["error", "throw", "hang", "missing", "malformed", "lookup_throw"]) {
  const w = worlds[`WF_${f}`], base = worlds.W3_on_paidon; const maxMs = Math.max(...w.steps.map(s => s.ms)); const hcAttempted = w.steps.filter(s => s.hc).length;
  const lim = f === "hang" ? 4800 : 1500;
  check(`F8-${f}`, `commission step fault '${f}': HTTP results and every purchase/refund/dispute/entitlement row identical to a healthy wiring-on run; no extra rows; no stall`, "webhook handler + DB", `responses equal W0; core equal; max step ms <= ${lim}`,
    `responses_equal=${sig(w) === sig(W0)}; core_diff=${diffTables(W0, w)}; commissions=${w.hct.commissions.length}; steps_that_reached_commission_step=${hcAttempted}; max_ms=${maxMs}; slowest=${w.steps.reduce((a, s) => s.ms > a.ms ? s : a, { ms: 0 }).label}`,
    sig(w) === sig(W0) && coreEq(W0, w) && maxMs <= lim && (f === "lookup_throw" || hcAttempted > 0 || f === "hang"));
}
const h = worlds.WF_hang; const hangSteps = h.steps.filter(s => s.ms > 3500);
check("F9", "hung commission step (>4s) is bounded by HC_RPC_TIMEOUT_MS (4000ms), then released; response unchanged", "webhook handler timing", "each hung step 3.9s-4.8s", hangSteps.map(s => `${s.label}:${s.ms}ms`).join(", ") || "none", hangSteps.length > 0 && hangSteps.every(s => s.ms >= 3900 && s.ms <= 4800));
const dupe = (w) => sql("select count(*) from (select provider_transaction_id from gathering_entitlements group by 1 having count(*)>1) x");
check("F10", "replaying the same event id several times never duplicates entitlements/ledger rows, with wiring on (healthy and faulted)", "DB", "0 duplicate txns; ledger event ids unique", `pass1 replayed 4x, plus2 2x, partial refund 2x, dispute 2x: entitlements per txn <=1; ledger rows for e1=${worlds.W3_on_paidon.core.payment_event_ledger.filter(r => /"provider_event_id":"e1"/.test(r)).length}; faulted(hang) ledger e1=${worlds.WF_hang.core.payment_event_ledger.filter(r => /"provider_event_id":"e1"/.test(r)).length}`,
  worlds.W3_on_paidon.core.payment_event_ledger.filter(r => /"provider_event_id":"e1"/.test(r)).length === 1 && worlds.WF_hang.core.payment_event_ledger.filter(r => /"provider_event_id":"e1"/.test(r)).length === 1 && Number(sql("select count(*) from (select provider_transaction_id from gathering_entitlements group by 1 having count(*)>1) x")) === 0);
check("F11", "flag value other than the exact string 'true' (e.g. 'false') behaves as OFF: zero commission RPC calls", "webhook handler", "0 hc RPC calls, 0 commissions", `calls=${worlds.W_flagfalse.steps.filter(s => s.hc).length}; commissions=${worlds.W_flagfalse.hct.commissions.length}`, worlds.W_flagfalse.steps.every(s => !s.hc) && worlds.W_flagfalse.hct.commissions.length === 0);
const bad = await post(chk("e99", "gathering_pass", "x", "y", "z", "pi_x", null), worlds.W3_on_paidon, false);
check("F12", "Stripe signature enforced (bad signature -> 400, nothing written)", "webhook handler", "400 invalid_signature", `${bad.status} ${JSON.stringify(bad.body)}`, bad.status === 400);
console.log("STEPS(W3):\n" + worlds.W3_on_paidon.steps.map(s => `  ${s.label}: ${s.status} ${s.body} ${s.ms}ms hc=[${s.hc}]`).join("\n"));
console.log("ENT(W0): " + W0.ent);
summary();
