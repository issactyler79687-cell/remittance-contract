import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@stellar")) {
            return "stellar";
          }

          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        }
      }
    }
  }
});