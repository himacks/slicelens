// Standalone config for `pnpm dev` / `pnpm build` (viewer only, no bridge).
// `slicelens serve` does NOT use this file — it builds the config inline so it can
// inject the bridge plugin and the pinned tmux pane. Keep this minimal.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: here,
    plugins: [react()],
    server: { port: 5180 }
});
