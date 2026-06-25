import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.mobile.html",
    },
  },
});