// Scenarios (d) start_purchase capability, (e) read-only gatherings + 30-day photo window, (g) SMS fail-closed. Scratch DB only.
import { check, sql, sqlErr, addUser, jwt, rpc, summary, uuid, asRole } from "./lib.mjs";
const O = addUser("own@d.test"), L = addUser("legacy@d.test"), M = addUser("manager@d.test"), P = addUser("planner@d.test"), S = addUser("stranger@d.test");
sql(`insert into gathering_entitlements(user_id,scope,entitlement_type,canonical_product_id,provider,environment,provider_transaction_id,expires_at) values('${O}','account','plus','plus_annual','web','production','plus_d3_owner', now()+interval '300 days')`);
const mkG = (owner, dateExpr, status = "active") => { const id = uuid(); sql(`insert into gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time,timezone) values('${id}','${owner}','G','dinner',${dateExpr},'12:00','UTC')`); sql(`update gatherings set status='${status}' where id='${id}'`); return id; };
const addMember = (g, u, lvl) => sql(`insert into gathering_members(gathering_id,user_id,invited_email,status,accepted_at,permission_level) values('${g}','${u}','${u}@d.test','accepted',now(),'${lvl}')`);
// ---------- (d)
const GA = mkG(O, "current_date+20"); addMember(GA, L, "legacy_full"); addMember(GA, M, "manager"); addMember(GA, P, "planner");
const intent = async (u) => { const r = await rpc(jwt(u), "create_purchase_intent", { p_canonical_product_id: "gathering_pass", p_gathering_id: GA }); return r.error ? (r.error.message ?? r.error.code) : "ALLOWED"; };
const d = { owner: await intent(O), legacy_full: await intent(L), manager: await intent(M), planner: await intent(P), stranger: await intent(S) };
const caps = sql("select string_agg(level||'='||(case when capability is not null then 'start_purchase' end), ',') from cohost_level_capabilities where capability='start_purchase'");
check("D-1", "Gathering Pass purchase start requires start_purchase: owner + legacy_full allowed; manager, planner, stranger denied", "DB via PostgREST (create_purchase_intent)", "ALLOWED/ALLOWED/denied/denied/denied", JSON.stringify(d) + "; levels with start_purchase: " + caps, d.owner === "ALLOWED" && d.legacy_full === "ALLOWED" && ![d.manager, d.planner, d.stranger].includes("ALLOWED") && [d.manager, d.planner, d.stranger].every(x => /not your gathering/.test(x)));
const plus = await rpc(jwt(P), "create_purchase_intent", { p_canonical_product_id: "plus_annual", p_gathering_id: null });
check("D-2", "account-level Plus purchase intent is not gated by gathering capability (any signed-in user)", "DB via PostgREST", "intent id returned", plus.error ? JSON.stringify(plus.error) : "id returned", !plus.error && !!plus.data);
const webCheckout = sql("select 1");
// ---------- (e)
const GD = mkG(O, "current_date-10"), GC = mkG(O, "current_date+20"); addMember(GD, L, "legacy_full"); addMember(GD, M, "manager"); addMember(GD, P, "planner");
const cres = await rpc(jwt(O), "cancel_gathering", { p_gathering_id: GC, p_cancellation_message: "e3 cancel" });
const eff = (g) => sql(`select effective_gathering_status('${g}')`);
check("E-0", "fixtures: completed (10 days ago), cancelled, active", "DB", "completed/cancelled/active", `${eff(GD)}/${eff(GC)}/${eff(GA)}`, `${eff(GD)}/${eff(GC)}/${eff(GA)}` === "completed/cancelled/active");
const ro = (r) => /gathering_read_only/.test(r);
const tryTbl = (who, g, q) => { const r = asRole("authenticated", who, q.replace(/%G/g, g), { commit: false }); return r.ok ? "WRITTEN" : (ro(r.err) ? "READ_ONLY" : r.err.slice(0, 60)); };
const probes = { menu: `insert into menu_items(gathering_id,name,category) values ('%G','x','main')`, shopping: `insert into shopping_items(gathering_id,name,category) values ('%G','x','Other')`, budget: `insert into gathering_expenses(gathering_id,amount,expense_date,created_by) values ('%G',5,current_date,'${O}')`, invitation: `insert into invitation_parties(gathering_id,party_name) values ('%G','Party')` };
const matrix = {}; for (const [lab, g] of [["completed", GD], ["cancelled", GC], ["active", GA]]) for (const [who, u] of [["owner", O], ["legacy_full", L]]) { if (lab !== "active" || who === "owner") for (const [k, q] of Object.entries(probes)) matrix[`${lab}/${who}/${k}`] = tryTbl(u, g, q); }
// co-host rows exist only on GD/GA; GC has no members: owner only there
const bad = Object.entries(matrix).filter(([k, v]) => k.startsWith("active") ? v === "READ_ONLY" : (k.includes("cancelled/legacy") ? false : v !== "READ_ONLY"));
check("E-1", "completed and cancelled gatherings: menus, shopping, budget (expenses) and invitations are READ-ONLY for owner and co-host; the same writes are not refused by the guard on an active gathering", "DB (authenticated role, JWT simulated)", "READ_ONLY everywhere on completed/cancelled", JSON.stringify(matrix), bad.length === 0, "cancelled/legacy_full has no membership row; unauthorised there");
const rp = {}; for (const [lab, g] of [["completed", GD], ["cancelled", GC]]) { const a = await rpc(jwt(O), "menu_add_item", { p_gathering_id: g, p_name: "x", p_category: "protein", p_notes: null }); rp[lab] = a.error?.message ?? "OK"; }
check("E-1b", "RPC path (menu_add_item) refused with gathering_read_only on completed and cancelled", "DB via PostgREST", "gathering_read_only x2", JSON.stringify(rp), Object.values(rp).every(v => /gathering_read_only/.test(v)));
// photo window through the real RPC (member, authenticated)
const G10 = GD, G29 = mkG(O, "current_date-29"), G31 = mkG(O, "current_date-31");
const photo = async (u, g) => { const r = await rpc(jwt(u), "add_gathering_photo", { p_gathering_id: g, p_storage_path: `${g}/${uuid()}.jpg`, p_mime_type: "image/jpeg", p_caption: null }); return r.error ? (r.error.message ?? r.error.code) : "UPLOADED"; };
const ph = { day10_owner: await photo(O, G10), day29_owner: await photo(O, G29), day31_owner: await photo(O, G31), day10_stranger: await photo(S, G10), cancelled_owner: await photo(O, GC) };
check("E-2", "guest-photo window: authorised member uploads are accepted on a completed gathering inside the 30-day window (day 10, day 29); refused after it (day 31) and on a cancelled gathering; a non-member is refused inside the window", "DB via PostgREST (add_gathering_photo)", "UPLOADED/UPLOADED/refused/not_authorized/refused", JSON.stringify(ph), ph.day10_owner === "UPLOADED" && ph.day29_owner === "UPLOADED" && ph.day31_owner !== "UPLOADED" && /not_authorized/.test(ph.day10_stranger) && ph.cancelled_owner !== "UPLOADED");
// only photos are exempt: other writes still refused in the window
const inWin = tryTbl(O, G10, probes.menu) + "/" + tryTbl(O, G10, probes.budget);
check("E-3", "inside the photo window ONLY photos are writable; menus and budget on the same completed gathering stay read-only", "DB", "READ_ONLY/READ_ONLY", inWin, inWin === "READ_ONLY/READ_ONLY");
// exact boundary at trigger level: ends_at = now() +/- 1 microsecond (single transaction => now() is fixed)
const bnd = sql(`do $$ declare g uuid; r text; ts timestamp; d interval; res text := ''; begin
  foreach d in array array[interval '-1 microsecond', interval '0', interval '1 microsecond', interval '1 second'] loop
    g := gen_random_uuid(); ts := (now() at time zone 'UTC') + d - interval '30 days';
    insert into public.gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time,timezone) values (g,'${O}','b','dinner',ts::date,ts::time,'UTC');
    update public.gatherings set status='active' where id=g;
    begin insert into public.gathering_photos(gathering_id,storage_path,expires_at,uploaded_by_user_id) values (g,g::text||'/p.jpg',now()+interval '1 day','${O}'); r := 'OPEN'; rollback_dummy: begin end;
    exception when others then r := case when sqlerrm='gathering_read_only' then 'CLOSED' else 'ERR '||sqlerrm end; end;
    res := res || d::text || '=' || r || '; ';
  end loop;
  create temp table if not exists e3_bnd(x text); insert into e3_bnd values (res);
end $$; select x from e3_bnd;`.replace("rollback_dummy: begin end;", ""));
check("E-4", "30-day boundary at the microsecond: window end = start+30d. 1us before end = still open? no: now() < end is required: end-1us... (cases are end = now()+d)", "DB (trigger, single transaction)", "d=-1us CLOSED; d=0 CLOSED (exactly 30 days is closed); d=+1us OPEN; +1s OPEN", bnd, /-00:00:00.000001=CLOSED/.test(bnd) && /00:00:00=CLOSED/.test(bnd) && /00:00:00.000001=OPEN/.test(bnd) && /00:00:01=OPEN/.test(bnd));
// guest_update_receipts: works on ACTIVE gatherings (the 202100 defect 42703 on every receipt write), refused on completed/cancelled
const mkReceiptFixture = (g) => { const up = uuid(), pt = uuid(); sql(`insert into guest_updates(id,gathering_id,author_user_id,title,body) values('${up}','${g}','${O}','t','b')`); sql(`insert into invitation_parties(id,gathering_id,party_name) values('${pt}','${g}','Party')`); return [up, pt]; };
const fx = {}; for (const [lab, g] of [["active", GA], ["completed", GD], ["cancelled", GC]]) fx[lab] = mkReceiptFixture(g);
const rc = {}; for (const lab of ["active", "completed", "cancelled"]) { const [up, pt] = fx[lab]; for (const [who, role, u] of [["owner", "authenticated", O], ["service", "service_role", null]]) { const r = asRole(role, u, `insert into guest_update_receipts(guest_update_id,invitation_party_id) values ('${up}','${pt}')`, { commit: lab === "active" && who === "owner" }); rc[`${lab}/${who}`] = r.ok ? "WRITTEN" : (ro(r.err) ? "READ_ONLY" : r.err.slice(0, 70)); } }
sql(`insert into guest_update_receipts(guest_update_id,invitation_party_id) values ('${fx.active[0]}','${fx.active[1]}')`);
const upd = asRole("service_role", null, `update guest_update_receipts set acknowledged_at=now() where guest_update_id='${fx.active[0]}'`, { commit: false });
const updDone = sql(`select count(*) from guest_update_receipts where guest_update_id='${fx.active[0]}'`);
check("E-5", "guest_update_receipts: insert/update WORK on an active gathering (owner and service role); refused gathering_read_only on completed and cancelled", "DB", "active: service WRITTEN + update ok (owner may be RLS-denied: owner is not a guest, but NOT read-only); completed/cancelled READ_ONLY", JSON.stringify(rc) + "; update_active=" + (upd.ok ? "ok" : upd.err), !/READ_ONLY/.test(rc["active/owner"]) && rc["active/service"] === "WRITTEN" && upd.ok && ["completed", "cancelled"].every(l => rc[`${l}/owner`] === "READ_ONLY" && rc[`${l}/service`] === "READ_ONLY"));
// ---------- (g) SMS fail-closed
const so = (q) => sqlErr(q);
const GS = GA;
const ins = (status, key) => `insert into sms_messages(gathering_id,sender_user_id,phone_hash,phone_last4,template_kind,template_version,body,encoding,segments,idempotency_key,status) values ('${GS}','${O}','h_${key}','1234','invitation','v1','hello','GSM-7',1,'k_${key}','${status}')`;
const supp = (ch) => sql(`select set_config('request.jwt.claims','{"role":"service_role"}',false) is not null; select public.is_contact_suppressed('${ch}','hash_unknown_e3')`).split("\n").pop();
const asSvc = (q) => asRole("service_role", null, q, { commit: false });
const G0 = { cfg: sql("select (select value::text from sms_config where key='sms_enabled')||'/'||(select value::text from sms_config where key='kill_switch')"), queued: so(ins("queued", "a")), sending: so(ins("sending", "b")), sup: asSvc("select public.is_contact_suppressed('sms','hash_unknown_e3')").out, emailSup: asSvc("select public.is_contact_suppressed('email','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')").out, fnExists: sql("select count(*) from pg_proc where proname='sms_is_suppressed'") };
check("G-1", "defaults (sms_enabled=false, kill_switch=true; sms_is_suppressed does not exist): queued/sending inserts refused; is_contact_suppressed('sms') = true; email = false", "DB", "sms_unavailable x2; sms true; email false", JSON.stringify(G0), /sms_unavailable/.test(G0.queued) && /sms_unavailable/.test(G0.sending) && G0.sup === "t" && G0.emailSup === "f");
try { sql(`insert into email_suppressions(address_hash,state,reason) values ('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','suppressed','manual')`); } catch (e) { console.log("email suppression seed:", e.message.slice(0, 120)); }
const emailSupd = () => asSvc("select public.is_contact_suppressed('email','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')").out;
const emailBaseline = G0.emailSup + "/" + emailSupd();
// make SMS "look enabled" in scratch ONLY to prove the second gate (suppression) fails closed
sql("update sms_config set value='true'::jsonb where key='sms_enabled'"); sql("update sms_config set value='false'::jsonb where key='kill_switch'");
const T1 = { noFn: so(ins("queued", "c")), noFnSup: asSvc("select public.is_contact_suppressed('sms','hash_unknown_e3')").out, noFnSending: so(ins("sending", "d")) };
sql("create function public.sms_is_suppressed(text) returns boolean language plpgsql as $$ begin raise exception 'boom'; end $$");
const T2 = { raises: so(ins("queued", "e")), sup: asSvc("select public.is_contact_suppressed('sms','hash_unknown_e3')").out };
sql("create or replace function public.sms_is_suppressed(text) returns boolean language sql as $$ select null::boolean $$");
const T3 = { returnsNull: so(ins("queued", "f")), sup: asSvc("select public.is_contact_suppressed('sms','hash_unknown_e3')").out };
check("G-2", "config says ENABLED but suppression function is missing / raises / returns NULL: SMS still fully suppressed (queue refused, is_contact_suppressed('sms') = true)", "DB (scratch-only config flip)", "all refused (sms_recipient_suppressed), sup=t", JSON.stringify({ T1, T2, T3 }), [T1.noFn, T1.noFnSending, T2.raises, T3.returnsNull].every(x => /sms_recipient_suppressed|sms_unavailable/.test(x)) && [T1.noFnSup, T2.sup, T3.sup].every(x => x === "t"));
sql("drop function public.sms_is_suppressed(text)");
sql("delete from sms_config where key in ('sms_enabled','kill_switch')");
const T4 = { rowsDeleted: so(ins("queued", "g")), sending: so(ins("sending", "h")), sup: asSvc("select public.is_contact_suppressed('sms','hash_unknown_e3')").out };
check("G-3", "sms_config rows deleted: queue/claim refused, still suppressed", "DB", "sms_unavailable", JSON.stringify(T4), /sms_unavailable/.test(T4.rowsDeleted) && /sms_unavailable/.test(T4.sending) && T4.sup === "t");
sql("update sms_config set value='true'::jsonb where false"); // no-op
sql("insert into sms_config(key,value) values ('sms_enabled','\"maybe\"'::jsonb),('kill_switch','false'::jsonb)");
const T5 = { garbage: so(ins("queued", "i")) };
sql("delete from sms_config where key in ('sms_enabled','kill_switch')");
// claim path: a row that exists as blocked cannot be moved to 'sending'; a row queued earlier cannot be claimed once disabled
sql("insert into sms_config(key,value) values ('sms_enabled','true'::jsonb),('kill_switch','false'::jsonb)");
sql("create function public.sms_is_suppressed(text) returns boolean language sql as $$ select false $$");
const okIns = so(ins("queued", "j"));   // gates open (scratch contrast case, proves the guard is not blanket-denying)
sql("delete from sms_config"); sql("insert into sms_config(key,value) values ('sms_enabled','false'::jsonb),('kill_switch','true'::jsonb)");
const claim = so("update sms_messages set status='sending' where idempotency_key='k_j'");
sql("drop function public.sms_is_suppressed(text)");
check("G-4", "unparseable config value is OFF; claim (queued->sending) is refused once SMS is off; scratch contrast: with every gate explicitly open a row can queue (guard is not a blanket block)", "DB", "garbage refused; contrast insert allowed(null); claim refused", `garbage=${T5.garbage}; contrast_insert=${okIns}; claim=${claim}`, /sms_unavailable/.test(T5.garbage) && okIns === null && /sms_unavailable/.test(claim));
// defaults restored (scratch) and final tally
sql("delete from sms_config where key in ('sms_enabled','kill_switch')"); sql("insert into sms_config(key,value) values ('sms_enabled','false'::jsonb),('kill_switch','true'::jsonb)");
const deliverable = sql("select count(*) from sms_messages where status in ('queued','sending')");
const emailAfter = asSvc("select public.is_contact_suppressed('email','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')").out + "/" + emailSupd();
check("G-5", "after all manipulations: deliverable SMS rows = 1 only from the explicit contrast case (queued under all-gates-open) -> then defaults restored and claim refused; email suppression result unchanged throughout", "DB", `deliverable=1 (contrast row, can never be claimed); email ${emailBaseline} unchanged`, `deliverable=${deliverable}; email_before=${emailBaseline}; email_after=${emailAfter}`, deliverable === "1" && emailAfter === emailBaseline, "the single queued row is the scratch contrast row; defaults restored; claim path refused (G-4)");
const defRows = sql("select count(*) from sms_messages where status in ('queued','sending')");
console.log("deliverable now", defRows);
summary();
