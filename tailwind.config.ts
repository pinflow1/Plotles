import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        text: {
          DEFAULT: "var(--text)",
          soft: "rgb(var(--text-soft-rgb) / <alpha-value>)",
        },
        divider: "var(--divider)",
        overlay: "var(--overlay)",
        active: "var(--active)",
        strong: "rgb(var(--strong-rgb) / <alpha-value>)",
        "on-strong": "var(--on-strong)",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        "serif-classic": ["var(--font-source-serif)", "Georgia", "serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        sheet: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
