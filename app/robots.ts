import { MetadataRoute } from "next";
import { PREVIEW_CRAWLER_AGENTS } from "@/lib/preview-crawlers";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Link-preview fetchers only (iMessage / WhatsApp / Slack / Facebook / X / LinkedIn / Discord / Telegram): they may read
        // invitation links to build the preview card. They are served a card-only page (title, host, date, artwork) and every
        // response stays noindex, nofollow: see lib/preview-crawlers.ts for the guarantees. Search engines are not listed.
        userAgent: [...PREVIEW_CRAWLER_AGENTS],
        allow: ["/invite/"],
        disallow: ["/gallery/", "/command-center/", "/creator/"],
      },
      {
        userAgent: "*",
        allow: "/",
        // Both of these are bearer-token URLs and must never be crawled or
        // indexed. noindex is set per-page as the primary control; this is
        // a second layer.
        //
        // Note the trailing slashes: these match /invite/<token> and
        // /gallery/<token>, NOT the bare /invite landing page, which
        // carries its own noindex.
        // Private signed-in areas are never useful to a crawler (and the first two are noindex too).
        disallow: ["/invite/", "/gallery/", "/command-center/", "/creator/"],
      },
    ],
    sitemap: "https://placeandplenty.com/sitemap.xml",
  };
}
