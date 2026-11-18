// A8 privacy: bearer-token pages are noindex, previews never include the address, analytics paths hide tokens.
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { WEB_ROOT, walk, read, rel, stripComments } from "../regression/scan-support.ts";
import { buildPreviewDescription } from "../../lib/share-invite.ts";
import { sanitizePathForAnalytics } from "../../lib/analytics-privacy.ts";

const TOKEN = "11111111-2222-4333-8444-555555555555";

test("every token page under app/(guest) is noindex", () => {
  const pages = walk(join(WEB_ROOT, "app/(guest)"), [".tsx"]).filter((f) => /\/page\.tsx$/.test(f));
  assert.ok(pages.length >= 4);
  for (const p of pages) assert.match(read(p), /index:\s*false/, `${rel(p)} must be noindex`);
});

test("generateMetadata and the preview route never touch location, guests or emails", () => {
  for (const f of ["app/(guest)/i/[token]/page.tsx", "app/(guest)/i/[token]/preview/route.ts"]) {
    const src = stripComments(read(join(WEB_ROOT, f)));
    const a = src.indexOf("export async function generateMetadata");
    const body = a >= 0 ? src.slice(a, src.indexOf("export default", a) > 0 ? src.indexOf("export default", a) : undefined) : src.replace(/^import .*$/gm, "");
    assert.doesNotMatch(body, /\b(displayLocation|locationNote|location|address|guests?|guestEmail|email)\b/i, f);
  }
});

test("the preview description is built without any address field", () => {
  const d = buildPreviewDescription({ displayName: "Dinner", displayDate: "2026-12-05", displayTime: "18:00", displayLocation: "12 Secret Lane", hostDisplayName: "Alex" } as never);
  assert.doesNotMatch(String(d), /Secret Lane/);
});

test("analytics paths never carry a guest/share token or a referral code", () => {
  for (const p of [`/i/${TOKEN}`, `/invite/${TOKEN}`, `/gallery/${TOKEN}`, `/i/${TOKEN}/preview`]) {
    assert.doesNotMatch(sanitizePathForAnalytics(p), new RegExp(TOKEN), p);
  }
});

test("token routes are not listed in the sitemap and are disallowed or noindex in robots", () => {
  const sitemap = stripComments(read(join(WEB_ROOT, "app/sitemap.ts")));
  assert.doesNotMatch(sitemap, /\/(i|invite|gallery)\/\[?token|\/r\//);
});
