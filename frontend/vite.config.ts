import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite config with @ alias mapping to src directory for clean imports.
// Manual chunks split large vendor deps (ethers, web3modal) into separate
// bundles so the main entry stays small and caches well across deploys.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    open: false,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ethers-vendor": ["ethers"],
          "web3modal-vendor": ["@web3modal/ethers"],
        },
      },
    },
  },
});
