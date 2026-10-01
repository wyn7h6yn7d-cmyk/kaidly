import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // KAIDLY tokens — docs/DESIGN.md §2
        k: {
          green: token("k-green"),
          "green-hover": token("k-green-hover"),
          volt: token("k-volt"),
          "volt-hover": token("k-volt-hover"),
          ink: token("k-ink"),
          grey: token("k-grey"),
          paper: token("k-paper"),
          "paper-2": token("k-paper-2"),
          sand: token("k-sand"),
          surface: token("k-surface"),
          line: token("k-line"),
          muted: token("k-muted"),
          warn: token("k-warn"),
          danger: token("k-danger"),
        },
        // shadcn/ui names used by the primitives in components/ui
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
        // Handwritten brand notes — marketing page only (loaded there), never in app UI.
        hand: ["var(--font-hand)", "cursive"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
