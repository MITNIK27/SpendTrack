/// <reference types="vitest/config" />
import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // No fixed port — other local projects also use 5173/9005, so let Vite try
  // 5173 and fall through to the next free port (5174, 5175, ...) on its own.
  test: { globals: true, environment: "jsdom", setupFiles: ["./src/test/setup.ts"], css: false },
})
