import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5175,
    strictPort: true,
    fs: {
      // Allow serving/watching the sibling shared/ workspace package (symlinked
      // into node_modules/@nightfall/shared) — it lives outside client/'s own root.
      allow: [".."],
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
