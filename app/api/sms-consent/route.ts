import { forwardSmsConsent } from "@/lib/sms-guest-consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server route for the guest SMS opt-in box. Answers 404 unless NEXT_PUBLIC_SMS_GUEST_OPT_IN is "true", so with the flag off this route does not exist.
// The browser only ever talks to this route; the edge function URL and key stay on the server.
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_SMS_GUEST_OPT_IN !== "true") return Response.json({ error: "not_found" }, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "bad_request" }, { status: 415 });
  const text = await request.text();
  if (text.length > 2048) return Response.json({ error: "bad_request" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const out = await forwardSmsConsent(body, { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  return Response.json(out.body, { status: out.status });
}
