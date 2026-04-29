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
          'ui':       ['sonner', 'lucide-react', 'framer-motion'],
          // Preserved from prior config
          'tanstack': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
