import { createHash } from "node:crypto";
import { createRateLimiter, forwardStandaloneConsent, isStandaloneOptInEnabled } from "@/lib/sms-standalone-opt-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server route for the standalone /sms-opt-in page. 404 unless NEXT_PUBLIC_SMS_STANDALONE_OPT_IN is "true". The browser never sees the edge URL or key.
const allow = createRateLimiter(5, 10 * 60 * 1000);   // 5 attempts per client per 10 minutes, per server instance

export async function POST(request: Request) {
  if (!isStandaloneOptInEnabled()) return Response.json({ error: "not_found" }, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "bad_request" }, { status: 415 });
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const clientKey = createHash("sha256").update(`sms-opt-in:${ip}`).digest("hex");   // raw IP never forwarded or stored
  if (!allow(clientKey)) return Response.json({ error: "rate_limited" }, { status: 429 });
  const text = await request.text();
  if (text.length > 2048) return Response.json({ error: "bad_request" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const out = await forwardStandaloneConsent(body, { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, clientKey });
  return Response.json(out.body, { status: out.status });
}
