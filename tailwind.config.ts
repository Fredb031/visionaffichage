import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      // Section 1.3 — Inter for body, DM Sans for display, JetBrains Mono
      // for code. The legacy `lora` family has been retired; no
      // `font-lora` consumers remain.
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      // Section 1.2 — exact type scale from the redesign brief.
      // Tuple is [size, line-height]; both in rem-equivalent px values.
      fontSize: {
        xs: ['11px', '16px'],
        sm: ['13px', '18px'],
        base: ['15px', '22px'],
        lg: ['17px', '24px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '38px'],
        '4xl': ['38px', '46px'],
        '5xl': ['48px', '56px'],
        '6xl': ['60px', '68px'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        green: "hsl(var(--green))",
        // Freud × Bernays redesign — Section 1.1 brand palette. Every
        // component has migrated onto brand.* tokens.
        brand: {
          black: '#0A0A0A',
          white: '#FFFFFF',
          blue: '#0052CC',
          'blue-hover': '#003D99',
          'blue-light': '#EBF2FF',
          dark: '#111827',
          grey: '#6B7280',
          'grey-light': '#F9FAFB',
          'grey-border': '#E5E7EB',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // Kept: live animations still referenced in src/.
        starburst: { "0%": { opacity: "1", transform: "scale(0.4) translate(-50%,-50%)" }, "100%": { opacity: "0", transform: "scale(2) translate(-50%,-130%)" } },
        staggerUp: { to: { opacity: "1", transform: "translateY(0)" } },
        heroLogoScroll: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        marqueeScroll: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        starburst: "starburst 0.6s ease forwards",
        "stagger-up": "staggerUp 0.7s cubic-bezier(.16,1,.3,1) forwards",
        "hero-logo-scroll": "heroLogoScroll 24s linear infinite",
        "marquee-scroll": "marqueeScroll 28s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
