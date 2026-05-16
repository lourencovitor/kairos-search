import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    pool: "forks",
    passWithNoTests: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
