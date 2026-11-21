const { assertPreviewIsolationRan } = require("./scripts/lib/preview-marker.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // AVIF is intentionally disabled here. Next 14.2.x is vulnerable in the
    // AVIF image-optimizer path; WebP preserves modern image delivery without
    // exposing that decoder path. Re-enable only after Next is on a patched line.
    formats: ["image/webp"],

    // TINA CLOUD SERVES UPLOADED MEDIA FROM ITS OWN CDN, and without
    // this entry next/image refuses to optimise any of it — the
    // optimiser returns 400 and the picture never appears. That was the
    // state on 28 Aug 2026: every image a founder uploaded through the
    // editor would have failed to render, silently, with a broken
    // homepage hero as the visible symptom. See lib/tina-content.ts for
    // the other half of this.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tina.io",
        pathname: "/**",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/index.html",
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        // Invitation links are bearer-token pages: never indexed, never followed, even for the link-preview fetchers that robots.txt
        // lets read them (lib/preview-crawlers.ts). The per-page meta robots is the first control; this header is the second.
        source: "/invite/:token*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        // Apple fetches this from the bare apex and will not follow a
        // redirect, so the canonical host must serve it directly —
        // placeandplenty.com is the Production domain and www 308s to
        // it, which is the right way round.
        //
        // The file has NO extension by Apple's requirement, so nothing
        // infers a content type for it. Apple requires application/json
        // and rejects it otherwise, which is a genuinely annoying way to
        // fail because the file looks fine in a browser.
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        // Android infers this one correctly from the .json extension.
        // Set explicitly anyway so both files are governed in one place.
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

// Build-time self-check (A8 n5): on a Vercel Preview production build, refuse to continue unless the isolation guard
// (scripts/check-preview-isolation.mjs, first step of `npm run build`) ran and passed in this same build. This keeps an
// overridden Build Command from silently skipping the guard. No effect on dev, `next start`, production or local builds.
module.exports = (phase) => {
  assertPreviewIsolationRan(phase, process.env);
  return nextConfig;
};
