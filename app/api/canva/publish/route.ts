import { canvaClient, canvaOptions, canvaResponse } from "@/lib/canva-server";
import { isGatheringId, persistCanvaArtwork } from "@/lib/canva-publisher";
import { MAX_ARTWORK_BYTES } from "@/lib/invitations";
import { CanvaBodyTooLarge, readCanvaBody } from "@/lib/canva-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = canvaOptions;
export async function POST(request: Request) {
  let client;
  try {
    ({ client } = await canvaClient(request));
  } catch {
    return canvaResponse(request, { error: "Connect your account again" }, 401);
  }
  const id = new URL(request.url).searchParams.get("gatheringId");
  if (
    !isGatheringId(id) ||
    request.headers.get("x-invitation-opt-in") !== "true" ||
    request.headers.get("content-type") !== "image/png"
  )
    return canvaResponse(request, { error: "Invalid invitation request" }, 400);
  // No remote URL fetch: Canva media is read by the SDK client, avoiding SSRF.
  if (!request.body)
    return canvaResponse(request, { error: "Missing artwork" }, 400);
  try {
    const result = await persistCanvaArtwork(
      client,
      id,
      await readCanvaBody(request, MAX_ARTWORK_BYTES),
    );
    return canvaResponse(request, {
      status: "completed",
      gatheringId: result.gatheringId,
    });
  } catch (error) {
    if (error instanceof CanvaBodyTooLarge)
      return canvaResponse(request, { error: "Artwork exceeds 10 MB" }, 413);
    return canvaResponse(
      request,
      {
        error:
          "Invitation could not be saved. Check gathering access and try again.",
      },
      400,
    );
  }
}
