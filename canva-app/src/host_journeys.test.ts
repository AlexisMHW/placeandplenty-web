import { describe, expect, it } from "vitest";
import { getHostJourney, HOST_JOURNEYS } from "./host_journeys";

describe("Canva host acquisition paths", () => {
  it("supports new account + first gathering", () => {
    expect(getHostJourney(false, false, true)).toBe("new_account_new_gathering");
  });
  it("supports existing host + new gathering", () => {
    expect(getHostJourney(true, true, true)).toBe("existing_account_new_gathering");
  });
  it("supports existing host + existing gathering", () => {
    expect(getHostJourney(true, true, false)).toBe("existing_account_existing_gathering");
  });
  it("does not require an existing gathering for new-gathering paths", () => {
    expect(HOST_JOURNEYS.filter(x => x.journey.endsWith("new_gathering"))
      .every(x => x.requiresExistingGathering === false)).toBe(true);
  });
});
