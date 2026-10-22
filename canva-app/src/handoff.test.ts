import { describe, expect, it } from "vitest";
import { canPublishDesign, validateHandoff } from "./handoff";
import { getHostJourney } from "./host_journeys";

describe("Canva gathering handoff", () => {
  it("allows planning without publishing artwork", () => {
    const handoff = { duration: "multi_day" as const, invitationSelection: "not_now" as const };
    expect(validateHandoff(handoff)).toBe(true);
    expect(canPublishDesign(handoff)).toBe(false);
  });

  it("rejects unexpected artwork when host declined invitation import", () => {
    expect(validateHandoff({
      duration: "single_day",
      invitationSelection: "not_now",
      designReference: "design-123",
    })).toBe(false);
  });

  it("rejects blank design references and unexpected design values", () => {
    expect(validateHandoff({ duration: "single_day", invitationSelection: "use_design", designReference: "   " })).toBe(false);
    expect(validateHandoff({ duration: "single_day", invitationSelection: "not_now", designReference: "" })).toBe(false);
    expect(validateHandoff({ duration: "single_day", invitationSelection: "use_design", designReference: 123 as unknown as string })).toBe(false);
  });

  it("requires a gathering and a design before publishing", () => {
    expect(canPublishDesign({
      duration: "single_day",
      invitationSelection: "use_design",
      designReference: "design-123",
    })).toBe(false);
    expect(canPublishDesign({
      duration: "single_day",
      invitationSelection: "use_design",
      gatheringId: "f2f91df4-8c45-4e7e-9a16-313314324889",
      designReference: "design-123",
    })).toBe(true);
  });

  it("rejects malformed gathering IDs even when design opt-in is enabled", () => {
    expect(canPublishDesign({
      duration: "single_day",
      invitationSelection: "use_design",
      gatheringId: "gathering-123",
      designReference: "design-123",
    })).toBe(false);
  });

  it("rejects an invalid gathering duration", () => {
    expect(validateHandoff({
      duration: "invalid" as "single_day",
      invitationSelection: "not_now",
    })).toBe(false);
  });
});

describe("Canva host journey selection", () => {
  it("routes a new host to signup for a new gathering", () => {
    expect(getHostJourney(false, "create_new")).toBe("new_account_new_gathering");
  });
  it("routes a returning host to login for a new gathering", () => {
    expect(getHostJourney(true, "create_new")).toBe("existing_account_new_gathering");
  });
  it("requires existing-account login to select an existing gathering", () => {
    expect(getHostJourney(false, "select_existing")).toBe("existing_account_existing_gathering");
    expect(getHostJourney(true, "select_existing")).toBe("existing_account_existing_gathering");
  });
});
