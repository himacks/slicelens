// `slicelens status` — annotation counts for the current workspace.
import { readAnnotations } from "../server/store.mjs";
import { workspace } from "../shared/paths.mjs";

export async function cmdStatus() {
    const paths = workspace(process.cwd());
    const { annotations } = readAnnotations(paths);
    const by = { open: 0, sent: 0, resolved: 0 };
    for (const a of annotations) by[a.status] = (by[a.status] ?? 0) + 1;
    console.log(`slicelens workspace: ${paths.dir}`);
    console.log(`  annotations: ${annotations.length} total`);
    console.log(`    open ${by.open} · sent ${by.sent} · resolved ${by.resolved}`);
    const active = annotations.filter(a => a.status !== "resolved");
    for (const a of active) {
        console.log(`  [${a.id}] ${a.kind} · ${a.status} · ${a.target?.sliceId ?? "global"} — ${a.body.slice(0, 60)}`);
    }
}
