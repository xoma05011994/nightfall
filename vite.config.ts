import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5175,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
