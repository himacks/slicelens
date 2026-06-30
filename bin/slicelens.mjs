#!/usr/bin/env node
// slicelens CLI. Thin dispatcher → src/cli/<command>.mjs.
import { cmdDiff } from "../src/cli/diff.mjs";
import { cmdResolve } from "../src/cli/resolve.mjs";
import { cmdServe } from "../src/cli/serve.mjs";
import { cmdStatus } from "../src/cli/status.mjs";

const [, , command, ...rest] = process.argv;

// Minimal flag parser: --key value, --flag (boolean), positionals collected separately.
function parseArgs(argv) {
    const flags = {};
    const positionals = [];
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token.startsWith("--")) {
            const key = token.slice(2);
            const next = argv[i + 1];
            if (next === undefined || next.startsWith("--")) {
                flags[key] = true;
            } else {
                flags[key] = next;
                i++;
            }
        } else {
            positionals.push(token);
        }
    }
    return { flags, positionals };
}

const { flags, positionals } = parseArgs(rest);

const commands = {
    diff: cmdDiff,
    serve: cmdServe,
    resolve: cmdResolve,
    status: cmdStatus
};

function usage() {
    console.log(`slicelens — slice a branch's net diff into a layered, annotatable PR stack.
Meant to be driven by an agent (the /slicelens skill), not run by hand.

Usage:
  slicelens diff   [--base <ref>]            Extract the net diff vs base into .slicelens/diff.json
  slicelens serve  [--port N]                Render .slicelens/spec.json + wire annotations back to YOU
                   [--pane <tmux-pane-id>]     · push Send via tmux send-keys to this pane
                   [--callback-cmd '<sh>']     · or run this command (payload in $SLICELENS_MESSAGE / $SLICELENS_OUTBOX)
                   [--spec <path>] [--open]
  slicelens resolve <id...> | --all-sent     Mark annotation(s) addressed (clears them in the viewer)
  slicelens status                           Show annotation counts for the current workspace

The review workspace lives in the TARGET repo's .slicelens/ (cd into the repo first).
The invoking agent supplies its own callback (--pane / --callback-cmd) so Send reaches it.`);
}

const handler = commands[command];
if (!handler) {
    usage();
    process.exit(command ? 1 : 0);
}

try {
    await handler({ flags, positionals });
} catch (error) {
    console.error(`slicelens ${command}: ${error.message}`);
    process.exit(1);
}
