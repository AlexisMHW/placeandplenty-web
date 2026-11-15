// Scenario E: completed/cancelled gatherings are read-only for every gathering-scoped write: DB triggers (migration 202100) and REAL web host actions.
import { check, sql, sqlErr, addUser, jwt, rpc, summary, uuid, asRole } from "./lib.mjs";
import { form, cnt } from "./fixtures_lite.mjs";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54481"; globalThis.__e2eAnon = jwt(undefined, "anon");
const O = addUser("host.owner@e2e.test"), C = addUser("host.cohost@e2e.test"), S = addUser("stranger@e2e.test");
sql(`insert into gathering_entitlements(user_id,scope,entitlement_type,canonical_product_id,provider,environment,provider_transaction_id,expires_at) values('${O}','account','plus','plus_annual','web','production','plus_e2e_owner', now()+interval '300 days')`);
const mkG = (name, status, dateOffset, completed = false) => { const id = uuid(); sql(`insert into gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time,status,timezone) values('${id}','${O}','${name}','dinner',current_date+(${dateOffset}),'18:00','draft','UTC')`); if (status !== 'draft') sql(`update gatherings set status='${status}' where id='${id}'`); return id; };
const GL = mkG("Live", "active", 30), GD = mkG("Done", "active", 30), GC = mkG("Cancelled", "active", 30);
for (const g of [GL, GD, GC]) sql(`insert into gathering_members(gathering_id,user_id,invited_email,status,accepted_at,permission_level) values('${g}','${C}','host.cohost@e2e.test','accepted',now(),'planner')`);
// seed child rows while live (as table owner, no uid -> trigger passes), then move the gatherings to terminal states
const seed = (g) => { sql(`insert into menu_items(gathering_id,name,category) values('${g}','Seed dish','main')`); sql(`insert into shopping_items(gathering_id,name,category) values('${g}','Seed item','Other')`).toString(); };
for (const g of [GL, GD, GC]) { try { seed(g); } catch (e) { console.log("seed note:", e.message.slice(0, 160)); } }
try { sql(`insert into gathering_expenses(gathering_id,amount,expense_date,created_by) values('${GD}',5,current_date,'${O}')`); } catch (e) { console.log("expense seed:", e.message.slice(0, 120)); }
// terminal transitions (postgres, no uid: allowed)
sql(`update gatherings set gathering_date=current_date-10 where id='${GD}'`);
const cres = await rpc(jwt(O), 'cancel_gathering', { p_gathering_id: GC, p_cancellation_message: 'e2e cancel' }); if (cres.error) console.log('cancel_gathering error', JSON.stringify(cres.error).slice(0,200));
const eff = (g) => sql(`select effective_gathering_status('${g}')`);
check("E0", "fixtures: effective status live=active, done=completed, cancelled=cancelled; level=terminal", "DB", "active/completed/cancelled/terminal", `${eff(GL)}/${eff(GD)}/${eff(GC)}/${sql("select lifecycle_read_only_level()")}`, [eff(GL), eff(GD), eff(GC)].join("/") === "active/completed/cancelled" && sql("select lifecycle_read_only_level()") === "terminal");

// ---- E1 DB sweep: every table that carries the trigger, INSERT with only gathering_id (BEFORE trigger fires ahead of NOT NULL/FK/RLS-with-check)
const tables = sql(`select string_agg(distinct tgrelid::regclass::text, ',') from pg_trigger where tgfoid='enforce_terminal_read_only'::regproc and not tgisinternal and tgrelid::regclass::text <> 'gatherings'`).split(",");
const hasGid = (t) => sql(`select count(*) from information_schema.columns where table_schema='public' and table_name='${t.replace("public.", "")}' and column_name='gathering_id'`) === "1";
const results = {};
for (const [who, uid] of [["owner", O], ["co-host", C], ["stranger", S]]) {
  for (const [lab, g] of [["completed", GD], ["cancelled", GC], ["live", GL]]) {
    let blocked = 0, other = 0, total = 0; const odd = [];
    for (const t of tables) { if (!hasGid(t)) continue; total++;
      const r = asRole("authenticated", uid, `insert into ${t} (gathering_id) values ('${g}')`, { commit: false });
      if (!r.ok && /gathering_read_only/.test(r.err)) blocked++; else { other++; if (lab !== "live") odd.push(t + ":" + (r.ok ? "INSERTED" : r.err.slice(0, 50))); } }
    results[`${who}/${lab}`] = { total, blocked, other, odd }; } }
const KNOWN = (who, t) => t.startsWith("gathering_days") || t.startsWith("gathering_photos") || (who === "co-host" && t.startsWith("gathering_members"));
const unexpected = {}; for (const [k, v] of Object.entries(results)) { const [who, lab] = k.split("/"); if (lab === "live" || who === "stranger") continue; unexpected[k] = v.odd.filter(o => !KNOWN(who, o.split(":")[0])); }
const termOK = Object.values(unexpected).every(a => a.length === 0) && ["owner", "co-host"].every(w => ["completed", "cancelled"].every(l => results[`${w}/${l}`].blocked >= 23));
const strangerOK = ["completed", "cancelled"].every(l => results[`stranger/${l}`].odd.every(o => /not_authorized|gathering_read_only|^gathering_days/.test(o)));
const liveOK = ["owner", "co-host"].every(w => results[`${w}/live`].blocked === 0);
check("E1", "DB sweep: INSERT into every gathering-scoped table carrying the 202100 trigger is refused (gathering_read_only) for owner and co-host on completed AND cancelled gatherings; a non-member is refused too (not_authorized from the status check); the same insert on a LIVE gathering is never refused by that trigger", "DB (authenticated role, simulated JWT)", `${tables.length} triggered tables: only known exceptions unblocked (gathering_days: other trigger fires first; gathering_photos: documented 'photos' exception on completed; co-host gathering_members: RLS)`, JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, `${v.blocked}/${v.total} gathering_read_only` + (v.odd.length ? " | other: " + [...new Set(v.odd.map(o => o.slice(0, 60)))].slice(0, 4).join(" ; ") : "")]))), termOK && strangerOK && liveOK);
const photos = results["owner/completed"].odd.find(o => o.startsWith("gathering_photos")), photosC = results["owner/cancelled"].odd.find(o => o.startsWith("gathering_photos"));
check("E1b", "gathering_photos: writable on COMPLETED gatherings (documented 'photos' class exception, open founder item) but blocked on CANCELLED", "DB (authenticated owner)", "D2 says no exceptions; observed exception for completed only", `completed: ${photos ?? "blocked"}; cancelled: ${photosC ?? "blocked"}`, photos && !photosC ? "PARTIAL" : !photos, "founder decision pending (REPORT_a8: photos exception)");
// ---- E2 UPDATE / DELETE on real rows
const upd = {};
for (const [lab, g] of [["completed", GD], ["cancelled", GC], ["live", GL]]) for (const [who, uid] of [["owner", O], ["co-host", C]]) {
  upd[`${who}/${lab}`] = ["menu_items set name='Edited' ", "shopping_items set name='Edited' ", "gatherings set name='Renamed' "].map(q => { const tbl = q.split(" ")[0]; const wh = tbl === "gatherings" ? `id='${g}'` : `gathering_id='${g}'`; const r = asRole("authenticated", uid, `update ${q} where ${wh}`, { commit: false }); return r.ok ? "ok" : (/gathering_read_only/.test(r.err) ? "READ_ONLY" : r.err.slice(0, 40)); }).join(",");
  upd[`${who}/${lab}/delete`] = ["menu_items", "shopping_items"].map(tb => { const r = asRole("authenticated", uid, `delete from ${tb} where gathering_id='${g}'`, { commit: false }); return r.ok ? "ok" : (/gathering_read_only/.test(r.err) ? "READ_ONLY" : r.err.slice(0, 40)); }).join(","); }
check("E2", "UPDATE and DELETE of real rows (menu, shopping, the gathering row itself): READ_ONLY for owner and co-host on completed/cancelled; allowed on the live control", "DB (authenticated role)", "READ_ONLY x3 / x2 on terminal; ok on live", JSON.stringify(upd), Object.entries(upd).every(([k, v]) => k.includes("/live") ? !/READ_ONLY/.test(v) : !/ok/.test(v) && v.includes("READ_ONLY")));
// lifecycle ops still allowed (archive / gather-again are lifecycle) — observe cancel/complete RPC behaviour on completed gathering
const lifeOwner = asRole("authenticated", O, `select public.cancel_gathering('${GD}', 'late cancel')`, { commit: false });
// ---- E3 service role behaviour
const svcMenu = asRole("service_role", null, `insert into menu_items(gathering_id,name,category) values ('${GD}','svc dish','main')`, { commit: false });
const svcStrict = asRole("service_role", null, `insert into gathering_guests (gathering_id) values ('${GD}')`, { commit: false });
check("E3", "service role (edge functions / jobs, no auth.uid): non-strict tables remain writable by design; STRICT guest tables (gathering_guests, contributions, rsvps, song requests...) still refuse", "DB (service_role)", "menu insert allowed (documented bypass); strict table refused gathering_read_only", `menu=${svcMenu.ok ? "allowed" : svcMenu.err}; strict=${svcStrict.ok ? "allowed" : svcStrict.err.slice(0, 80)}`, !svcStrict.ok && /gathering_read_only/.test(svcStrict.err), "service-role bypass on non-strict tables is by design (D2 says 'no new exceptions'); noted in report");
// ---- E4 RPC path (what native + web use): menu_add_item / shopping_add_item
const rp = {};
for (const [lab, g] of [["completed", GD], ["cancelled", GC], ["live", GL]]) for (const [who, uid] of [["owner", O], ["co-host", C]]) {
  const r1 = await rpc(jwt(uid), "menu_add_item", { p_gathering_id: g, p_name: "RPC dish", p_category: "protein", p_notes: null });
  const r2 = await rpc(jwt(uid), "shopping_add_item", { p_gathering_id: g, p_name: "RPC item", p_category: "Other", p_quantity: 1, p_unit: null, p_estimated_cost: null, p_linked_menu_item_id: null, p_source: "web" });
  rp[`${who}/${lab}`] = `${r1.error ? (r1.error.message ?? r1.error.code) : "ok"} | ${r2.error ? (r2.error.message ?? r2.error.code) : "ok"}`; }
check("E4", "RPCs used by web+native (menu_add_item, shopping_add_item) over PostgREST: refused on completed/cancelled for owner and co-host, accepted on live", "DB via PostgREST", "gathering_read_only on terminal; ok on live", JSON.stringify(rp), Object.entries(rp).every(([k, v]) => k.endsWith("live") ? v === "ok | ok" : /gathering_read_only/.test(v.split(" | ")[0]) && /gathering_read_only/.test(v.split(" | ")[1])));

// ---- E5 REAL web host actions
const hostActions = await import("../lib/host-actions.ts");
const menuActions = await import("../lib/menu-actions.ts");
const shopActions = await import("../lib/shopping-actions.ts");
const budgetActions = await import("../lib/budget-actions.ts");
const peopleActions = await import("../lib/people-actions.ts");
const contribActions = await import("../lib/contribution-actions.ts");
const snapshot = (g) => sql(`select md5(coalesce((select string_agg(x::text,'|' order by x::text) from (select id,name,category,servings_planned from menu_items where gathering_id='${g}') x),'')||coalesce((select string_agg(y::text,'|' order by y::text) from (select id,name,status from shopping_items where gathering_id='${g}') y),'')||coalesce((select string_agg(z::text,'|' order by z::text) from (select id,amount from gathering_expenses where gathering_id='${g}') z),'')||(select name||coalesce(notes,'')||coalesce(location_name,'')||status::text from gatherings where id='${g}')||(select count(*)::text from gathering_guests where gathering_id='${g}')||(select count(*)::text from gathering_members where gathering_id='${g}'))`);
const asUser = (u) => { globalThis.__e2eJwt = u ? jwt(u) : undefined; };
const fd = (o) => form(o);
const writes = [
  ["host.addMenuItem", (g) => hostActions.addMenuItem(g, fd({ name: "Web dish", category: "main", servings_planned: "4" }))],
  ["menu.addCanonicalMenuItemWeb", (g) => menuActions.addCanonicalMenuItemWeb(g, fd({ name: "Canon dish", category: "main" }))],
  ["host.addShoppingItem", (g) => hostActions.addShoppingItem(g, fd({ name: "Web item", category: "Other", quantity: "2" }))],
  ["shop.addCanonicalShoppingItemWeb", (g) => shopActions.addCanonicalShoppingItemWeb(g, fd({ name: "Canon item", category: "Other", quantity: "2" }))],
  ["budget.createExpenseWeb", (g) => budgetActions.createExpenseWeb(g, fd({ amount: "12.50", category: "food", merchant: "m" }))],
  ["budget.updateBudgetTargetWeb", (g) => budgetActions.updateBudgetTargetWeb(g, 500)],
  ["host.updateGatheringDetails", (g) => hostActions.updateGatheringDetails(g, fd({ name: "Renamed via web", location_name: "Loc", notes: "n" }))],
  ["host.removeCoHost", (g) => hostActions.removeCoHost(g, "00000000-0000-0000-0000-0000000000aa")],
  ["host.setCoHostPermission", (g) => hostActions.setCoHostPermission(g, "00000000-0000-0000-0000-0000000000aa", "viewer")],
  ["host.inviteCoHost", (g) => hostActions.inviteCoHost(g, fd({ email: "newcohost@e2e.test", permission_level: "planner" }))],
  ["people.addNewPersonToGatheringWeb", (g) => peopleActions.addNewPersonToGatheringWeb(g, fd({ first_name: "Pat", last_name: "Guest", email: "pg@e2e.test" }))],
  ["host.addContribution", (g) => hostActions.addContribution(g, fd({ item_name: "Salad", name: "Salad" }))],
  ["host.deleteMenuItem(any)", (g) => hostActions.deleteMenuItem(g, sql(`select id from menu_items where gathering_id='${g}' limit 1`) || "00000000-0000-0000-0000-0000000000bb")],
];
const live0 = {}; const matrix = [];
for (const [who, uid] of [["owner", O], ["co-host", C], ["direct non-member", S]]) for (const [lab, g] of [["completed", GD], ["cancelled", GC]]) {
  const before = snapshot(g); const outs = [];
  for (const [name, fn] of writes) { asUser(uid); let res; try { res = await fn(g); } catch (e) { res = { threw: e.message }; } outs.push([name, res?.ok === false ? "refused" : res?.ok === true ? "OK-WRITE" : "threw:" + (res?.threw ?? "?").slice(0, 50), res?.message?.slice(0, 40)]); }
  const after = snapshot(g); matrix.push({ who, lab, unchanged: before === after, notRefused: outs.filter(o => o[1] !== "refused").map(o => o.join(":")), msgs: [...new Set(outs.map(o => o[2]))] }); }
check("E5", "REAL web host actions on completed + cancelled gatherings for owner / co-host / direct non-member: every write refused and the database snapshot is byte-identical afterwards", "web action + DB (PostgREST)", "13 actions x 3 callers x 2 states all refused; DB unchanged", JSON.stringify(matrix.map(m => `${m.who}/${m.lab}: unchanged=${m.unchanged}${m.notRefused.length ? " NOT REFUSED " + m.notRefused.join(",") : ""}`)), matrix.every(m => m.unchanged && m.notRefused.length === 0));
console.log("E5 messages seen:", JSON.stringify([...new Set(matrix.flatMap(m => m.msgs))]));

// ---- E5b: sweep EVERY exported gathering-scoped web action (same module list and skip rules as tests/gathering-write-guard.test.ts), real DB
const SKIP = ["saveGatheringDraft", "finaliseGatheringCreation", "countGatheringInvitees", "recordShareInitiatedWeb", "acceptCoHostInvitation", "declineCoHostInvitation", "createGatheringWithDetails", "addGuestBookPerson", "updateGuestBookPerson", "setGuestSaved", "deleteGuestBookPerson", "addClosetItem", "updateClosetItem", "archiveClosetItem", "restoreClosetItem", "getMultiDayAccessState", "getMultiDayLockInGate", "getMultiDayPassStep", "finishMultiDayGathering", "checkSmartClosetWeb", "createHouseholdWeb"];
const MODS = ["menu-actions", "shopping-actions", "people-actions", "guest-experience-actions", "budget-actions", "contribution-actions", "gathering-photos-actions", "music-media-actions", "style-board-actions", "multi-day-actions", "recipe-source-actions", "host-actions"];
const formFor = () => { const f = new FormData(); for (const k of ["name", "title", "item_name", "first_name", "last_name", "notes", "category", "message", "body", "vendor", "description", "label", "amount", "quantity", "estimated_cost", "cost", "servings", "email", "contact_email", "date", "location", "provider", "kind", "visibility", "subject", "headline", "theme", "text", "url", "status"]) f.set(k, k.includes("email") ? "a@b.test" : /amount|quantity|cost|servings/.test(k) ? "4" : "x"); for (const k of ["photo", "file", "receipt", "image", "artwork"]) f.set(k, new File([new Uint8Array(16)], "a.png", { type: "image/png" })); return f; };
const pnames = (fn) => { const m = fn.toString().match(/^(?:async\s+)?function\s*\w*\s*\(([\s\S]*?)\)\s*\{/); return m ? m[1].split(",").map(x => x.replace(/=[\s\S]*$/, "").trim()).filter(Boolean) : []; };
const argsFor = (fn, g) => { const ns = pnames(fn); if (ns.length === 1 && /^(input|args|params|opts)$/.test(ns[0])) return [{ gatheringId: g, needName: "x", needQuantity: 1, closetItemId: uuid(), action: "yes", category: null, occasion: "x", theme: "x", moodDescriptors: [], visionNotes: "x" }];
  return ns.map((n, i) => i === 0 ? g : /form/i.test(n) ? formFor() : /hidden|visible|returned|bool/i.test(n) ? true : /titles|tasks|list|items/i.test(n) ? ["x"] : /^value$/.test(n) ? "guest:x" : /servings|days|total|count|amount|leftover/i.test(n) ? 4 : /^input$|^options?$|^data$/.test(n) ? { occasion: "x", theme: "x", moodDescriptors: [], visionNotes: "x" } : /ids?$/i.test(n) && /guest|visible/i.test(n) ? [] : "x"); };
const exportsAll = []; for (const m of MODS) { const mod = await import(`../lib/${m}.ts`); for (const [name, fn] of Object.entries(mod)) if (typeof fn === "function" && !SKIP.includes(name)) exportsAll.push([m, name, fn]); }
const sweep = {}; let nActs = exportsAll.length;
for (const [who, uid] of [["owner", O], ["co-host", C]]) for (const [lab, g] of [["completed", GD], ["cancelled", GC]]) {
  const before = snapshot(g); const bad = [];
  for (const [m, name, fn] of exportsAll) { asUser(uid); let res; try { res = await fn(...argsFor(fn, g)); } catch (e) { res = { threw: String(e.message).slice(0, 60) }; }
    if (res?.ok !== false) bad.push(`${m}.${name}:${res?.threw ? "threw " + res.threw : "ok=" + res?.ok}`); }
  sweep[`${who}/${lab}`] = { unchanged: snapshot(g) === before, notRefused: bad }; }
check("E5b", `sweep of ALL ${nActs} exported gathering-scoped web actions (menu, shopping, people, guest-experience, budget, contributions, photos, music, style, multi-day, recipe, host) against the real DB for owner and co-host on completed + cancelled`, "web action + DB (PostgREST)", "every action returns ok:false; DB snapshot unchanged", JSON.stringify(Object.fromEntries(Object.entries(sweep).map(([k, v]) => [k, `unchanged=${v.unchanged}; not refused: ${v.notRefused.join(", ") || "none"}`]))), Object.values(sweep).every(v => v.unchanged && v.notRefused.length === 0));

// control on live gathering as owner and co-host
const ctrl = []; const cohostMsg = [];
for (const [who, uid] of [["owner", O], ["co-host", C]]) { const before = snapshot(GL); asUser(uid);
  const a = await hostActions.addMenuItem(GL, fd({ name: `Live dish ${who}`, category: "main", servings_planned: "4" })); const b = await shopActions.addCanonicalShoppingItemWeb(GL, fd({ name: `Live item ${who}`, category: "Other", quantity: "2" })); const c = await budgetActions.createExpenseWeb(GL, fd({ amount: "3", category: "food" }));
  ctrl.push(`${who}: ${a.ok}/${b.ok}/${c.ok} changed=${snapshot(GL) !== before}`); if (c.ok === false) cohostMsg.push(`${who} expense: ${c.message}`); }
check("E5c", "control: the same actions on a LIVE gathering succeed for owner and co-host (so E5 refusals are due to read-only, not a broken harness)", "web action + DB", "ok/ok/ok and DB changed", ctrl.join("; "), ctrl.every(x => /^owner: true\/true\/true changed=true/.test(x) || /^co-host: true\/true\/(true|false) changed=true/.test(x)), cohostMsg.join(";"));
// the guard's ordering: bypass the guard to show the DB alone still stops the write (supabase-js direct as owner / co-host)
const { createClient } = await import("./stubs/supabase-server.mjs");
const direct = [];
for (const [who, uid] of [["owner", O], ["co-host", C]]) { asUser(uid); const sb = createClient();
  const r = await sb.from("menu_items").insert({ gathering_id: GD, name: "bypass", category: "main" }).select("id"); const r2 = await sb.from("gatherings").update({ name: "bypass" }).eq("id", GC).select("id");
  direct.push(`${who}: insert=${r.error?.message ?? "ok(" + r.data?.length + ")"} update=${r2.error?.message ?? "ok(" + (r2.data?.length ?? 0) + " rows)"}`); }
check("E6", "guard bypassed: supabase-js writes straight to tables on completed/cancelled gatherings are still refused by the DB (gathering_read_only) for owner and co-host", "DB via PostgREST (supabase-js)", "gathering_read_only for inserts; update refused (read-only or not_authorized for co-host)", direct.join("; "), direct.every(d => /insert=gathering_read_only/.test(d) && /update=(gathering_read_only|not_authorized)/.test(d)), "co-host cannot update the gatherings row at all (RLS/owner-only), insert refused by 202100");
// lifecycle exceptions
check("E7", "OBSERVATION: owner cancel_gathering on a COMPLETED gathering (lifecycle op)", "DB (authenticated owner)", "documented: lifecycle ops are not blocked by the trigger marker", lifeOwner.ok ? "allowed" : lifeOwner.err.slice(0, 100), "PARTIAL", "informational");
summary();
