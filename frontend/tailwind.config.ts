import type { Config } from "tailwindcss";

/**
 * FaceLock design tokens.
 * Palette, radius, spacing and shadow values mirror the :root tokens supplied
 * for the dashboard (primary / secondary / accent / neutral scales).
 */
const primary = {
  50: "#f7f7f8",
  100: "#eeeff1",
  200: "#d8dade",
  300: "#bcc0c7",
  400: "#959ba7",
  500: "#6b7280",
  600: "#626875",
  700: "#4f545e",
  800: "#3c4048",
  900: "#2f3237",
  950: "#1f2024",
};

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary,
        // Remap Tailwind's bluish "slate" onto the neutral primary greys so that
        // every existing slate-* utility follows the new palette (no navy tones).
        slate: primary,
        secondary: {
          50: "#fffaea",
          100: "#fdf7e2",
          200: "#fbecbb",
          300: "#ffe285",
          400: "#ffd23d",
          500: "#ffc400",
          600: "#d6a400",
          700: "#ad8500",
          800: "#856600",
          900: "#5e4a08",
          950: "#3d3005",
        },
        accent: {
          50: "#fef9f1",
          100: "#fcf3e3",
          200: "#f9e3be",
          300: "#fad189",
          400: "#fcb740",
          500: "#f59e0b",
          600: "#ce8508",
          700: "#a76c07",
          800: "#7f5305",
          900: "#5b3e0b",
          950: "#3b2807",
        },
        neutral: {
          50: "#ffffff",
          100: "#f0f0f0",
          200: "#dbdbdb",
          300: "#c2c2c2",
          400: "#9e9e9e",
          500: "#808080",
          600: "#6b6b6b",
          700: "#575757",
          800: "#424242",
          900: "#333333",
          950: "#212121",
        },
        // Brand extras
        cream: "#fffaea",
        sage: "#78908c",
        graphite: "#5b5b5b",
        mint: {
          DEFAULT: "#00cd8f",
          50: "#e6fbf4",
          100: "#c2f5e3",
          600: "#00a874",
          700: "#00845b",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-avantt)", "sans-serif"],
        caps: ["var(--font-gridnik)", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2rem",
        "4xl": "2.5rem",
      },
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 4px 16px -6px rgb(0 0 0 / 0.08)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
