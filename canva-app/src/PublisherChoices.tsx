import React, { useState } from "react";
import type { Duration, InvitationSelection } from "./handoff";

export type GatheringChoice = "create_new" | "select_existing";

export interface PublisherSelection {
  gatheringChoice: GatheringChoice;
  duration: Duration;
  invitationSelection: InvitationSelection;
}

/**
 * Collect host intent without implying that an account, gathering, or
 * invitation has already been created. Authentication and selection
 * must be completed by the existing Place & Plenty web backend.
 */
export function PublisherChoices({ onContinue }: {
  onContinue: (selection: PublisherSelection) => void;
}) {
  const [gatheringChoice, setGatheringChoice] = useState<GatheringChoice>("create_new");
  const [duration, setDuration] = useState<Duration>("single_day");
  const [invitationSelection, setInvitationSelection] =
    useState<InvitationSelection>("not_now");

  return (
    <main>
      <h1>Plan the gathering with Place & Plenty</h1>
      <p>Design in Canva. Gather with Place & Plenty.</p>
      <p>Coordinate guests, menus, shopping, contributions, and hosting readiness.</p>
      <fieldset>
        <legend>Where would you like to start?</legend>
        <label><input type="radio" name="gatheringChoice"
          checked={gatheringChoice === "create_new"}
          onChange={() => setGatheringChoice("create_new")} /> Create a new gathering</label>
        <label><input type="radio" name="gatheringChoice"
          checked={gatheringChoice === "select_existing"}
          onChange={() => setGatheringChoice("select_existing")} /> Use an existing gathering</label>
      </fieldset>
      {gatheringChoice === "create_new" && (
        <fieldset>
          <legend>What are you planning?</legend>
          <label><input type="radio" name="duration" checked={duration === "single_day"}
            onChange={() => setDuration("single_day")} /> Single-day gathering</label>
          <label><input type="radio" name="duration" checked={duration === "multi_day"}
            onChange={() => setDuration("multi_day")} /> Multi-day gathering with itineraries</label>
          {duration === "multi_day" && (
            <p>Multi-day features require the existing Place & Plenty entitlement.</p>
          )}
        </fieldset>
      )}
      <fieldset>
        <legend>Would you like to use your Canva design as your digital invitation?</legend>
        <label><input type="radio" name="invitation" checked={invitationSelection === "use_design"}
          onChange={() => setInvitationSelection("use_design")} /> Yes, use this design</label>
        <label><input type="radio" name="invitation" checked={invitationSelection === "not_now"}
          onChange={() => setInvitationSelection("not_now")} /> Not now</label>
      </fieldset>
      <button type="button" onClick={() => onContinue({
        gatheringChoice, duration, invitationSelection,
      })}>Continue to Place & Plenty</button>
    </main>
  );
}
