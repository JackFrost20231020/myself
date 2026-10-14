import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { contentPlugin } from "./content/plugin.ts";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  plugins: [react(), contentPlugin({ dir: here("../content") })],
  build: {
    outDir: here("../dist"),
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
  },
});
