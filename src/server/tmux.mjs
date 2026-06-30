// The wire back to the Claude Code session. When you hit Send in the browser, the
// bridge writes the rich payload to .slicelens/outbox/ and fires a short one-line
// nudge straight into the tmux pane this review was launched from — i.e. the pane
// running Claude Code — so it lands as your next message to the agent.
import { execFileSync } from "node:child_process";

// Controlling tty of a pid, normalized to /dev/... ; null if none (detached).
function ttyOf(pid) {
    try {
        const t = execFileSync("ps", ["-o", "tty=", "-p", String(pid)], { encoding: "utf8" }).trim();
        if (!t || t === "??" || t === "?") return null;
        return t.startsWith("/dev/") ? t : `/dev/${t}`;
    } catch {
        return null;
    }
}

// Self-detect the pane by matching this process's (or an ancestor's) controlling tty to a
// pane_tty. Works when the CLI runs with the pane's pty as its terminal; returns null for a
// detached process (no controlling tty), which is the case for a background agent.
function paneFromTty() {
    try {
        const ttys = [];
        let pid = process.pid;
        for (let i = 0; i < 6 && pid > 1; i++) {
            const t = ttyOf(pid);
            if (t) ttys.push(t);
            const ppid = execFileSync("ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8" }).trim();
            pid = Number(ppid);
            if (!pid) break;
        }
        if (ttys.length === 0) return null;
        const rows = tmux(["list-panes", "-a", "-F", "#{pane_tty} #{pane_id}"]).split("\n").filter(Boolean);
        for (const row of rows) {
            const sp = row.indexOf(" ");
            if (ttys.includes(row.slice(0, sp))) return row.slice(sp + 1);
        }
    } catch {
        /* fall through */
    }
    return null;
}

// Resolve the pane to deliver to. Precedence: explicit (--pane) → $TMUX_PANE (interactive
// agents inherit it) → tty match → null. Null means a detached/background agent that can't
// self-detect; it must be given a pane explicitly.
export function detectPane(explicit) {
    if (explicit) return explicit;
    if (process.env.TMUX_PANE) return process.env.TMUX_PANE;
    return paneFromTty();
}

function tmux(args) {
    return execFileSync("tmux", args, { encoding: "utf8" });
}

// Accepts any tmux target: a pane id (%32) or a human ref (session:window.pane,
// e.g. andy-agentic:2.0). display-message resolves it to a concrete pane id, or errors.
export function paneExists(pane) {
    if (!pane) return false;
    try {
        const id = tmux(["display-message", "-t", pane, "-p", "#{pane_id}"]).trim();
        return /^%\d+$/.test(id);
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
