import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.stories.tsx", "**/*.d.ts", "src/index.ts"],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
