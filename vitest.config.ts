import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves tsconfig `paths` natively; no plugin needed for the "@/*" alias.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // E2E belongs to Playwright; evals are run explicitly, not in the default gate.
    exclude: ["node_modules/**", "tests/e2e/**", "tests/evals/**"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.d.ts"],
    },
  },
});
