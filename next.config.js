/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
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

module.exports = nextConfig;
