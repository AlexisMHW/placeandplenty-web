import React, { useState } from "react";
import type { Duration, InvitationSelection } from "./handoff";

export interface PublisherSelection {
  duration: Duration;
  invitationSelection: InvitationSelection;
}

export function PublisherChoices({ onContinue }: {
  onContinue: (selection: PublisherSelection) => void;
}) {
  const [duration, setDuration] = useState<Duration>("single_day");
  const [invitationSelection, setInvitationSelection] =
    useState<InvitationSelection>("not_now");

  return (
    <main>
      <h1>Plan the gathering with Place & Plenty</h1>
      <p>Design in Canva. Gather with Place & Plenty.</p>
      <p>Coordinate guests, menus, shopping, contributions, and hosting readiness.</p>
      <fieldset>
        <legend>What are you planning?</legend>
        <label><input type="radio" name="duration" checked={duration === "single_day"}
          onChange={() => setDuration("single_day")} /> Single-day gathering</label>
        <label><input type="radio" name="duration" checked={duration === "multi_day"}
          onChange={() => setDuration("multi_day")} /> Multi-day gathering with itineraries</label>
      </fieldset>
      {duration === "multi_day" && (
        <p>Organize each day's activities, locations, schedules, and guest coordination.</p>
      )}
      <fieldset>
        <legend>Would you like to use your Canva design as your digital invitation?</legend>
        <label><input type="radio" name="invitation" checked={invitationSelection === "use_design"}
          onChange={() => setInvitationSelection("use_design")} /> Yes, use this design</label>
        <label><input type="radio" name="invitation" checked={invitationSelection === "not_now"}
          onChange={() => setInvitationSelection("not_now")} /> Not now</label>
      </fieldset>
      <button type="button" onClick={() => onContinue({ duration, invitationSelection })}>
        Continue to gathering
      </button>
    </main>
  );
}
