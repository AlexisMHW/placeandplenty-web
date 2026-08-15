import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://placeandplenty.com";
  const routes = [
    "",
    "/founding-host",
    "/support",
    "/privacy",
    "/terms",
    "/delete-account",
    "/coordinated-host",
  ];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.6,
  }));
}
