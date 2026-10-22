import { canvaClient, canvaOptions, canvaResponse } from "@/lib/canva-server";
import { eligibleGathering } from "@/lib/canva-publisher";
export const dynamic = "force-dynamic";
export const OPTIONS = canvaOptions;
export async function GET(request: Request) {
  try {
    const { client } = await canvaClient(request);
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
  } catch {
    return canvaResponse(
      request,
      { error: "Connect your Place & Plenty account again" },
      401,
    );
  }
}
