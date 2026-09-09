import { deliverChecklist } from "@/lib/checklist-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return Response.json({ message: "Please request your checklist from this website." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ message: "Invalid request." }, { status: 415 });
  if (Number(request.headers.get("content-length")) > 4096) return Response.json({ message: "Request too large." }, { status: 413 });
  const text = await request.text();
  if (text.length > 4096) return Response.json({ message: "Request too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ message: "Invalid request." }, { status: 400 }); }
  // Vercel sets x-forwarded-for. Unknown hosts share a conservative limiter key.
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "unknown";
  return deliverChecklist(body, ip, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    brevoKey: process.env.BREVO_API_KEY, sender: process.env.BREVO_CHECKLIST_SENDER,
    mailerliteKey: process.env.MAILERLITE_API_KEY,
    mailerliteGroupIds: { "before-the-doorbell": process.env.MAILERLITE_DOORBELL_GROUP_ID, halloween: process.env.MAILERLITE_HALLOWEEN_GROUP_ID, friendsgiving: process.env.MAILERLITE_FRIENDSGIVING_GROUP_ID, thanksgiving: process.env.MAILERLITE_THANKSGIVING_GROUP_ID, "game-day": process.env.MAILERLITE_GAME_DAY_GROUP_ID },
    listIds: { "before-the-doorbell": process.env.BREVO_DOORBELL_LIST_ID, halloween: process.env.BREVO_HALLOWEEN_LIST_ID, friendsgiving: process.env.BREVO_FRIENDSGIVING_LIST_ID, thanksgiving: process.env.BREVO_THANKSGIVING_LIST_ID, "game-day": process.env.BREVO_GAME_DAY_LIST_ID },
  });
}
