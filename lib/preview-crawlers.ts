// Controlled crawler access for invitation link previews (founder decision 6).
//
// WHY: /invite/<token> is a bearer-token page. Chat and social apps (iMessage, WhatsApp, Slack, Facebook, X, LinkedIn, Discord,
// Telegram) fetch the link once to build the preview card. Blocking them in robots.txt makes every invitation link show as a bare
// URL. They are therefore allowed to fetch invitation links, and ONLY them, under these guarantees:
//   1. The crawler is served a CARD-ONLY response (see isPreviewCrawler + the invite page): title, host name, calendar date and the
//      invitation artwork, via lib/invite-preview.ts. The full guest page (address, time, notes, guest names, household) is never
//      rendered for a crawler, so it cannot leak into a cache, a log or a forwarded preview, even if the crawler misbehaves.
//   2. Every response stays noindex, nofollow (meta robots + X-Robots-Tag). Search engines are NOT on the allow list (no Googlebot,
//      Bingbot, Applebot): the link is never indexed.
//   3. Revoked / unknown links and completed / cancelled / archived gatherings get the generic preview (lib/invite-preview.ts).
//   4. The artwork is served through our own /invite/<token>/preview route, never the signed storage URL.
// A client that merely claims one of these names gets the LESS detailed card page, never more, so spoofing gains nothing.
// This module is pure (no network, no React) so the allow list, the robots rule and the page branch are tested together.

/** User-agent product tokens of the link-preview fetchers we allow. Matching is case-insensitive on the product token. */
export const PREVIEW_CRAWLER_AGENTS = [
  "facebookexternalhit", // Facebook, Messenger, and what Apple's iMessage link previews identify as
  "Facebot",
  "Twitterbot",
  "Slackbot",
  "Slackbot-LinkExpanding",
  "Slack-ImgProxy",
  "WhatsApp",
  "LinkedInBot",
  "Discordbot",
  "TelegramBot",
] as const;

// Search-engine and general-purpose crawlers are deliberately absent. Listed so a test can prove they never get the card branch.
export const NEVER_PREVIEW_CRAWLERS = ["Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "YandexBot", "Baiduspider", "GPTBot", "CCBot"] as const;

const PATTERN = new RegExp(`(?:^|[^a-z0-9])(?:${PREVIEW_CRAWLER_AGENTS.map((a) => a.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|")})(?![a-z0-9])`, "i");

/** True when the User-Agent identifies one of the allowed link-preview fetchers. */
export function isPreviewCrawler(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").slice(0, 512);
  if (!ua) return false;
  if (NEVER_PREVIEW_CRAWLERS.some((n) => new RegExp(`(?:^|[^a-z0-9])${n}(?![a-z0-9])`, "i").test(ua))) return false;
  return PATTERN.test(ua);
}
