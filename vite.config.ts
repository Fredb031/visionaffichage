import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Phase 8 perf — defer non-critical CSS.
 *
 * Vite injects the bundle's compiled CSS as a render-blocking
 * <link rel="stylesheet"> in <head>. On Lighthouse mobile that
 * 23.8 kB gzip / 607 ms wait was the next bottleneck after the
 * hero H1 LCP fix (4faf865).
 *
 * Strategy: rewrite the injected <link rel="stylesheet"> to a
 * preload-and-swap pattern so the browser can paint with the
 * inline critical CSS while the full sheet downloads at low
 * priority and gets attached on load. Adds a <noscript> fallback
 * for JS-disabled clients and an inline critical block (CSS
 * custom properties + body bg/color + safe-area pad) that keeps
 * the brand navy/gold tokens valid before the deferred sheet
 * arrives, avoiding FOUC on the home + PDP first paint.
 *
 * Only runs on `vite build` — dev keeps the eager <link> so HMR
 * style updates stay snappy.
 */
function deferNonCriticalCssPlugin(): Plugin {
  // Tiny inline critical CSS — only the essentials needed before
  // the deferred sheet attaches: brand HSL tokens, body bg/color,
  // body font fallback, and the visible-by-default flag for the
  // app shell. Everything else (Tailwind utilities, components,
  // animations) waits for the async stylesheet.
  const CRITICAL_CSS = `
:root{--background:0 0% 100%;--foreground:222 30% 9%;--primary:216 59% 26%;--primary-foreground:0 0% 100%;--secondary:43 18% 95%;--secondary-foreground:222 30% 9%;--muted:43 14% 91%;--muted-foreground:233 5% 63%;--accent:40 82% 40%;--accent-foreground:0 0% 100%;--border:40 12% 87%;--ring:216 59% 26%;--navy:216 59% 26%;--navy2:216 55% 22%;--navydark:218 62% 16%;--gold:40 82% 40%;--radius:1rem}
html{scroll-behavior:smooth;scroll-padding-top:80px}
body{margin:0;background-color:hsl(var(--background));color:hsl(var(--foreground));font-family:Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
#root{min-height:100vh}
*{-webkit-tap-highlight-color:transparent}
`.trim();

  return {
    name: "vision-defer-non-critical-css",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      // Match the bundle <link rel="stylesheet" ... href="/assets/...css">
      // injected by Vite. Skip absolute http(s) sheets (Google Fonts is
      // already deferred manually with its own media=print swap).
      const linkRegex = /<link\s+([^>]*?)rel=["']stylesheet["']([^>]*?)>/gi;

      const replaced = html.replace(linkRegex, (match, before, after) => {
        const attrs = `${before} ${after}`;
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/);
        if (!hrefMatch) return match;
        const href = hrefMatch[1];

        // Leave external (already-deferred) Google Fonts sheets alone —
        // they have their own media=print swap pattern in index.html.
        if (/^https?:/i.test(href)) return match;

        // Preserve any other attributes (crossorigin, integrity, etc.)
        // by stripping just rel/href/media/onload and re-emitting.
        const otherAttrs = attrs
          .replace(/\s*rel=["'][^"']*["']/i, "")
          .replace(/\s*href=["'][^"']*["']/i, "")
          .replace(/\s*media=["'][^"']*["']/i, "")
          .replace(/\s*onload=["'][^"']*["']/i, "")
          .trim();

        const otherAttrsStr = otherAttrs ? ` ${otherAttrs}` : "";

        // Preload-and-swap pattern: browser fetches the stylesheet at
        // preload priority but doesn't block render; onload flips it
        // to a real stylesheet. <noscript> fallback covers no-JS.
        return [
          `<link rel="preload" as="style" href="${href}"${otherAttrsStr} onload="this.onload=null;this.rel='stylesheet'">`,
          `<noscript><link rel="stylesheet" href="${href}"${otherAttrsStr}></noscript>`,
        ].join("");
      });

      // Inline critical CSS into <head> so the page paints with brand
      // tokens + body bg/color before the deferred sheet attaches.
      const criticalTag = `<style data-critical>${CRITICAL_CSS}</style>`;
      return replaced.replace("</head>", `${criticalTag}</head>`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    deferNonCriticalCssPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // 'hidden' generates .map files alongside the JS but does NOT inject a
    // //# sourceMappingURL comment into shipped JS. End users can't grab the
    // maps from the network panel, but build-time tooling (Sentry/Datadog
    // CLI uploads in CI) can ingest them to symbolicate minified prod stacks.
    sourcemap: "hidden",
    // Split the heavy 3D / canvas / framer libs out of the main bundle so the
    // landing page can hydrate fast and only load them when the customizer opens.
    rollupOptions: {
      output: {
        // Master Prompt performance config: split the bundle into named vendor
        // chunks so the landing page hydrates fast and the customizer/3D libs
        // load on-demand. Existing chunks preserved/merged.
        manualChunks: {
          // Master Prompt named chunks
          'react':    ['react', 'react-dom', 'react-router-dom'],
          'fabric':   ['fabric'],
          'supabase': ['@supabase/supabase-js'],
          // OP-9: split framer-motion out of `ui` so the eager bundle
          // doesn't ship motion code when only the customizer / cart
          // drawer / exit-intent modal need it. Lazy-importing the
          // consumers of framer pulls this chunk on demand.
          'framer':   ['framer-motion'],
          'ui':       ['sonner', 'lucide-react'],
          // Preserved from prior config
          'tanstack': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
