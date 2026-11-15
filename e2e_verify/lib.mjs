// Shared driver for the E2E verifier. LOCAL scratch Postgres (unix socket) + local PostgREST on 127.0.0.1 only.
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";

export const PORT = process.env.E_PGPORT ?? "54477";
export const DB = process.env.E_DB ?? "e_run";
export const REST = "http://127.0.0.1:54480";
const SECRET = readFileSync("/tmp/e_jwt_secret", "utf8").trim();
const OUT = process.env.E_OUT ?? new URL("./out/results.jsonl", import.meta.url).pathname;

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
export function jwt(sub, role = "authenticated", email) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, role, email, aud: "authenticated", iat: now, exp: now + 3600 });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
export const ANON = () => jwt(undefined, "anon");
export const SERVICE = () => jwt(undefined, "service_role");

/** Run SQL as postgres (fixtures / assertions). Returns trimmed stdout (tuples only, '|' separated). */
export function sql(text, db = DB) {
  try {
    return execFileSync("psql", ["-X", "-q", "-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", db, "-tA", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", text], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) { throw new Error(`SQL failed: ${String(e.stderr).split("\n")[0]} :: ${text.slice(0, 120)}`); }
}
/** Run SQL that is EXPECTED to fail; returns the error message. */
export function sqlErr(text, db = DB) {
  try { execFileSync("psql", ["-X", "-q", "-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", db, "-tA", "-v", "ON_ERROR_STOP=1", "-c", text], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); return null; }
  catch (e) { return String(e.stderr).split("\n")[0].replace(/^psql:.*?ERROR:\s*/, ""); }
}
/** Run SQL as a simulated Supabase caller inside ONE transaction (role + request.jwt.claims). Returns {ok,out|err}. */
export function asRole(role, sub, text, { db = DB, commit = true } = {}) {
  const claims = JSON.stringify(sub ? { sub, role, aud: "authenticated" } : { role });
  const script = `begin; set local role ${role}; select set_config('request.jwt.claims', '${claims}', true); ${text}; ${commit ? "commit" : "rollback"};`;
  try {
    const out = execFileSync("psql", ["-X", "-q", "-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", db, "-tA", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c", script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out: out.trim().split("\n").filter(l => l && !l.startsWith("{\"sub\"") && !l.startsWith("{\"role\"")).pop() ?? "" };
  } catch (e) { return { ok: false, err: String(e.stderr).split("\n")[0].replace(/^psql:.*?ERROR:\s*/, "") }; }
}
/** Call an RPC through the REAL PostgREST (same path as supabase-js). */
export async function rpc(token, fn, args = {}) {
  const r = await fetch(`${REST}/rpc/${fn}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: token }, body: JSON.stringify(args) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, data: r.ok ? j : null, error: r.ok ? null : j };
}

const rows = [];
export function check(id, scenario, layer, expected, observed, pass, note = "") {
  const rec = { id, scenario, layer, expected: String(expected), observed: String(observed), result: pass === "PARTIAL" ? "PARTIAL" : pass ? "PASS" : "FAIL", note };
  rows.push(rec); appendFileSync(OUT, JSON.stringify(rec) + "\n");
  console.log(`${rec.result.padEnd(7)} ${id} [${layer}] ${scenario}${rec.result === "PASS" ? "" : `\n         expected: ${rec.expected}\n         observed: ${rec.observed}`}`);
  return pass;
}
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const uuid = () => randomUUID();
export function summary() { const c = {}; for (const r of rows) c[r.result] = (c[r.result] ?? 0) + 1; console.log("SUMMARY", JSON.stringify(c)); return c; }

/** fixture helpers */
export const addUser = (email, { confirmed = true } = {}) => { const id = uuid(); sql(`insert into auth.users(id,email,email_confirmed_at) values('${id}','${email}',${confirmed ? "now()" : "null"})`); return id; };
export const addStaff = (id, role) => sql(`insert into public.staff_members(user_id,role) values('${id}','${role}') on conflict (user_id) do update set role=excluded.role, status='active'`);
