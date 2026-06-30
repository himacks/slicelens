// `slicelens serve` — boot the Vite viewer with the bridge plugin and the agent-supplied
// callback. Single process, single port: Vite serves the React app and the /api surface.
//
// The invoking AGENT owns how it gets pinged back. It passes one of:
//   --pane <id>            send-keys nudges into that tmux pane (interactive agents)
//   --callback-cmd '<sh>'  run this on Send; payload in $SLICELENS_MESSAGE/$SLICELENS_OUTBOX
//   (nothing)             auto-use $TMUX_PANE if present, else no push (outbox only)
// The resolved callback is persisted in this instance's .slicelens/runtime.json.
import { writeFileSync } from "node:fs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { ensureWorkspace, VIEWER_ROOT, workspace } from "../shared/paths.mjs";
import { slicelensBridge } from "../server/bridge.mjs";
import { callbackLabel, callbackLive, resolveCallback } from "../server/callback.mjs";

export async function cmdServe({ flags }) {
    const cwd = process.cwd();
    const paths = flags.spec ? { ...ensureWorkspace(cwd), spec: flags.spec } : ensureWorkspace(cwd);

    const callback = resolveCallback(flags);
    if (callback.kind === "none") {
        console.warn(
            "slicelens: no callback set — annotations will write the outbox file but won't ping any agent.\n" +
                "  Pass --pane <tmux-pane-id> or --callback-cmd '<shell>' so Send reaches the invoking agent."
        );
    } else {
        const live = callbackLive(callback);
        console.log(`slicelens: callback = ${callbackLabel(callback)}${live ? "" : " (not reachable right now)"}`);
    }

    // Persist the instance's callback + runtime — this is the "how to ping this instance"
    // context the agent set up.
    writeFileSync(
        workspace(cwd).runtime,
        JSON.stringify({ cwd, callback, spec: paths.spec, startedAt: new Date().toISOString() }, null, 2)
    );

    const port = Number(flags.port ?? 5180);
    const server = await createServer({
        configFile: false,
        root: VIEWER_ROOT,
        plugins: [react(), slicelensBridge({ paths, callback })],
        server: { port, strictPort: false, open: Boolean(flags.open) }
    });
    await server.listen();
    server.printUrls();
    console.log("\nslicelens viewer running. Annotate in the browser; Send pings the invoking agent. Ctrl-C to stop.");
}
