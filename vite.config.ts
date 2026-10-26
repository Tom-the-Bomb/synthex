import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    // Caches the whole app on the first visit so it works offline. A new
    // deploy installs in the background and is served from the next load.
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // public/site.webmanifest
      workbox: {
        globPatterns: [
          "**/*.{html,js,css,woff2,svg,png,ico,webmanifest}",
          "**/geist-mono-latin-400-normal-*.woff", // the 3D labels' font
        ],
        globIgnores: ["og-image.png"],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
