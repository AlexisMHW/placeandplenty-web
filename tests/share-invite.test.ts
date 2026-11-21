import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPreviewDescription,
  formatShareDate,
  formatShareTime,
  isShareToken,
  isTrustedArtworkUrl,
} from "../lib/share-invite.ts";

describe("share invite helpers", () => {
  test("token must be a uuid", () => {
    assert.equal(isShareToken("3fa85f64-5717-4562-b3fc-2c963f66afa6"), true);
    assert.equal(isShareToken("../../etc/passwd"), false);
    assert.equal(isShareToken(""), false);
  });
  test("date and time format without timezone drift", () => {
    assert.equal(formatShareDate("2026-12-12"), "Saturday, December 12, 2026");
    assert.equal(formatShareTime("14:30:00"), "2:30 PM");
    assert.equal(formatShareTime("00:05"), "12:05 AM");
    assert.equal(formatShareDate(null), null);
  });
  test("preview text never carries a location or guest data", () => {
    const text = buildPreviewDescription({ hostDisplayName: "Lexi", displayDate: "2026-12-12", displayTime: "14:00" });
    assert.match(text, /^You have received an invitation from Lexi on Place & Plenty\./);
    assert.match(text, /Saturday, December 12, 2026\./);
    assert.doesNotMatch(text, /2:00|14:00|PM|street|address|location/i); // calendar date only: never the time of day
    assert.equal(buildPreviewDescription({}), "You have received an invitation on Place & Plenty. Open it to view the invitation and RSVP.");
  });
  test("artwork fetch only from our own https Supabase host", () => {
    const base = "https://abc.supabase.co";
    assert.equal(isTrustedArtworkUrl("https://abc.supabase.co/storage/v1/object/sign/x", base), true);
    assert.equal(isTrustedArtworkUrl("http://abc.supabase.co/x", base), false);
    assert.equal(isTrustedArtworkUrl("https://evil.example.com/x", base), false);
    assert.equal(isTrustedArtworkUrl("https://abc.supabase.co.evil.com/x", base), false);
    assert.equal(isTrustedArtworkUrl("not a url", base), false);
  });
  test("the preview route and metadata never reference location fields", () => {
    const page = readFileSync(new URL("../app/(guest)/i/[token]/page.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../app/(guest)/i/[token]/preview/route.ts", import.meta.url), "utf8");
    assert.doesNotMatch(page, /displayLocation/);
    assert.doesNotMatch(route, /displayLocation/);
    assert.match(page, /index: false/);
  });
});
