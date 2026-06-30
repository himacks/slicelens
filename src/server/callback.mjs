// How a given slicelens instance pings its OWNER agent back. slicelens never guesses:
// the agent that launches a review supplies the callback and it's persisted in that
// instance's workspace (runtime.json). On Send, the bridge dispatches it.
//
// Kinds:
//   tmux    → send-keys the one-line nudge into a pane (interactive agents in tmux)
//   command → run an arbitrary shell command with the payload in env vars
//             SLICELENS_MESSAGE (one-line nudge) and SLICELENS_OUTBOX (briefing path).
//             The escape hatch for any agent that isn't a plain tmux pane.
//   none    → no push; the outbox file is still written (durable record)
import { execFileSync } from "node:child_process";
import { detectPane, nudge, paneExists } from "./tmux.mjs";

// Build the callback descriptor the agent asked for at `serve` time.
export function resolveCallback(flags) {
    if (flags["callback-cmd"]) {
        return { kind: "command", command: String(flags["callback-cmd"]) };
    }
    const pane = detectPane(flags.pane);
    if (pane) return { kind: "tmux", pane };
    return { kind: "none" };
}

// Is the callback target currently reachable? (for the viewer's status badge)
export function callbackLive(callback) {
    if (!callback) return false;
    if (callback.kind === "tmux") return paneExists(callback.pane);
    if (callback.kind === "command") return true;
    return false;
}

export function callbackLabel(callback) {
    if (!callback || callback.kind === "none") return "no callback";
    if (callback.kind === "tmux") return `pane ${callback.pane}`;
    return "command";
}

export function dispatch(callback, { message, outbox }) {
    if (!callback || callback.kind === "none") {
        return { ok: false, reason: "no-callback" };
    }
    if (callback.kind === "tmux") {
        return nudge(callback.pane, message);
    }
    if (callback.kind === "command") {
        try {
            execFileSync("sh", ["-c", callback.command], {
                env: { ...process.env, SLICELENS_MESSAGE: message, SLICELENS_OUTBOX: outbox },
                stdio: "ignore"
            });
            return { ok: true };
        } catch (error) {
            return { ok: false, reason: error.message };
        }
    }
    return { ok: false, reason: "unknown-callback" };
}
