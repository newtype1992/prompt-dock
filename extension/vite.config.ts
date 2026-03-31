import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  root: __dirname,
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": resolve(__dirname, ".."),
    },
  },
  build: {
    outDir: resolve(__dirname, "../dist/extension"),
    emptyOutDir: true,
  },
});
