// Scenario (b): paid referrals OFF by default; NO retroactive accrual for purchases made while OFF after turning ON; boundary instants (microsecond).
import { check, sql, jwt, rpc, summary } from "./lib.mjs";
import { owner, P1, referred, buy, svc, web, payouts, cnt } from "./fixtures.mjs";
const iso = (expr) => sql(`select to_char((${expr}) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`);
const off = (u, atIso) => buy(u, "plus_annual", { atIso });
const results = {};
const run = async (label, atIso) => { const r = await referred(); const b = await buy(r.u, "plus_annual", { atIso }); results[label] = { txn: b.txn, rec: b.rec?.status ?? b.rec?.plan ?? JSON.stringify(b.rec), comm: sql(`select state||'/'||commission_cents from commissions where source_provider_transaction_id='${b.txn}'`) || "none", eid: b.eid }; return results[label]; };
check("B-W0", "default: paid referrals OFF, no window rows, master switch off", "DB", "paid=false, windows=0", `paid=${sql("select paid_referrals_enabled from hc_settings")}; windows=${cnt("select count(*) from hc_paid_referral_windows")}`, sql("select paid_referrals_enabled from hc_settings") === "f" && cnt("select count(*) from hc_paid_referral_windows") === 0);
const pre = await run("pre_on_purchase_while_default_off");
check("B-W1", "purchase made while paid referrals are OFF (default) accrues nothing", "DB via PostgREST (service)", "no commission row", JSON.stringify(pre), pre.comm === "none");
sql("update hc_settings set enabled=true");
const act = await web(owner, payouts.paidReferralsSwitch, { mode: "activate", phrase: "ACTIVATE PAID REFERRALS", reason: "window test activation" });
const S = iso("select started_at from hc_paid_referral_windows where ended_at is null");
check("B-W2", "owner turns paid referrals ON: one open window recorded with start instant", "web action + DB", "ok; 1 open window", `${JSON.stringify(act)}; start=${S}`, act.ok && cnt("select count(*) from hc_paid_referral_windows where ended_at is null") === 1);
// retroactive attempts: reconcile + maintenance after ON for the OFF-time purchase
const rr = await rpc(jwt(undefined, "service_role"), "reconcile_commission_for_entitlement", { p_entitlement_id: results.pre_on_purchase_while_default_off.eid });
const mt = await rpc(jwt(undefined, "service_role"), "hc_commission_maintenance", { p_lookback_days: 30, p_batch: 200 });
check("B-W3", "NO retroactive accrual: after turning ON, reconcile AND the maintenance job do not create a commission for the purchase made while OFF", "DB via PostgREST (service)", "reconcile -> off_at_purchase; 0 commissions for that txn", `reconcile=${JSON.stringify(rr.data ?? rr.error)}; maintenance=${JSON.stringify(mt.data ?? mt.error).slice(0, 160)}; commissions for txn=${cnt(`select count(*) from commissions where source_provider_transaction_id='${results.pre_on_purchase_while_default_off.txn}'`)}`,
  /off_at_purchase/.test(JSON.stringify(rr.data)) && cnt(`select count(*) from commissions where source_provider_transaction_id='${results.pre_on_purchase_while_default_off.txn}'`) === 0);
const m = (e) => iso(`${e}`);
const before = await run("S_minus_1us", iso(`select started_at - interval '1 microsecond' from hc_paid_referral_windows where ended_at is null`));
const at = await run("S_exact", S);
const after = await run("S_plus_1us", iso(`select started_at + interval '1 microsecond' from hc_paid_referral_windows where ended_at is null`));
const inside = await run("inside_now", undefined);
const okFlag = (x, on) => (x.comm !== "none") === on;
check("B-W4", "start boundary: 1us before start = no commission; exactly at start = commission; 1us after = commission", "DB via PostgREST (service)", "none / 1200 / 1200", `${before.comm} (${before.rec}) / ${at.comm} / ${after.comm}`, okFlag(before, false) && okFlag(at, true) && okFlag(after, true));
await new Promise(r => setTimeout(r, 1200));
const preEnd = await run("E_minus_1us_PREP", undefined); // placeholder to keep ordering simple (made inside)
const dd = await rpc(jwt(owner), "hc_deactivate_paid_referrals", { p_reason: "window test deactivation" });
const E = iso("select ended_at from hc_paid_referral_windows order by id desc limit 1");
const endM1 = await run("E_minus_1us", iso(`select ended_at - interval '1 microsecond' from hc_paid_referral_windows order by id desc limit 1`));
const endX = await run("E_exact", E);
const endP1 = await run("E_plus_1us", iso(`select ended_at + interval '1 microsecond' from hc_paid_referral_windows order by id desc limit 1`));
check("B-W5", "end boundary while the switch is OFF: nothing accrues immediately for any of the three (reconcile answers paid_referrals_disabled even for the in-window purchase 1us before the end: DEFERRED, see B-W9)", "DB via PostgREST (service)", "none / none / none", `${endM1.comm} (${endM1.rec}) / ${endX.comm} (${endX.rec}) / ${endP1.comm} (${endP1.rec}); end=${E}`, dd.data?.status === "deactivated" && okFlag(endM1, false) && okFlag(endX, false) && okFlag(endP1, false));
const gapNow = await run("gap_now_while_off", undefined);
await new Promise(r => setTimeout(r, 1500));
const act2 = await web(owner, payouts.paidReferralsSwitch, { mode: "activate", phrase: "ACTIVATE PAID REFERRALS", reason: "second window activation" });
const gap = await run("gap_between_windows", iso(`select ended_at + interval '500 milliseconds' from hc_paid_referral_windows where ended_at is not null order by id desc limit 1`));
const s2m = await run("S2_minus_1us", iso(`select started_at - interval '1 microsecond' from hc_paid_referral_windows where ended_at is null`));
const s2 = await run("S2_exact", iso(`select started_at from hc_paid_referral_windows where ended_at is null`));
const inside2 = await run("inside_second_window", undefined);
check("B-W6", "second ON period: purchase in the OFF gap (before re-activation) = none; 1us before re-activation = none; at re-activation and after = commission; windows are separate append-only rows", "DB via PostgREST (service)", "none/none/none/1200/1200", `gap_now=${gapNow.comm}; gap=${gap.comm}; S2-1us=${s2m.comm}; S2=${s2.comm}; inside2=${inside2.comm}; windows=${cnt("select count(*) from hc_paid_referral_windows")}`,
  act2.ok && okFlag(gapNow, false) && okFlag(gap, false) && okFlag(s2m, false) && okFlag(s2, true) && okFlag(inside2, true) && cnt("select count(*) from hc_paid_referral_windows") === 2);
const mt2 = await rpc(jwt(undefined, "service_role"), "hc_commission_maintenance", { p_lookback_days: 30, p_batch: 500 });
const endM1After = sql(`select state||'/'||commission_cents from commissions where source_provider_transaction_id='${results.E_minus_1us.txn}'`) || "none";
const endXAfter = sql(`select count(*) from commissions where source_provider_transaction_id in ('${results.E_exact.txn}','${results.E_plus_1us.txn}')`);
check("B-W9", "after the NEXT activation, maintenance picks up the purchase made 1us before the first window ended (was inside window 1) but still NOT the ones at/after the end", "DB via PostgREST (service)", "E-1us gets a commission; E and E+1us none", `E-1us=${endM1After}; E,E+1us commissions=${endXAfter}; maint=${JSON.stringify(mt2.data ?? mt2.error).slice(0, 160)}`, endM1After !== "none" && endXAfter === "0", "deferred, not lost");
// late maintenance sweep must not pick up any OFF-time purchase
await rpc(jwt(undefined, "service_role"), "hc_commission_maintenance", { p_lookback_days: 30, p_batch: 500 }).catch(() => {});
await rpc(jwt(undefined, "service_role"), "sweep_commissions", {});
const offLabels = ["pre_on_purchase_while_default_off", "S_minus_1us", "E_exact", "E_plus_1us", "gap_now_while_off", "gap_between_windows", "S2_minus_1us"];
const late = offLabels.map(l => [l, cnt(`select count(*) from commissions where source_provider_transaction_id='${results[l].txn}'`)]);
check("B-W7", "after a late maintenance + sweep run, STILL no commission exists for any purchase made while OFF (7 OFF-time purchases)", "DB", "all 0", JSON.stringify(late), late.every(([, c]) => c === 0));
check("B-W8", "windows are append-only (cannot edit/delete a window to back-date accrual)", "DB", "update/delete raise", `${sqlErrTxt("update hc_paid_referral_windows set started_at = started_at - interval '90 days' where ended_at is null")} | ${sqlErrTxt("delete from hc_paid_referral_windows")}`, !!sqlErrTxt("update hc_paid_referral_windows set started_at = started_at - interval '90 days' where ended_at is null") && !!sqlErrTxt("delete from hc_paid_referral_windows"));
function sqlErrTxt(q) { try { sql(q); return ""; } catch (e) { return String(e.message).split("::")[0].slice(0, 80); } }
summary();
