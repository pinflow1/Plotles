import type { Config } from "tailwindcss";

// Brand system is fixed: five values, no accent color, ever.
// Raw tokens (clay/casper/gray/charcoal/deep) are the literal palette —
// used by things like the text-color swatch picker where the actual
// hex matters regardless of theme. Semantic tokens (paper/surface/ink/...)
// are theme-aware, driven by CSS variables that flip under .dark in
// globals.css, so most UI should reach for the semantic names.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: "#D8D2C4",
        casper: "#C9C7C2",
        ink: {
          DEFAULT: "#242424",
          soft: "#8E8E8E",
        },
        deep: "#111111",
        paper: "var(--paper)",
        surface: "var(--surface)",
        text: {
          DEFAULT: "var(--text)",
          soft: "var(--text-soft)",
        },
        divider: "var(--divider)",
        overlay: "var(--overlay)",
        active: "var(--active)",
        strong: "var(--strong)",
        "on-strong": "var(--on-strong)",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Iowan Old Style", "Palatino Linotype", "Georgia", "Times New Roman", "serif"],
        "serif-classic": ["var(--font-source-serif)", "Iowan Old Style", "Georgia", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      transitionTimingFunction: {
        sheet: "cubic-bezier(.32,.72,0,1)",
      },
      borderRadius: {
        sheet: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
