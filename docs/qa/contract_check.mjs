#!/usr/bin/env node
// A8 contract check: client RPC / edge-function calls vs where they are DEFINED.
// usage: node docs/qa/contract_check.mjs --web <dir> --native <dir> [--proposed <dir> ...] [--json out.json]
// Classes: in_repo (SQL tracked in the native repo supabase/migrations), proposed_only (SQL exists only in the given
// untracked/proposed dirs = not durable in git), missing (no SQL definition found anywhere given).
import fs from "node:fs"; import path from "node:path";
const a = process.argv.slice(2); const opt = (k) => { const o = []; for (let i = 0; i < a.length; i++) if (a[i] === k) o.push(a[++i]); return o; };
const web = opt("--web")[0], native = opt("--native")[0], proposed = opt("--proposed"), jsonOut = opt("--json")[0];
const walk = (d, ext, out = []) => { if (!d || !fs.existsSync(d)) return out; for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".git", ".next"].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, ext, out); else if (ext.some((x) => p.endsWith(x))) out.push(p); } return out; };
const defs = (files) => { const m = new Map(); for (const f of files) { const t = fs.readFileSync(f, "utf8"); for (const x of t.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi)) { if (!m.has(x[1])) m.set(x[1], f); } } return m; };
const inRepo = defs(walk(path.join(native, "supabase/migrations"), [".sql"]));
const prop = defs(proposed.flatMap((d) => walk(d, [".sql"])).filter((f) => !/ROLLBACK/i.test(f)));
const fnsInRepo = new Set(fs.existsSync(path.join(native, "supabase/functions")) ? fs.readdirSync(path.join(native, "supabase/functions"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
const calls = (root, label) => { const rpc = new Map(), inv = new Map(); for (const f of walk(root, [".ts", ".tsx", ".js", ".mjs"])) { if (/\.test\.|[\\/]tests?[\\/]|__tests__|node_modules/.test(f)) continue; const t = fs.readFileSync(f, "utf8"); for (const x of t.matchAll(/\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/g)) { (rpc.get(x[1]) ?? rpc.set(x[1], new Set()).get(x[1])).add(label + ":" + path.relative(root, f)); } for (const x of t.matchAll(/functions\.invoke\(\s*["'`]([a-z0-9-]+)["'`]/g)) { (inv.get(x[1]) ?? inv.set(x[1], new Set()).get(x[1])).add(label + ":" + path.relative(root, f)); } for (const x of t.matchAll(/functions\/v1\/([a-z0-9-]+)/g)) { (inv.get(x[1]) ?? inv.set(x[1], new Set()).get(x[1])).add(label + ":" + path.relative(root, f)); } } return { rpc, inv }; };
const W = calls(web, "web"), N = calls(native, "native");
const merge = (x, y) => { const m = new Map(x); for (const [k, v] of y) m.set(k, new Set([...(m.get(k) ?? []), ...v])); return m; };
const rpc = merge(W.rpc, N.rpc), inv = merge(W.inv, N.inv);
const rows = [...rpc].sort().map(([n, who]) => ({ kind: "rpc", name: n, clients: [...who].length, side: [...new Set([...who].map((s) => s.split(":")[0]))].join("+"), cls: inRepo.has(n) ? "in_repo" : prop.has(n) ? "proposed_only" : "missing" }));
const frows = [...inv].sort().map(([n, who]) => ({ kind: "edge", name: n, clients: [...who].length, side: [...new Set([...who].map((s) => s.split(":")[0]))].join("+"), cls: fnsInRepo.has(n) ? "in_repo" : "missing" }));
const all = [...rows, ...frows];
const sum = (k, c) => all.filter((r) => r.kind === k && r.cls === c).length;
console.log(`rpc: ${rows.length} (in_repo ${sum("rpc", "in_repo")}, proposed_only ${sum("rpc", "proposed_only")}, missing ${sum("rpc", "missing")})`);
console.log(`edge: ${frows.length} (in_repo ${sum("edge", "in_repo")}, missing ${sum("edge", "missing")})`);
for (const r of all.filter((r) => r.cls !== "in_repo")) console.log(`${r.cls.padEnd(14)} ${r.kind} ${r.name} [${r.side}]`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
