import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInvitePreview, isClosedStatus, PREVIEW_TITLE_MAX } from "../lib/invite-preview.ts";

const open = { found: true, displayName: "Fall Supper", hostDisplayName: "Alexis", displayDate: "2026-11-21", gatheringStatus: "active" };

describe("invitation link preview (Open Graph / Twitter)", () => {
  test("open invitation: gathering title, host and calendar date only", () => {
    const p = buildInvitePreview({ ...open, hasArtwork: true });
    assert.equal(p.kind, "open");
    assert.equal(p.title, "Fall Supper");
    assert.equal(p.description, "You have received an invitation from Alexis on Place & Plenty. Saturday, November 21, 2026. Open it to view the invitation and RSVP.");
    assert.equal(p.showArtwork, true);
    assert.doesNotMatch(p.description, /\d{1,2}:\d{2}|\b(AM|PM)\b/);
  });
  test("input carries no location or notes: extra private fields are never read", () => {
    const p = buildInvitePreview({ ...open, displayLocation: "12 Elm Street", locationNote: "gate code 1234", displayTime: "17:30", displayDescription: "secret" } as never);
    assert.doesNotMatch(JSON.stringify(p), /Elm|gate|17:30|secret/);
  });
  test("missing / email-like / id-like host uses neutral wording", () => {
    for (const hostDisplayName of [null, undefined, "", "a@b.co", "3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9b1e44"]) {
      const p = buildInvitePreview({ ...open, hostDisplayName });
      assert.match(p.description, /^You have received an invitation on Place & Plenty\./);
    }
  });
  test("closed gatherings (completed, cancelled, archived) and unknown / revoked links are generic and never name the gathering or use artwork", () => {
    for (const gatheringStatus of ["completed", "cancelled", "archived", "CANCELLED"]) {
      const p = buildInvitePreview({ ...open, gatheringStatus, hasArtwork: true });
      assert.equal(p.kind, "closed");
      assert.doesNotMatch(JSON.stringify(p), /Fall Supper|Alexis/);
      assert.equal(p.showArtwork, false);
    }
    assert.equal(buildInvitePreview({ ...open, isArchived: true }).kind, "closed");
    const unknown = buildInvitePreview({ found: false, displayName: "Fall Supper", hasArtwork: true });
    assert.equal(unknown.kind, "unknown");
    assert.doesNotMatch(JSON.stringify(unknown), /Fall Supper/);
    assert.equal(unknown.showArtwork, false);
    assert.equal(isClosedStatus("active"), false);
  });
  test("very long, emoji, HTML and control-character titles are capped and inert", () => {
    const long = buildInvitePreview({ ...open, displayName: "Z".repeat(500) });
    assert.ok(Array.from(long.title).length <= PREVIEW_TITLE_MAX);
    const emoji = buildInvitePreview({ ...open, displayName: "🎉".repeat(200) });
    assert.ok(Array.from(emoji.title).length <= PREVIEW_TITLE_MAX);
    assert.ok(Array.from(emoji.title).every((c) => c === "🎉" || c === "…"));
    const html = buildInvitePreview({ ...open, displayName: "Tom & Jerry's <script>alert(1)</script>\r\nBcc: x" });
    assert.ok(!/[\r\n]/.test(html.title));
    assert.ok(html.title.includes("Tom & Jerry's")); // data, escaped by Next's metadata renderer; never interpreted here
  });
  test("an empty gathering title falls back to a generic title", () => {
    assert.equal(buildInvitePreview({ ...open, displayName: "   " }).title, "You're Invited");
  });
});

describe("invitation pages wire the preview safely", () => {
  const per = readFileSync(new URL("../app/(guest)/invite/[token]/page.tsx", import.meta.url), "utf8");
  const share = readFileSync(new URL("../app/(guest)/i/[token]/page.tsx", import.meta.url), "utf8");
  const perPreview = readFileSync(new URL("../app/(guest)/invite/[token]/preview/route.ts", import.meta.url), "utf8");
  const sharePreview = readFileSync(new URL("../app/(guest)/i/[token]/preview/route.ts", import.meta.url), "utf8");
  const meta = (src: string) => src.slice(src.indexOf("generateMetadata"), src.indexOf("export default"));

  test("both pages stay noindex on every branch", () => {
    for (const src of [per, share]) {
      assert.match(src, /const noindex = \{ index: false, follow: false \} as const/);
      assert.equal((meta(src).match(/robots: noindex/g) ?? []).length >= 2, true);
    }
  });
  test("metadata and preview routes never read address, time or private notes", () => {
    for (const src of [meta(per), meta(share), perPreview, sharePreview]) {
      assert.doesNotMatch(src, /displayLocation|locationNote|displayTime|displayDescription|partyMembers|partyName|contactEmail/);
    }
  });
  test("preview routes refuse artwork for closed gatherings and fall back to the branded image", () => {
    assert.match(perPreview, /isClosedStatus\(data\.gatheringStatus, data\.isArchived\)/);
    assert.match(sharePreview, /isClosedStatus\(result\.data\.gatheringStatus, result\.data\.isArchived\)/);
    assert.match(perPreview, /isTrustedArtworkUrl/);
  });
});
