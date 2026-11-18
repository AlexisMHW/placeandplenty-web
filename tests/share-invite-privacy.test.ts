import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPreviewDescription } from "../lib/share-invite.ts";

const page = readFileSync(new URL("../app/(guest)/i/[token]/page.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../app/(guest)/i/[token]/ShareInviteClient.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../app/(guest)/i/[token]/preview/route.ts", import.meta.url), "utf8");

describe("share link address privacy", () => {
  test("link metadata and preview route never read the location", () => {
    const meta = page.slice(page.indexOf("generateMetadata"), page.indexOf("export default"));
    assert.doesNotMatch(meta, /displayLocation|locationNote/);
    assert.doesNotMatch(preview, /displayLocation/);
    assert.doesNotMatch(buildPreviewDescription({ hostDisplayName: "A", displayDate: "2026-12-12", displayTime: "14:00" }), /lane|street|address/i);
  });
  test("page is noindex", () => assert.match(page, /robots: \{ index: false, follow: false \}/));
  test("after-approval address is fetched client-side with the private request token, from this browser only", () => {
    assert.match(client, /lookupShareInvite\(token, rt\)/);
    assert.match(client, /localStorage\.getItem\(storageKey\)/);
    assert.match(page, /ShareInviteClient token=\{params\.token\} data=\{result\.data\}/);
  });
  test("honeypot field is present, hidden from assistive tech and keyboard, and sent with the request", () => {
    assert.match(client, /aria-hidden="true"/);
    assert.match(client, /tabIndex=\{-1\}/);
    assert.match(client, /website,\n\s*\}\);/);
  });
  test("rate limited submissions get a clear message", () => assert.match(client, /res\.status === 429/));
  test("a busy or briefly unavailable service never reads as 'your link is wrong'", () => {
    assert.match(page, /result\.status === 429 \|\| result\.status >= 500/);
    assert.match(page, /taking a moment to load/);
  });
  test("guest-count validation failure is explained (SQL allows up to 20 adults and 20 children)", () => assert.match(client, /up to 20 adults and 20 children/));
});
