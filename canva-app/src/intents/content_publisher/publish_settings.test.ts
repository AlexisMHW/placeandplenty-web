import { describe, expect, it } from "vitest";
import {
  MAX_PUBLISH_REF_BYTES,
  parseInvitationPublishRef,
  serializeInvitationPublishRef,
} from "./publish_settings";

const valid = {
  requestId: "44444444-4444-4444-8444-444444444444",
  gatheringId: "f2f91df4-8c45-4e7e-9a16-313314324889",
  duration: "multi_day" as const,
  invitationOptIn: true as const,
};

describe("Canva invitation publishRef", () => {
  it("round-trips a valid opt-in selection", () => {
    expect(
      parseInvitationPublishRef(serializeInvitationPublishRef(valid)),
    ).toEqual(valid);
  });
  it("rejects non-opt-in and missing gathering", () => {
    expect(
      parseInvitationPublishRef(
        JSON.stringify({ ...valid, invitationOptIn: false }),
      ),
    ).toBeNull();
    expect(
      parseInvitationPublishRef(JSON.stringify({ ...valid, gatheringId: "" })),
    ).toBeNull();
  });
  it("rejects invalid duration and malformed JSON", () => {
    expect(
      parseInvitationPublishRef(
        JSON.stringify({ ...valid, duration: "weekend" }),
      ),
    ).toBeNull();
    expect(parseInvitationPublishRef("{")).toBeNull();
  });
  it("rejects malformed or padded gathering identifiers", () => {
    for (const gatheringId of [
      "f2f91df4-8c45-4e7e-9a16-313314324889-extra",
      "f2f91df4-8c45-4e7e-9a16-313314324889 ",
      "f2f91df4-8c45-4e7e-9a16-31331432488z",
      "gathering-123",
    ]) {
      expect(
        parseInvitationPublishRef(JSON.stringify({ ...valid, gatheringId })),
      ).toBeNull();
    }
  });
  it("rejects oversized publishRef", () => {
    expect(
      parseInvitationPublishRef("x".repeat(MAX_PUBLISH_REF_BYTES + 1)),
    ).toBeNull();
  });
});
