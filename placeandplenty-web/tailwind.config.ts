import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#1E3A2E",
        olive: "#6A7F5E",
        sage: "#A7B39A",
        gold: "#C8A66A",
        cream: "#EFE6D6",
        offwhite: "#FAF7F2",
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
        soft: "0 4px 24px rgba(30, 58, 46, 0.08)",
        softer: "0 2px 12px rgba(30, 58, 46, 0.06)",
      },
      transitionDuration: {
        400: "400ms",
      },
    },
  },
  plugins: [],
};
export default config;
