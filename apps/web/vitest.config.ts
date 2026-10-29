import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Fixed browser zone so time-zone conversions are deterministic.
process.env.TZ = "Europe/Belgrade";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    server: { deps: { inline: ["next-intl"] } },
  },
});
