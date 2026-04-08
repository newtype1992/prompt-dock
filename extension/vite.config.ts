import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { createManifest } from "./manifest.config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, ".."), "");

  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    root: __dirname,
    plugins: [react(), crx({ manifest: createManifest(env) })],
    resolve: {
      alias: {
        "@": resolve(__dirname, ".."),
      },
    },
    build: {
      outDir: resolve(__dirname, "../dist/extension"),
      emptyOutDir: true,
    },
  };
});
