import type { GatheringChoice, PublisherSelection } from "./PublisherChoices";

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

/**
 * Send the host to the existing Place & Plenty website to authenticate.
 * This is a one-way navigation only: returning to the Canva iframe
 * requires a separate, server-verified one-time handoff.
 *
 * No Canva design references, tokens, or arbitrary return URLs belong
 * in the authentication URL.
 */
export function getWebAuthUrl(journey: HostJourney): string {
  const route = journey === "new_account_new_gathering" ? "/signup" : "/login";
  const url = new URL(route, "https://placeandplenty.com");
  url.searchParams.set("next", "/host");
  return url.toString();
}

/**
 * Converts the UI selection to the next web-auth destination.
 * This only chooses a destination; it does not create a gathering,
 * grant access, or complete the Canva authorization callback.
 */
export function getAuthDestinationForSelection(
  selection: PublisherSelection,
  hasPlaceAndPlentyAccount: boolean,
): string {
  return getWebAuthUrl(getHostJourney(hasPlaceAndPlentyAccount, selection.gatheringChoice));
}
