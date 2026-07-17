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
      fontFamily: {
        display: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'sans-serif'],
        mono: ['Courier New', 'Courier', 'monospace'],
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
        navy: {
          DEFAULT: "hsl(var(--navy))",
          light: "hsl(var(--navy2))",
          dark: "hsl(var(--navydark))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          light: "hsl(var(--gold2))",
        },
        green: "hsl(var(--green))",
        brand: {
          black: '#0A0A0A',
          white: '#FFFFFF',
          blue: '#0052CC',
          'blue-hover': '#003D99',
          'blue-light': '#EBF2FF',
          dark: '#111827',
          grey: '#6B7280',
          'grey-strong': '#374151',
          'grey-light': '#F9FAFB',
          'grey-border': '#E5E7EB',
          'grey-mid': '#D1D5DB',
          success: '#059669',
          error: '#DC2626',
          warning: '#D97706',
        },
        va: {
          // Mega Prompt v4.0 — "Industrial Precision" direction. Gold #C4852A
          // replaces blue site-wide; the historical `va.blue` alias now
          // resolves to gold so legacy `bg-va-blue` callers automatically
          // adopt the new accent without a hand-migration sweep.
          ink:           '#111111',
          paper:         '#FAFAF8',
          warm:          '#F0EDE8',
          white:         '#FFFFFF',
          dark:          '#111111',
          gold:          '#C4852A',
          'gold-h':      '#B07520',
          'gold-tint':   '#FAF3E5',
          dim:           '#666660',
          muted:         '#AAAAAA',
          ghost:         '#DDDDDD',
          border:        '#EBEBEB',
          line:          '#EBEBEB',
          ok:            '#4A7C59',
          warn:          '#C4852A',
          err:           '#B84040',
          // Legacy aliases — every existing `bg-va-blue` / `text-va-blue` /
          // `bg-va-sand` / `bg-va-stone` call site keeps compiling, but now
          // renders gold/paper/warm to match the new identity. No hand
          // migration required across the rest of the codebase.
          blue:          '#C4852A', // alias → gold
          'blue-hover':  '#B07520', // alias → gold-h
          'blue-tint':   '#FAF3E5', // alias → gold-tint
          sand:          '#FAFAF8', // alias → paper
          stone:         '#F0EDE8', // alias → warm
          black:         '#111111', // alias → ink
          'blue-h':      '#B07520', // legacy alias → gold-h
          'blue-l':      '#FAF3E5', // legacy alias → gold-tint
          offwhite:      '#FAFAF8', // alias → paper
          'line-h':      '#DDDDDD', // alias → ghost
          'bg-1':        '#FFFFFF',
          'bg-2':        '#FAFAF8',
          'bg-3':        '#F0EDE8',
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
