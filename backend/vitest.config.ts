import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup-env.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // All suites share one in-memory MongoDB; run files sequentially to keep state predictable.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
