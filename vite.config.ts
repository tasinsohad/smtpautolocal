import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackRouter(),
    tanstackStart({
      server: {
        preset: "cloudflare-workers",
      },
    }),
    react(),
    tailwindcss(),
  ],
  // Optimize for edge deployment
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
