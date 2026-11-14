import { submitCreatorApplication } from "@/lib/hosting-collective";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public intake. Same-origin only, JSON only, small body. Uses the public anon key (no service-role key exists in this app);
// the database function enforces the kill switch, validation, duplicate handling and an hourly flood cap.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return Response.json({ message: "Please apply from this website." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ message: "Invalid request." }, { status: 415 });
  const text = await request.text();
  if (text.length > 12000) return Response.json({ message: "Request too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "unknown";
  return submitCreatorApplication(body, ip, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
