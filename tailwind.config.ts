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
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        lora: ['Lora', 'serif'],
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // Shadcn animations
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        // Custom animations
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        "fade-in-up": { from: { opacity: "0", transform: "translateY(18px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        starburst: { "0%": { opacity: "1", transform: "scale(0.4) translate(-50%,-50%)" }, "100%": { opacity: "0", transform: "scale(2) translate(-50%,-130%)" } },
        "bounce-in": { "0%,100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.2)" } },
        "confetti-fall": { to: { transform: "translateY(110vh) rotate(840deg)", opacity: "0" } },
        staggerUp: { to: { opacity: "1", transform: "translateY(0)" } },
        heroLogoScroll: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        marqueeScroll: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        // Cinematic loader
        ldGridIn: { to: { opacity: "1" } },
        ldLogoUp: { to: { opacity: "1", transform: "translateY(0)" } },
        ldLineDraw: { to: { width: "280px" } },
        ldTagIn: { to: { color: "rgba(255,255,255,.25)" } },
        ldCornerIn: { to: { opacity: "1" } },
        ldCurtain: { "0%": { transform: "translateY(0)" }, "100%": { transform: "translateY(-100%)" } },
        ldScan: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100vw)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 20s linear infinite",
        "fade-in-up": "fade-in-up 0.75s ease-out forwards",
        starburst: "starburst 0.6s ease forwards",
        "bounce-in": "bounce-in 0.4s ease",
        "confetti-fall": "confetti-fall 3.5s ease forwards",
        "stagger-up": "staggerUp 0.7s cubic-bezier(.16,1,.3,1) forwards",
        "hero-logo-scroll": "heroLogoScroll 24s linear infinite",
        "marquee-scroll": "marqueeScroll 28s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
