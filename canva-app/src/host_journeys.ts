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

export function getHostJourney(
  isAuthenticated: boolean,
  hasPlaceAndPlentyAccount: boolean,
  wantsNewGathering: boolean
): HostJourney {
  if (!isAuthenticated && !hasPlaceAndPlentyAccount) return "new_account_new_gathering";
  return wantsNewGathering
    ? "existing_account_new_gathering"
    : "existing_account_existing_gathering";
}
