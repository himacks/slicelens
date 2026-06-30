// The wire back to the Claude Code session. When you hit Send in the browser, the
// bridge writes the rich payload to .slicelens/outbox/ and fires a short one-line
// nudge straight into the tmux pane this review was launched from — i.e. the pane
// running Claude Code — so it lands as your next message to the agent.
import { execFileSync } from "node:child_process";

export function detectPane(explicit) {
    if (explicit) return explicit;
    if (!process.env.TMUX) return null; // not inside tmux
    return process.env.TMUX_PANE ?? null;
}

function tmux(args) {
    return execFileSync("tmux", args, { encoding: "utf8" });
}

export function paneExists(pane) {
    if (!pane) return false;
    try {
        const panes = tmux(["list-panes", "-a", "-F", "#{pane_id}"]).split("\n");
        return panes.includes(pane);
    } catch {
        return false;
    }
}

// Type `message` into `pane` as a single line and submit it. Uses literal send-keys
// (no key interpretation) then a separate Enter, which is what Claude Code's input
// expects. `message` must be a single line — keep the detail in the outbox file.
export function nudge(pane, message) {
    if (!pane) return { ok: false, reason: "no-pane" };
    const oneLine = message.replace(/\s+/g, " ").trim();
    try {
        tmux(["send-keys", "-t", pane, "-l", "--", oneLine]);
        tmux(["send-keys", "-t", pane, "Enter"]);
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: error.message };
    }
}
