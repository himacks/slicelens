// `slicelens resolve <id...>` / `--all-sent` — mark annotations addressed. They drop
// out of the viewer's active list (the file watch pushes a live update). This is how
// feedback stops persisting: the agent explicitly closes the loop once it's handled.
import { existsSync } from "node:fs";
import { resolveAnnotations } from "../server/store.mjs";
import { workspace } from "../shared/paths.mjs";

export async function cmdResolve({ flags, positionals }) {
    const paths = workspace(process.cwd());
    if (!existsSync(paths.annotations)) {
        throw new Error("no annotations.json in this workspace");
    }
    const allSent = Boolean(flags["all-sent"]);
    if (!allSent && positionals.length === 0) {
        throw new Error("pass annotation id(s) or --all-sent");
    }
    const count = resolveAnnotations(paths, { ids: positionals, allSent });
    console.log(`slicelens: resolved ${count} annotation(s)`);
}
