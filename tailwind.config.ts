import type { Config } from "tailwindcss";

/** Tokens map to the CSS custom properties defined in globals.css (see DESIGN.md). */
const config: Config = {
  darkMode: ['selector', ':root[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "logo-plate": "var(--logo-plate)",
        border: "var(--border)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-weak": "var(--primary-weak)",
        "on-primary": "var(--on-primary)",
        gold: "var(--gold)",
        "on-gold": "var(--on-gold)",
        win: "var(--win)",
        loss: "var(--loss)",
        live: "var(--live)",
        review: "var(--review)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
    },
  },
  plugins: [],
};

export default config;
