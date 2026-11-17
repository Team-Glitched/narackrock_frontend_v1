import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "react-runtime", test: /[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/ }],
        },
      },
    },
  },
  server: {
    allowedHosts: ["narackrock.com"],
    ...(process.env.CODEX_SANDBOX === "seatbelt"
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {}),
  },
});
