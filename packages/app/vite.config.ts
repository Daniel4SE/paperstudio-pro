import { defineConfig } from "vite"
import desktopPlugin from "./vite"

export default defineConfig({
  plugins: [desktopPlugin] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 5555,
  },
  build: {
    target: "esnext",
    // sourcemap: true,
  },
  optimizeDeps: {
    // Exclude WASM-dependent packages from pre-bundling
    exclude: ["@siglum/engine"],
  },
})
