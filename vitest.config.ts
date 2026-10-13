import { defineConfig } from "vitest/config";

export default defineConfig({
  // 页面用 Hono 的 JSX，测试时也按 hono/jsx 编译
  oxc: { jsx: { runtime: "automatic", importSource: "hono/jsx" } },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "web/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
