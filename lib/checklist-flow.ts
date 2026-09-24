import { getChecklist } from "./checklists.ts";
import type { CreateGatheringInput } from "./gathering-creation.ts";

/** Only recognized public editions can seed a new draft. Never overrides a resumed draft. */
export function checklistPreset(edition: string | undefined): Partial<CreateGatheringInput> | undefined {
  if (!edition || !getChecklist(edition)) return undefined;
  const kit = getChecklist(edition)!;
  if (edition === "friendsgiving") return { name: "Friendsgiving", gatheringType: "holiday", foodStyle: "potluck" };
  if (edition === "family-reunion") return { name: "Family Reunion", gatheringType: "family_gathering" };
  if (edition === "bachelorette-weekend") return { name: "Bachelorette Weekend", gatheringType: "other" };
  return { name: kit.name === "Before the Doorbell" ? "" : kit.name };
}

export function checklistDestination(edition: string): string {
  return getChecklist(edition) ? `/host/create?checklist=${encodeURIComponent(edition)}` : "/host/create";
}

export function checklistSignupUrl(edition: string): string {
  return `/signup?next=${encodeURIComponent(checklistDestination(edition))}`;
}

export function checklistLoginUrl(edition: string): string {
  return `/login?next=${encodeURIComponent(checklistDestination(edition))}`;
}
