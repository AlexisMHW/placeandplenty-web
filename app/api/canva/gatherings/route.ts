import { canvaClient, canvaOptions, canvaResponse } from "@/lib/canva-server";
import { eligibleGathering } from "@/lib/canva-publisher";
import {
  CanvaControlError,
  checkCanvaGatheringQuota,
} from "@/lib/canva-controls";
export const dynamic = "force-dynamic";
export const OPTIONS = canvaOptions;
export async function GET(request: Request) {
  try {
    const { client } = await canvaClient(request);
    await checkCanvaGatheringQuota(client);
    const { data, error } = await client.rpc(
      "list_my_gatherings_with_lifecycle",
    );
    if (error)
      return canvaResponse(request, { error: "Gatherings unavailable" }, 503);
    return canvaResponse(request, {
      gatherings: (data || [])
        .filter(eligibleGathering)
        .map((row: Record<string, unknown>) => ({
          id: row.id,
          name: row.name,
          duration: row.duration_type,
        })),
    });
  } catch (error) {
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
    return canvaResponse(
      request,
      { error: "Connect your Place & Plenty account again" },
      401,
    );
  }
}
