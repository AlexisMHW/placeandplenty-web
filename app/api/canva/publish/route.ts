import { canvaClient, canvaOptions, canvaResponse } from "@/lib/canva-server";
import { isGatheringId, persistCanvaArtwork } from "@/lib/canva-publisher";
import { MAX_ARTWORK_BYTES } from "@/lib/invitations";
import { CanvaBodyTooLarge, readCanvaBody } from "@/lib/canva-request";
import { CanvaControlError } from "@/lib/canva-controls";
import { CanvaRevocationUnavailable } from "@/lib/canva-revocation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = canvaOptions;
export async function POST(request: Request) {
  let client;
  try {
    ({ client } = await canvaClient(request));
  } catch (error) {
    if (error instanceof CanvaRevocationUnavailable)
      return canvaResponse(
        request,
        { error: "Connection verification unavailable" },
        503,
      );
    return canvaResponse(request, { error: "Connect your account again" }, 401);
  }
  const id = new URL(request.url).searchParams.get("gatheringId");
  const requestId = request.headers.get("x-publish-request-id");
  if (
    !isGatheringId(requestId) ||
    !isGatheringId(id) ||
    request.headers.get("x-invitation-opt-in") !== "true" ||
    request.headers.get("content-type") !== "image/png"
  ) {
    console.warn("Canva publish rejected: invalid request fields", {
      gatheringIdValid: isGatheringId(id),
      requestIdValid: isGatheringId(requestId),
      optedIn: request.headers.get("x-invitation-opt-in") === "true",
      pngContentType: request.headers.get("content-type") === "image/png",
    });
    return canvaResponse(request, { error: "Invalid invitation request" }, 400);
  }
  // No remote URL fetch: Canva media is read by the SDK client, avoiding SSRF.
  if (!request.body)
    return canvaResponse(request, { error: "Missing artwork" }, 400);
  try {
    const result = await persistCanvaArtwork(
      client,
      id,
      await readCanvaBody(request, MAX_ARTWORK_BYTES),
      requestId,
    );
    return canvaResponse(request, {
      status: "completed",
      gatheringId: result.gatheringId,
    });
  } catch (error) {
    const safeReasons = [
      "Invalid invitation PNG",
      "Invitation dimensions too large",
      "Gathering unavailable",
      "Artwork upload failed",
      "Artwork save unavailable",
      "Save unconfirmed. Check your gathering before retrying.",
    ];
    console.warn(
      "Canva publish failed:",
      error instanceof Error && safeReasons.includes(error.message)
        ? error.message
        : "Unclassified publication failure",
    );
    if (error instanceof CanvaControlError) {
      const response = canvaResponse(
        request,
        { error: error.message },
        error.status,
      );
      if (error.retryAfter)
        response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
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
