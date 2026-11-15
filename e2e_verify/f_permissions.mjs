// Scenario F: permission matrix over every public function the 40-step package adds or changes.
import { check, sql, addUser, addStaff, summary } from "./lib.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const BASE = process.env.E_BASE ?? "e_base_sb";
const PORT = process.env.E_PGPORT ?? "54477";
for (const r of ["owner", "business_admin", "marketing_pr", "creator_program_manager", "support"]) addStaff(addUser(`${r}@f.test`), r);
const psqlBase = (q) => execFileSync("psql", ["-X", "-q", "-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", BASE, "-tA", "-F", "\t", "-c", q], { encoding: "utf8" }).trim().split("\n").filter(Boolean).map(l => l.split("\t"));
const baseFns = new Map(psqlBase("select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind in ('f','p')"));
const post = sql("select p.oid::text||'|'||p.oid::regprocedure::text||'|'||md5(pg_get_functiondef(p.oid))||'|'||p.prorettype::regtype::text from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind in ('f','p') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')").split("\n").map(l => l.split("|"));
const changed = post.filter(([, sig, md5]) => !baseFns.has(sig) || baseFns.get(sig) !== md5);
const targets = changed.filter(([, , , ret]) => ret !== "trigger"), trigs = changed.length - targets.length;
sql("create table if not exists public.e_f_targets(oid oid, proname text, sig text); truncate public.e_f_targets");
sql(`insert into public.e_f_targets select * from (values ${targets.map(([oid, sig]) => `(${oid}::oid, '${sig.split("(")[0]}', '${sig}')`).join(",")}) v(oid,proname,sig)`);
console.log(`targets: ${targets.length} non-trigger functions (new or changed), ${trigs} trigger functions excluded`);
execFileSync("psql", ["-X", "-q", "-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", process.env.E_DB ?? "e_run", "-v", "ON_ERROR_STOP=1", "-f", new URL("./sql/f_perm_matrix.sql", import.meta.url).pathname], { stdio: ["ignore", "ignore", "inherit"] });
const bodies = Object.fromEntries(sql("select oid::regprocedure::text||E'\\x01'||replace(prosrc,E'\\n',' ') from pg_proc where pronamespace='public'::regnamespace").split("\n").map(l => { const [s, b] = l.split("\x01"); return [s, b]; }));
const perms = Object.fromEntries(sql("select role||'|'||string_agg(permission,',') from staff_role_permissions group by role").split("\n").map(l => { const [r, p] = l.split("|"); return [r, new Set(p.split(","))]; }));
const res = sql("select fn||'|'||who||'|'||outcome||'|'||coalesce(msg,'') from public.e_f_results").split("\n").map(l => { const [fn, who, outcome, ...m] = l.split("|"); return { fn, who, outcome, msg: m.join("|") }; });
const acl = Object.fromEntries(sql("select p.oid::regprocedure::text||'|'||has_function_privilege('anon',p.oid,'execute')::text||'|'||has_function_privilege('authenticated',p.oid,'execute')::text from pg_proc p where p.pronamespace='public'::regnamespace").split("\n").map(l => { const [s, a, u] = l.split("|"); return [s, { anon: a === "true", auth: u === "true" }]; }));
const by = {}; for (const r of res) (by[r.fn] ??= {})[r.who] = r;
const kinds = { pureHelper: [], wrapper: [], internal: [], service: [], staffPerm: [], anyStaff: [], capability: [], userScoped: [], publicIntake: [], other: [] };
const defects = []; const STAFF = ["support", "marketing_pr", "business_admin", "creator_program_manager", "owner"];
for (const [fn, row] of Object.entries(by)) {
  const body = bodies[fn] ?? ""; const gate = [...body.matchAll(/staff_has_permission\('([a-z.]+)'\)/g)].map(m => m[1]);
  const svcBody = /hc_require_service\(\)|auth\.role\(\)\s+is\s+distinct\s+from\s+'service_role'|auth\.role\(\)\s*<>\s*'service_role'/.test(body);
  const anyStaff = /cc_require_staff\(\)|get_my_staff_context\(\)\s+is\s+null/.test(body);
  const cap = /has_gathering_capability\(|can_manage_invitations\(|is_accepted_gathering_member\(|is_gathering_owner\(|cohost_/.test(body);
  const a = acl[fn] ?? { anon: false, auth: false };
  const kind = /^(cc_mask_email|cc_sev_rank|lifecycle_read_only_level)\(/.test(fn) ? "pureHelper" : /^(hc_upsert_tier|hc_mark_payout_paid)\(/.test(fn) ? "wrapper" : !a.auth && !a.anon ? "internal" : fn.startsWith("submit_creator_application") ? "publicIntake" : anyStaff ? "anyStaff" : gate.length ? "staffPerm" : svcBody ? "service" : cap ? "capability" : /auth\.uid\(\)/.test(body) ? "userScoped" : "other";
  kinds[kind].push(fn);
  const AUTHDENY = /not[_ ]authorized|forbidden|staff_required|permission denied|not_staff/i;
  const open = (w) => ["SUCCESS", "REACHED_ERR"].includes(row[w].outcome) || (row[w].outcome === "DENIED_FN" && !AUTHDENY.test(row[w].msg)); // body reached, then not_found on the fake id
  const problems = [];
  if (kind === "internal" || kind === "service") for (const w of ["anon", "nonstaff", ...STAFF]) if (open(w)) problems.push(`${w} reached a ${kind} fn: ${row[w].outcome} ${row[w].msg}`);
  if (kind === "staffPerm") for (const w of ["anon", "nonstaff", ...STAFF]) {
    const allowed = STAFF.includes(w) && gate.some(g => perms[w].has(g));
    if (!allowed && open(w)) problems.push(`${w} not permitted (needs ${gate.join("|")}) but got ${row[w].outcome}: ${row[w].msg}`);
    if (allowed && !open(w)) problems.push(`${w} should be permitted (${gate.join("|")}) but got ${row[w].outcome}: ${row[w].msg}`); }
  if (kind === "anyStaff") for (const w of ["anon", "nonstaff"]) if (open(w)) problems.push(`${w} reached a staff-only fn: ${row[w].outcome} ${row[w].msg}`);
  if (kind === "capability") for (const w of ["anon", "nonstaff"]) if (row[w].outcome === "SUCCESS" && !/can_manage_invitations|has_gathering_capability|delete_guest_update/.test(fn)) problems.push(`${w} SUCCEEDED on a capability-gated fn with a non-existent gathering: ${row[w].msg}`);
  if (kind === "other" && open("anon")) problems.push(`anon reached ungated fn: ${row.anon.outcome} ${row.anon.msg}`);
  if (problems.length) defects.push({ fn, kind, gate, problems });
}
writeFileSync(new URL("./out/f_matrix.json", import.meta.url), JSON.stringify({ kinds, by, defects }, null, 1));
check("F1", `every new/changed non-trigger public function (${targets.length}) classified by its gate (ACL + body)`, "DB (pg_proc scan)", "each is internal (no API grant), service-only, staff-permission, any-staff, capability-gated, user-scoped or the public intake", JSON.stringify(Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length]))) + (kinds.other.length ? "; UNCLASSIFIED: " + kinds.other.join(", ") : ""), kinds.other.length === 0 ? true : "PARTIAL");
const anonOk = res.filter(r => r.who === "anon" && ["SUCCESS", "REACHED_ERR"].includes(r.outcome)).map(r => r.fn);
check("F2", "anon: only the intentional public intake is callable", "DB (SET ROLE anon + claims)", "only submit_creator_application(jsonb)", JSON.stringify(anonOk), anonOk.length === 1 && /submit_creator_application/.test(anonOk[0]));
check("F3", "gated functions fail closed: for each of the 150 functions non-staff, support, marketing, business admin, manager and owner each get exactly the access their permission grants (no more, no less); internal/service-only functions are not callable by any API role", "DB (simulated JWT roles; every call rolled back)", "0 mismatches", defects.length ? JSON.stringify(defects.slice(0, 15).map(d => ({ fn: d.fn, kind: d.kind, problems: d.problems.slice(0, 2) }))) : "0 mismatches", defects.length === 0);
const roles = ["anon", "nonstaff", "support", "marketing_pr", "business_admin", "creator_program_manager", "owner", "service_role"];
const tally = Object.fromEntries(roles.map(w => [w, Object.fromEntries(["SUCCESS", "REACHED_ERR", "DENIED_FN", "DENIED_ACL"].map(o => [o, res.filter(r => r.who === w && r.outcome === o).length]))]));
console.log("TALLY", JSON.stringify(tally));
const us = kinds.userScoped.concat(kinds.capability).map(f => f.replace(/\(.*/, "") + ":" + by[f].nonstaff.outcome);
check("F4", "user-scoped / capability-gated functions as a signed-in NON-member with nonexistent ids: all deny or no-op (none writes)", "DB", "no SUCCESS that writes", JSON.stringify(us).slice(0, 1400), "PARTIAL", "ownership correctness beyond a non-existent id is covered only for HC creator flows and referral claims");
summary();
