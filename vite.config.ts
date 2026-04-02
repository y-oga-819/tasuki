/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react";

// https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

// When running in a git worktree, pnpm resolves packages from the main
// repo's node_modules which falls outside the default allow list.
// Allow both the local and main repo node_modules so workers (e.g. @pierre/diffs) can load.
const nodeModulesTarget = fs.realpathSync(path.resolve("node_modules"));

// In a worktree (.wt/<branch>), the main repo is two levels up.
// Detect this and allow its node_modules as well.
const worktreeMainNodeModules = (() => {
  const cwd = process.cwd();
  const wtMatch = cwd.match(/^(.+)\/\.wt\/[^/]+$/);
  if (wtMatch) {
    const mainNodeModules = path.join(wtMatch[1], "node_modules");
    if (fs.existsSync(mainNodeModules)) return mainNodeModules;
  }
  return null;
})();

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
  clearScreen: false,
  server: {
    host: host || false,
    port: 1420,
    strictPort: true,
    fs: {
      allow: [nodeModulesTarget, ...(worktreeMainNodeModules ? [worktreeMainNodeModules] : []), "."],
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  worker: {
    format: "es",
  },
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari14",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
