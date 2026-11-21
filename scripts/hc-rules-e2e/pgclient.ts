// Copy of scripts/cc-e2e/pgclient.ts that ALSO sets request.role, so auth.role() is the real caller role (the original leaves it unset, which the scratch stub reads as service_role). Scratch Postgres only.
// rpc(name,args) runs the real database function as role anon|authenticated|service_role with request.uid set, like PostgREST does.
import { execFileSync } from "node:child_process";
export interface Conn { host: string; port: string; db: string }
const q = (s: string) => "'" + s.replace(/'/g, "''") + "'";
export function psql(c: Conn, sql: string): string {
  return execFileSync("psql", ["-h", c.host, "-p", c.port, "-U", "postgres", "-d", c.db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
export const sql1 = (c: Conn, s: string) => psql(c, `\\o /dev/null\n\\o\n${s}`).trim();
const meta = new Map<string, { names: string[]; types: string[]; kind: "void" | "set" | "scalar" }>();
function getMeta(c: Conn, fn: string) {
  if (!meta.has(fn)) {
    const out = sql1(c, `select coalesce(array_to_string(proargnames,','),'')||'|'||array_to_string(proargtypes::regtype[],',')||'|'||case when prorettype='void'::regtype then 'void' when proretset then 'set' else 'scalar' end from pg_proc where proname=${q(fn)} and pronamespace='public'::regnamespace`);
    const [n, t, k] = out.split("|");
    meta.set(fn, { names: n ? n.split(",") : [], types: t ? t.split(",") : [], kind: k as "void" | "set" | "scalar" });
  }
  return meta.get(fn)!;
}
function lit(v: unknown, type: string): string {
  if (v === null || v === undefined) return `null::${type}`;
  if (type.endsWith("[]")) return `(select coalesce(array_agg(x),'{}') from jsonb_array_elements_text(${q(JSON.stringify(v))}::jsonb) x)::${type}`;
  if (typeof v === "object") return `${q(JSON.stringify(v))}::${type}`;
  if (typeof v === "boolean" || typeof v === "number") return `${String(v)}::${type}`;
  return `${q(String(v))}::${type}`;
}
export function client(c: Conn, as: { role: "anon" | "authenticated" | "service_role"; uid?: string }) {
  return {
    async rpc(fn: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: { message: string } | null }> {
      const m = getMeta(c, fn);
      const argSql = Object.entries(args).map(([k, v]) => `${k} => ${lit(v, m.types[m.names.indexOf(k)] ?? "text")}`).join(", ");
      const call = m.kind === "set" ? `select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb)::text from public.${fn}(${argSql}) t`
        : m.kind === "void" ? `select public.${fn}(${argSql}) is null` : `select public.${fn}(${argSql})::text`;
      const script = `\\o /dev/null\nselect set_config('request.uid', ${q(as.uid ?? "")}, false), set_config('request.role', ${q(as.role)}, false);\nset role ${as.role};\n\\o\n\\echo @@START\n${call};\n`;
      try {
        const out = execFileSync("psql", ["-h", c.host, "-p", c.port, "-U", "postgres", "-d", c.db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
        const body = out.split("@@START\n")[1]?.trim() ?? "";
        return { data: m.kind === "void" ? null : body === "" ? null : JSON.parse(body), error: null };
      } catch (e: any) {
        const msg = String(e.stderr ?? e.message).match(/ERROR:\s+(?:[A-Z0-9]+:\s+)?(.*)/)?.[1] ?? "failed";
        return { data: null, error: { message: msg.trim() } };
      }
    },
  };
}
