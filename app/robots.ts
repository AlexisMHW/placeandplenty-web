import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Both of these are bearer-token URLs and must never be crawled or
      // indexed. noindex is set per-page as the primary control; this is
      // a second layer.
      //
      // Note the trailing slashes: these match /invite/<token> and
      // /gallery/<token>, NOT the bare /invite landing page, which
      // carries its own noindex.
      disallow: ["/invite/", "/gallery/"],
    },
    sitemap: "https://placeandplenty.com/sitemap.xml",
  };
}
