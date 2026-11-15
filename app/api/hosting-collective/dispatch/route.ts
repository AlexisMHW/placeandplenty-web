import { timingSafeEqual } from "node:crypto";
import { hcDispatchEnabled } from "@/lib/hc/dispatch-runner";
import { runConfiguredHcDispatch } from "@/lib/hc/dispatch-server";

// Scheduled/manual dispatch of queued Hosting Collective applicant notifications. OFF by default (HC_NOTIFY_DISPATCH_ENABLED) and requires a
// shared secret. No real mail provider exists in this repo: the disabled provider refuses every send, so even when switched on nothing is
// delivered until the Comms stream supplies and approves a provider.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = process.env.HC_DISPATCH_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ ok: false }, { status: 401 });
  if (!hcDispatchEnabled(process.env)) return Response.json({ ok: true, ran: false, reason: "dispatch_disabled" });
  const summary = await runConfiguredHcDispatch();
  return Response.json({ ok: true, ...summary });
}
