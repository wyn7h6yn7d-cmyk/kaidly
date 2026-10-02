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
      // Fluid type scale (docs/DESIGN.md §3). Marketing sizes may be large; app headings
      // stay practical; body copy never drops below 15 px.
      fontSize: {
        "display-1": ["clamp(2.05rem, 0.8rem + 4vw, 5rem)", { lineHeight: "0.98", letterSpacing: "-0.035em" }],
        "display-2": ["clamp(2.1rem, 1.2rem + 3.1vw, 4.5rem)", { lineHeight: "1.04", letterSpacing: "-0.03em" }],
        "display-3": ["clamp(1.55rem, 1.2rem + 1.4vw, 2.6rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        lead: ["clamp(1.125rem, 0.95rem + 0.55vw, 1.4375rem)", { lineHeight: "1.55" }],
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
