import type { GatheringChoice } from "./PublisherChoices";

export type HostJourney =
  | "new_account_new_gathering"
  | "existing_account_new_gathering"
  | "existing_account_existing_gathering";

export type HostJourneyAction = "sign_up" | "sign_in" | "create_gathering" | "select_gathering";

export interface HostJourneyStep {
  journey: HostJourney;
  actions: readonly HostJourneyAction[];
  requiresExistingGathering: boolean;
}

export const HOST_JOURNEYS: readonly HostJourneyStep[] = [
  {
    journey: "new_account_new_gathering",
    actions: ["sign_up", "create_gathering"],
    requiresExistingGathering: false,
  },
  {
    journey: "existing_account_new_gathering",
    actions: ["sign_in", "create_gathering"],
    requiresExistingGathering: false,
  },
  {
    journey: "existing_account_existing_gathering",
    actions: ["sign_in", "select_gathering"],
    requiresExistingGathering: true,
  },
];

/**
 * A visitor choosing an existing gathering must sign in: creating a
 * new account cannot grant access to another host's gathering.
 * The website must still verify membership and permissions.
 */
export function getHostJourney(
  hasPlaceAndPlentyAccount: boolean,
  gatheringChoice: GatheringChoice,
): HostJourney {
  if (gatheringChoice === "select_existing") return "existing_account_existing_gathering";
  return hasPlaceAndPlentyAccount
    ? "existing_account_new_gathering"
    : "new_account_new_gathering";
}
