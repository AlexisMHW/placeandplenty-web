// Shim for lib/supabase-server.ts: real @supabase/supabase-js -> LOCAL PostgREST (-> scratch Postgres). The caller identity is
// globalThis.__e2eJwt (a locally signed JWT, role + sub exactly as Supabase Auth would issue). auth.getUser() is answered from that JWT
// (there is no GoTrue locally); everything else (rpc/from/select/insert) is the unmodified supabase-js client over HTTP.
import { createClient as mk } from "@supabase/supabase-js";
const URL_ = "http://127.0.0.1:54481";
function claims(t) { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()); } catch { return null; } }
export function createClient() {
  const t = globalThis.__e2eJwt;
  const c = mk(URL_, t ?? globalThis.__e2eAnon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: t ? { Authorization: `Bearer ${t}` } : {} } });
  c.auth.getUser = async () => { const cl = t && claims(t); return cl && cl.sub ? { data: { user: { id: cl.sub, email: cl.email } }, error: null } : { data: { user: null }, error: { message: "no session" } }; };
  return c;
}
export async function getUser() { const { data } = await createClient().auth.getUser(); return data.user; }
export function createServiceClient() { throw new Error("service client is not available in the web shim"); }
