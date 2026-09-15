/// <reference types="vitest/config" />
import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Demo mode by default, matching src/api/liveMode.ts's own escape
    // hatch: no test should be able to reach a real backend because a
    // stray localStorage flag survived from somewhere else.
    env: { VITE_DEMO_MODE: "true" },
  },
})
