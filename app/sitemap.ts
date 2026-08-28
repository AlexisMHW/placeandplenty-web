import { MetadataRoute } from "next";
import { STATIC_SITEMAP_ROUTES } from "@/lib/nav";
import {
  getAllPosts,
  getAllGatheringIdeas,
  getAllCommunityStories,
} from "@/lib/tina-content";

// The sitemap is generated, not maintained by hand.
//
// It was a hardcoded list of seven routes, which had already drifted — it
// was missing every page added since, and it could not have known about a
// single article. Two sources now feed it, neither of them this file:
//
//   - lib/nav.ts for the fixed public routes, so a page that appears in
//     the navigation is in the sitemap by construction
//   - Tina for published content, so an article is listed the moment it
//     is published and disappears when it is unpublished
//
// WHAT IS DELIBERATELY EXCLUDED:
//
//   /invite/[token], /gallery/[token] — bearer-token URLs. Listing one
//     would publish somebody's invitation. robots.ts disallows them and
//     each page carries its own noindex; this is the third layer.
//   /get — a user-agent forwarder with nothing to index, and it would
//     compete with /pricing for the same intent.
//   Anything with `noindex` set in Tina — an author asking a piece to
//     stay out of search should not find it advertised in the sitemap.
//
// lastModified uses each document's own publish date where it has one, so
// a crawler is not told that every page on the site changed today.

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://placeandplenty.com";
  const now = new Date();

  const staticEntries = STATIC_SITEMAP_ROUTES.map((route) => ({
    url: `${base}${route === "/" ? "" : route}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route === "/" ? 1 : 0.6,
  }));

  const [posts, ideas, stories] = await Promise.all([
    getAllPosts(),
    getAllGatheringIdeas(),
    getAllCommunityStories(),
  ]);

  const contentEntries = [
    ...ideas
      .filter((d) => !d.noindex)
      .map((d) => ({
        url: `${base}/gathering-ideas/${d._sys.filename}`,
        lastModified: d.publishDate ? new Date(d.publishDate) : now,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ...posts
      .filter((d) => !d.noindex)
      .map((d) => ({
        url: `${base}/coordinated-host/${d._sys.filename}`,
        lastModified: new Date(d.updatedDate || d.publishDate || now),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ...stories
      .filter((d) => !d.noindex)
      .map((d) => ({
        url: `${base}/show-us-how-you-gather/${d._sys.filename}`,
        lastModified: d.publishDate ? new Date(d.publishDate) : now,
        changeFrequency: "yearly" as const,
        priority: 0.5,
      })),
  ];

  return [...staticEntries, ...contentEntries];
}
