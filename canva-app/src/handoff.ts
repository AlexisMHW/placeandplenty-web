export type Duration = "single_day" | "multi_day";
export type InvitationSelection = "use_design" | "not_now";

export interface GatheringHandoff {
  gatheringId?: string;
  duration: Duration;
  invitationSelection: InvitationSelection;
  designReference?: string;
}

export function validateHandoff(value: GatheringHandoff): boolean {
  if (value.duration !== "single_day" && value.duration !== "multi_day") return false;
  if (value.invitationSelection === "not_now") return !value.designReference;
  return value.invitationSelection === "use_design" && Boolean(value.designReference);
}

/** A Canva publish action is permitted only after explicit design opt-in.
 * Authentication, gathering ownership and entitlement checks are still required
 * by the backend before any content is transferred.
 */
export function canPublishDesign(value: GatheringHandoff): boolean {
  return validateHandoff(value) &&
    value.invitationSelection === "use_design" &&
    typeof value.gatheringId === "string" &&\n    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.gatheringId) &&
    Boolean(value.designReference);
}
