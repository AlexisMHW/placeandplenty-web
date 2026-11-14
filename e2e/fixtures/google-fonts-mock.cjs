// Offline stand-in for Google Fonts CSS, consumed ONLY via NEXT_FONT_GOOGLE_MOCKED_RESPONSES by
// scripts/build-check.mjs and playwright.config.ts. Never referenced by the real build, so
// production keeps the real fonts. Keys are the exact URLs next/font requests for app/layout.
const face = (family, weight) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url(https://fonts.gstatic.com/mock/${family.replace(/\s/g, "")}.woff2) format('woff2');unicode-range:U+0000-00FF;}`;
module.exports = {
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap": face("Playfair Display", "400 900"),
  "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap": [300, 400, 700, 900].map((w) => face("Lato", w)).join("\n"),
};
