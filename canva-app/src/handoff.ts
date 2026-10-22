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
