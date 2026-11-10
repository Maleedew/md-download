import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// During `npm run dev` the Vite dev server proxies /api to the local backend
// (npm run server → http://localhost:8787), so no CORS setup is needed locally.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  preview: {
    port: 4173,
    proxy: { "/api": "http://localhost:8787" },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
