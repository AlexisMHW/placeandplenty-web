import { canvaClient, canvaOptions, canvaResponse } from "@/lib/canva-server";
import {
  CanvaRevocationUnavailable,
  revokeCanvaGrant,
} from "@/lib/canva-revocation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = canvaOptions;
export async function POST(request: Request) {
  let connection;
  try {
    connection = await canvaClient(request);
  } catch (error) {
    return canvaResponse(
      request,
      { error: "Connection unavailable" },
      error instanceof CanvaRevocationUnavailable ? 503 : 401,
    );
  }
  try {
    await revokeCanvaGrant(
      connection.client,
      connection.token,
      connection.expiresAt,
    );
    return canvaResponse(request, { status: "disconnected" });
  } catch {
    return canvaResponse(request, { error: "Disconnect unconfirmed" }, 503);
  }
}
