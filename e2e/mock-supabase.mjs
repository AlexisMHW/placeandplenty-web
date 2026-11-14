// Minimal in-memory Supabase (GoTrue + PostgREST) for local browser tests.
// NOT a faithful emulation: just enough surface for the app's server components,
// middleware and server actions to run against fixtures. Every request that falls
// outside what it understands is recorded in `unhandled` (GET /__mock/unhandled).
// Listens on 127.0.0.1 only. Never contacts the network. Holds no real data.
import http from "node:http";

export const TEST_USER = { id: "00000000-0000-4000-8000-0000000000a1", email: "host@e2e.test", password: "e2e-password-1" };
export const OTHER_USER = { id: "00000000-0000-4000-8000-0000000000b2", email: "guest@e2e.test", password: "e2e-password-2" };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function makeJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 })}.mock`;
}
const userObj = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });

export function seed() {
  const g = "11111111-1111-4111-8111-111111111111";
  return {
    gatherings: [{ id: g, owner_user_id: TEST_USER.id, owner_id: TEST_USER.id, name: "E2E Harvest Supper", title: "E2E Harvest Supper", gathering_type: "dinner", gathering_date: "2026-12-20", gathering_end_date: null, duration_type: "single_day", arrival_time: "18:00", readiness_state: "on_track", current_hostready_score: 60, expected_guest_count: 8, adult_count: 8, child_count: 0, location_name: "Home", invitation_mode: "digital", invitation_status: "draft", invitation_artwork_path: null, invitation_artwork_mime_type: null, status: "planning", lifecycle_completed_at: null, locked_in_at: null, timezone: "America/New_York", guest_count_unknown: false, created_at: "2026-11-01T00:00:00Z" }],
    shopping_items: [{ id: "22222222-2222-4222-8222-222222222222", gathering_id: g, name: "Butter", category: "Dairy", status: "needed", quantity: "2", created_at: "2026-11-02T00:00:00Z" }],
    gathering_people: [], menu_items: [], contributions: [], co_hosts: [], invitations: [],
  };
}

function parseFilters(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = v.match(/^(not\.)?(eq|neq|in|is|gt|gte|lt|lte|like|ilike)\.(.*)$/);
    if (m) out.push({ col: k, neg: !!m[1], op: m[2], val: m[3] });
  }
  return out;
}
function matches(row, f) {
  const cell = row[f.col];
  let r;
  switch (f.op) {
    case "eq": r = String(cell) === f.val; break;
    case "neq": r = String(cell) !== f.val; break;
    case "in": r = f.val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(cell)); break;
    case "is": r = f.val === "null" ? cell == null : String(cell) === f.val; break;
    case "gt": r = cell > f.val; break; case "gte": r = cell >= f.val; break;
    case "lt": r = cell < f.val; break; case "lte": r = cell <= f.val; break;
    case "like": case "ilike": r = new RegExp("^" + f.val.replace(/%/g, ".*") + "$", f.op === "ilike" ? "i" : "").test(String(cell ?? "")); break;
    default: r = true;
  }
  return f.neg ? !r : r;
}

export function startMock({ port = 54321 } = {}) {
  let db = seed();
  const sessions = new Map(); // token -> user
  const unhandled = [];
  const writes = [];
  const rpcLog = [];
  const users = [TEST_USER, OTHER_USER];
  let rpcOverrides = {};

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    // The browser client talks to this server cross-origin (app on :3100), so allow CORS.
    res.setHeader("access-control-allow-origin", req.headers.origin || "*");
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] || "authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer,range,accept");
    res.setHeader("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD");
    res.setHeader("access-control-expose-headers", "content-range");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    const send = (status, obj, headers = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const authedUser = sessions.get(bearer) ?? null;

    // ---- control plane for tests
    if (url.pathname === "/__mock/reset") { db = seed(); unhandled.length = 0; writes.length = 0; rpcLog.length = 0; rpcOverrides = {}; return send(200, { ok: true }); }
    if (url.pathname === "/__mock/unhandled") return send(200, unhandled);
    if (url.pathname === "/__mock/writes") return send(200, writes);
    if (url.pathname === "/__mock/rpc") return send(200, rpcLog);
    if (url.pathname === "/__mock/db") return send(200, db);
    if (url.pathname === "/__mock/set-status") { db.gatherings[0].status = body.status; return send(200, { ok: true }); }
    if (url.pathname === "/__mock/rpc-override") { rpcOverrides[body.name] = body.value; return send(200, { ok: true }); }

    // ---- GoTrue
    if (url.pathname === "/auth/v1/token" && req.method === "POST") {
      const u = users.find((x) => x.email === body?.email && x.password === body?.password);
      if (!u) return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      const token = makeJwt(u); sessions.set(token, u);
      return send(200, { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "rt-" + u.id, user: userObj(u) });
    }
    if (url.pathname === "/auth/v1/user") {
      if (!authedUser) return send(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      return send(200, userObj(authedUser));
    }
    if (url.pathname === "/auth/v1/logout") return send(204);

    // ---- PostgREST
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").pop();
      rpcLog.push({ name, args: body, as: authedUser?.id ?? null });
      if (name in rpcOverrides) return send(200, rpcOverrides[name]);
      if (name === "effective_gathering_status") { const g = db.gatherings.find((x) => x.id === body?.p_gathering_id); return send(200, g ? g.status : null); }
      if (name === "resolve_gathering_is_premium") return send(200, true);
      if (name === "list_my_gatherings_with_lifecycle") {
        // set-returning RPC: PostgREST applies the query-string filters to its result
        const list = db.gatherings.filter((g) => g.owner_user_id === authedUser?.id).map((g) => ({ ...g, effective_status: g.status }))
          .filter((r) => parseFilters(url).every((f) => matches(r, f)));
        if (/pgrst\.object/.test(req.headers.accept || "")) return list.length === 1 ? send(200, list[0]) : send(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "" });
        return send(200, list);
      }
      if (name === "create_gathering_invitation") { writes.push({ table: "gathering_invitations", op: "rpc_insert", email: body.p_invited_email }); return send(200, "e2e-token-" + String(body.p_invited_email).split("@")[0]); }
      if (name === "hostready_read") return send(200, { score: 60, readinessState: "on_track" });
      if (name === "shopping_add_item") {
        const row = { id: crypto.randomUUID(), gathering_id: body.p_gathering_id, name: body.p_name, category: body.p_category, quantity: body.p_quantity, unit: body.p_unit, estimated_cost: body.p_estimated_cost, status: "needed", source: body.p_source, created_at: new Date().toISOString() };
        db.shopping_items.push(row); writes.push({ table: "shopping_items", op: "rpc_insert", rows: [row] });
        return send(200, row.id);
      }
      unhandled.push({ kind: "rpc", name, args: body });
      return send(200, null);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").pop();
      if (!(table in db)) { unhandled.push({ kind: "table", table, method: req.method, query: url.search }); return req.method === "GET" ? send(200, []) : send(404, { code: "42P01", message: `relation ${table} does not exist` }); }
      const rows = db[table];
      const filters = parseFilters(url);
      const selected = () => rows.filter((r) => filters.every((f) => matches(r, f)));
      const wantsObject = /pgrst\.object/.test(req.headers.accept || "");
      const prefer = req.headers.prefer || "";
      const reply = (list, status = 200) => {
        if (wantsObject) return list.length === 1 ? send(status, list[0]) : send(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${list.length} rows` });
        return send(status, list, prefer.includes("count=exact") ? { "content-range": `0-${Math.max(list.length - 1, 0)}/${list.length}` } : {});
      };
      if (req.method === "GET" || req.method === "HEAD") {
        let list = selected();
        const order = url.searchParams.get("order");
        if (order) { const [c, d] = order.split(",")[0].split("."); list = [...list].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === "desc" ? -1 : 1)); }
        const lim = url.searchParams.get("limit"); if (lim) list = list.slice(0, Number(lim));
        return reply(list);
      }
      if (req.method === "POST") {
        const items = (Array.isArray(body) ? body : [body]).map((r) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r }));
        rows.push(...items); writes.push({ table, op: "insert", rows: items });
        return prefer.includes("return=representation") ? reply(items, 201) : send(201);
      }
      if (req.method === "PATCH") {
        const hit = selected(); hit.forEach((r) => Object.assign(r, body)); writes.push({ table, op: "update", patch: body, count: hit.length });
        return prefer.includes("return=representation") ? reply(hit) : send(204);
      }
      if (req.method === "DELETE") {
        const hit = selected(); db[table] = rows.filter((r) => !hit.includes(r)); writes.push({ table, op: "delete", count: hit.length });
        return prefer.includes("return=representation") ? reply(hit) : send(204);
      }
    }
    unhandled.push({ kind: "path", method: req.method, path: url.pathname });
    send(404, { message: "mock: not found" });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, port })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await startMock({ port: Number(process.env.MOCK_SUPABASE_PORT || 54321) });
  console.log(`mock-supabase listening on 127.0.0.1:${port}`);
}
