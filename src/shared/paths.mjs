// Resolves the slicelens workspace layout. Everything for a single review run lives
// under <cwd>/.slicelens so the tool can run against any target repo: you `cd` into
// the repo under review and slicelens writes its state there, never in this repo.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The slicelens install root (this repo), regardless of where the CLI is invoked from.
export const SLICELENS_HOME = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const VIEWER_ROOT = resolve(SLICELENS_HOME, "viewer");

// The workspace lives in the TARGET repo's cwd, not the slicelens install.
export function workspace(cwd = process.cwd()) {
    const dir = resolve(cwd, ".slicelens");
    const paths = {
        dir,
        spec: resolve(dir, "spec.json"),
        diff: resolve(dir, "diff.json"),
        annotations: resolve(dir, "annotations.json"),
        runtime: resolve(dir, "runtime.json"),
        outbox: resolve(dir, "outbox")
    };
    return paths;
}

export function ensureWorkspace(cwd = process.cwd()) {
    const paths = workspace(cwd);
    mkdirSync(paths.outbox, { recursive: true });
    return paths;
}
