import { describe, expect, it } from "vitest";
import { getHostJourney, getWebAuthUrl, HOST_JOURNEYS } from "./host_journeys";

describe("Canva host acquisition paths", () => {
  it("supports new account + first gathering", () => {
    expect(getHostJourney(false, "create_new")).toBe("new_account_new_gathering");
  });
  it("supports existing host + new gathering", () => {
    expect(getHostJourney(true, "create_new")).toBe("existing_account_new_gathering");
  });
  it("supports existing host + existing gathering", () => {
    expect(getHostJourney(true, "select_existing")).toBe("existing_account_existing_gathering");
  });
  it("routes visitors requesting an existing gathering to sign-in", () => {
    expect(getHostJourney(false, "select_existing")).toBe("existing_account_existing_gathering");
    expect(getWebAuthUrl("existing_account_existing_gathering")).toContain("/login?");
  });
  it("does not require an existing gathering for new-gathering paths", () => {
    expect(HOST_JOURNEYS.filter(x => x.journey.endsWith("new_gathering"))
      .every(x => x.requiresExistingGathering === false)).toBe(true);
  });
});
