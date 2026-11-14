// Offline production-build helper: Next's documented test hook NEXT_FONT_GOOGLE_MOCKED_RESPONSES.
// Answers any fonts.googleapis.com CSS request with a tiny @font-face; Next uses the font URL string as the file bytes when mocked.
// ONLY for verifying that the app compiles in an environment without internet. Never used for Vercel builds.
const face = (family, weight, style) => `@font-face {font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(https://fonts.gstatic.com/s/mock/${family.replace(/ /g, "")}-${String(weight).replace(/ /g, "_")}-${style}.woff2) format('woff2');unicode-range:U+0000-00FF;}`;
const css = (url) => /Lato/.test(url)
  ? [300, 400, 700, 900].map((w) => face("Lato", w, "normal")).join("\n")
  : [face("Playfair Display", "400 900", "normal"), face("Playfair Display", "400 900", "italic")].join("\n");
module.exports = new Proxy({}, { get: (_t, url) => (typeof url === "string" && url.startsWith("https://fonts.googleapis.com") ? css(url) : undefined) });
