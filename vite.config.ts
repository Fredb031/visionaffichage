import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Section 10.2 — split the heavy framework, animation, canvas, query and
    // data libs out of the main bundle so the landing page can hydrate fast
    // and only fetches the heavyweight chunks when the relevant route mounts
    // (customizer pulls fabric, motion-heavy pages pull framer/gsap, etc.).
    // @shopify/hydrogen-react is referenced in the Master Prompt brief but
    // isn't in package.json — omitted here so rollup doesn't choke on a
    // missing module.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion':   ['framer-motion', 'gsap'],
          'vendor-fabric':   ['fabric'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query':    ['@tanstack/react-query'],
          'vendor-icons':    ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    target: 'esnext',
  },
}));
