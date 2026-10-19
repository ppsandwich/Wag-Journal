import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: "auto",
      registerType: "prompt",
      manifest: {
        name: "Wag Journal",
        short_name: "Wag Journal",
        description: "A little rhythm for life with your puppy.",
        theme_color: "#355C49",
        background_color: "#F7F3EA",
        display: "standalone",
        start_url: "/",
        icons: [
          {src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
          {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf}"],
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
  server: { proxy: { "/api": { target: "http://127.0.0.1:3001" } } },
  build: { chunkSizeWarningLimit: 750 },
});
