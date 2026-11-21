import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPreviewCrawler, NEVER_PREVIEW_CRAWLERS, PREVIEW_CRAWLER_AGENTS } from "../lib/preview-crawlers.ts";
import { buildInvitePreview } from "../lib/invite-preview.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("controlled link-preview crawler access (founder decision 6)", () => {
  test("recognises the real link-preview fetchers", () => {
    const real = [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (compatible; Twitterbot/1.0)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Slackbot 1.0 (+https://api.slack.com/robots)",
      "WhatsApp/2.23.20.0 A",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "TelegramBot (like TwitterBot)",
      "facebookexternalhit/1.1 Facebot Twitterbot/1.0", // what iMessage's preview fetcher sends
    ];
    for (const ua of real) assert.equal(isPreviewCrawler(ua), true, ua);
  });
  test("search engines, AI crawlers and ordinary browsers are never treated as preview crawlers", () => {
    const no = [
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)",
      "", null, undefined,
    ];
    for (const ua of no) assert.equal(isPreviewCrawler(ua as string), false, String(ua));
    // a search engine that also names a preview product still never gets the card branch
    assert.equal(isPreviewCrawler("Googlebot Twitterbot"), false);
    assert.ok(NEVER_PREVIEW_CRAWLERS.includes("Googlebot"));
  });
  test("a lookalike token is not a match", () => {
    assert.equal(isPreviewCrawler("Mozilla/5.0 NotTwitterbotish"), false);
    assert.equal(isPreviewCrawler("x".repeat(100000) + " Twitterbot"), false); // only the first 512 chars are read
  });

  test("robots.txt: only the preview fetchers may read /invite/; everyone else stays disallowed; gallery and private areas stay closed for all", () => {
    const r = read("app/robots.ts");
    assert.match(r, /userAgent: \[\.\.\.PREVIEW_CRAWLER_AGENTS\]/);
    assert.match(r, /allow: \["\/invite\/"\]/);
    // the catch-all rule still disallows invitation links
    const star = r.slice(r.indexOf('userAgent: "*"'));
    for (const p of ["/invite/", "/gallery/", "/command-center/", "/creator/"]) assert.ok(star.includes(`"${p}"`), p);
    const previewRule = r.slice(r.indexOf("userAgent: [...PREVIEW_CRAWLER_AGENTS]"), r.indexOf('userAgent: "*"'));
    for (const p of ["/gallery/", "/command-center/", "/creator/"]) assert.ok(previewRule.includes(`"${p}"`), p);
    for (const se of ["Googlebot", "Bingbot", "Applebot"]) assert.ok(!PREVIEW_CRAWLER_AGENTS.includes(se as never), se);
  });
  test("the invite page serves a card-only response to a crawler BEFORE any guest-page rendering or living-page lookup", () => {
    const page = read("app/(guest)/invite/[token]/page.tsx");
    const branch = page.indexOf("isPreviewCrawler(headers().get(\"user-agent\"))");
    assert.ok(branch > 0);
    assert.ok(branch < page.indexOf("lookupGuestLivingPage(params.token)"), "crawler branch precedes the living-page lookup");
    assert.ok(branch < page.indexOf("<GuestPageClient"), "crawler branch precedes the full guest page");
    const card = page.slice(branch, page.indexOf("const [result, livingResult]"));
    assert.doesNotMatch(card, /displayLocation|locationNote|displayTime|displayDescription|partyMembers|partyName|contactEmail|GuestPageClient|GuestLivingPanel|initialData/);
  });
  test("noindex, nofollow stays on every branch and as a response header", () => {
    const page = read("app/(guest)/invite/[token]/page.tsx");
    assert.match(page, /const noindex = \{ index: false, follow: false \} as const/);
    assert.match(read("next.config.js"), /source: "\/invite\/:token\*"[\s\S]{0,200}X-Robots-Tag[\s\S]{0,60}noindex, nofollow/);
  });
  test("the crawler card for each state: open, closed, revoked/unknown reveal only what the preview allows", () => {
    const open = buildInvitePreview({ found: true, displayName: "Fall Supper", hostDisplayName: "Alexis", displayDate: "2026-11-21", gatheringStatus: "active", hasArtwork: false });
    assert.match(open.description, /from Alexis on Place & Plenty/);
    for (const closed of ["completed", "cancelled", "archived"]) {
      const c = buildInvitePreview({ found: true, displayName: "Fall Supper", hostDisplayName: "Alexis", gatheringStatus: closed });
      assert.doesNotMatch(JSON.stringify(c), /Fall Supper|Alexis/);
    }
    const revoked = buildInvitePreview({ found: false, displayName: "Fall Supper", hostDisplayName: "Alexis" });
    assert.doesNotMatch(JSON.stringify(revoked), /Fall Supper|Alexis/);
  });
  test("host name shown in a preview is the guest-facing name, never an email or id", () => {
    for (const hostDisplayName of ["jane@example.com", "3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9b1e44", "   "]) {
      const p = buildInvitePreview({ found: true, displayName: "Fall Supper", hostDisplayName, gatheringStatus: "active" });
      assert.match(p.description, /^You have received an invitation on Place & Plenty\./);
    }
    const named = buildInvitePreview({ found: true, displayName: "Fall Supper", hostDisplayName: "Alexis H.", gatheringStatus: "active" });
    assert.match(named.description, /from Alexis H\. on Place & Plenty/);
  });
});
