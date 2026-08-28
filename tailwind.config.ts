import type { Config } from "tailwindcss";

// Colour tokens are taken from the approved Visual Identity & Content
// System board (directive §11), sampled from the board's own swatches
// rather than transcribed from memory.
//
// TWO THINGS THE BOARD CORRECTED, both worth knowing before "fixing"
// these values back:
//
// 1. `sage` and `olive` were the wrong way round. On the board, sage is
//    the DEEPER muted green (#6B7766) and olive is the LIGHTER
//    yellow-green (#8A956E). The old config had olive darker than sage.
//
// 2. What this repo called `cream` (#EFE6D6) is the board's WARM TAUPE.
//    The board's actual cream (#F6F2E7) is a pale editorial ground, near
//    enough to the page background to be useless as a panel fill. Since
//    every existing `bg-cream` in the codebase is a warm panel, `cream`
//    keeps that job and takes the warm-taupe value; the pale ground is
//    `parchment`.
//
// ACCESSIBILITY CONSTRAINT ON `olive`. At #8A956E it is roughly 2.9:1 on
// offwhite — below WCAG AA for text of any size. It is a decorative tone
// only: fills, rules, icon shapes, large display. For secondary text and
// link hovers use `sage` (4.44:1 — large text only) or
// `forest` (11.2:1). `hover:text-olive`
// was replaced with `hover:text-sage` for exactly this reason.
//
// SAME CONSTRAINT ON `gold`. #C8A34A is 2.25:1 on offwhite — it was
// being used for every eyebrow on the site and failed AA everywhere on a
// light ground. It passes only on forest (4.98:1). Gold is a FILL, RULE
// and BORDER colour on light surfaces, and a text colour only on dark
// ones. Where gold-coloured text is genuinely wanted on a light ground,
// use `goldInk` (#745C1C, 6.01:1 on offwhite, 4.78:1 on cream).
//
// Eyebrows now use `text-forest/75` (5.34:1 on offwhite, 4.70:1 on
// cream) with a gold rule beside them where punctuation is wanted, which
// is also what the approved board actually shows — its eyebrows are dark
// text, and gold appears as button fills and thin rules.

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#1F3D2E",
        sage: "#6B7766",
        olive: "#8A956E",
        cream: "#E6DED0",
        parchment: "#F6F2E7",
        gold: "#C8A34A",
        goldInk: "#745C1C",
        charcoal: "#2B2B2B",
        offwhite: "#FAF8F3",
        error: "#B3261E",
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        body: ["var(--font-lato)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        editorial: "72rem",
        prose: "40rem",
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(31, 61, 46, 0.08)",
        softer: "0 2px 12px rgba(31, 61, 46, 0.06)",
        lift: "0 10px 40px rgba(31, 61, 46, 0.14)",
      },
      transitionDuration: {
        400: "400ms",
      },
    },
  },
  plugins: [],
};
export default config;
