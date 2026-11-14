export type GatheringDuration = "single_day" | "multi_day";
export interface InvitationPublishSettings {
  gatheringId: string;
  requestId: string;
  duration: GatheringDuration;
  invitationOptIn: true;
}
export const MAX_PUBLISH_REF_BYTES = 32 * 1024;

export function parseInvitationPublishRef(
  raw?: string,
): InvitationPublishSettings | null {
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_PUBLISH_REF_BYTES)
    return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const value = data as Record<string, unknown>;
    if (
      typeof value.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value.requestId,
      ) ||
      typeof value.gatheringId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value.gatheringId,
      ) ||
      !["single_day", "multi_day"].includes(String(value.duration)) ||
      value.invitationOptIn !== true
    )
      return null;
    return {
      gatheringId: value.gatheringId,
      requestId: value.requestId,
      duration: value.duration as GatheringDuration,
      invitationOptIn: true,
    };
  } catch {
    return null;
  }
}
export function serializeInvitationPublishRef(
  settings: InvitationPublishSettings,
): string {
  const result = JSON.stringify(settings);
  if (!parseInvitationPublishRef(result))
    throw new Error("Invalid invitation publishing settings");
  return result;
}
