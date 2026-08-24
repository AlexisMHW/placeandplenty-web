import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Guest invite pages are bearer-token URLs and must never be
      // crawled or indexed — noindex is also set per-page as the
      // primary control, this is a second layer.
      disallow: ["/invite/"],
    },
    sitemap: "https://placeandplenty.com/sitemap.xml",
  };
}
