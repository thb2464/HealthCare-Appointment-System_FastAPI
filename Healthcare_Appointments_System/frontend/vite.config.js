import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Output directly into the FastAPI static folder so the monolith can serve
    // the SPA without any extra copy step.
    outDir: path.resolve(__dirname, "../backend/app/static"),
    emptyOutDir: true,
  },

  server: {
    // During local development proxy all /api/* requests to the FastAPI backend
    // so you never need to change CORS settings.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
