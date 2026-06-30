# slicelens

Slice a branch's **net diff** into a layered, reviewable PR stack — render it in a browser
viewer — annotate any region with a drag-box screenshot + note — and have those
annotations land back in your Claude Code session as actionable feedback.

```
 big branch ──▶ /slicelens ──▶ spec.json ──▶ viewer (browser)
                                                  │
                          drag box + note ◀───────┘
                                  │
                       Send ──▶ tmux send-keys ──▶ Claude Code pane
                                  │
              agent edits spec / discusses code ──▶ viewer hot-reloads
```

## Why

Git history of a long branch is rarely reviewable — commits get rebased, reordered, and
relabelled, and work gets added then removed. slicelens ignores history and slices the
**final net diff** (`git diff <base>..HEAD`) into ordered, layerable pieces whose union is
the whole diff and each of which compiles on top of the last. The viewer makes that stack
legible; the annotation loop makes revising it fast.

## Install

```bash
git clone <this repo> ~/Documents/Code/slicelens
cd ~/Documents/Code/slicelens
./install.sh
```

This installs deps, symlinks the skill into `~/.claude/skills/slicelens`, and puts the
`slicelens` CLI on `~/.local/bin`.

## Use

From inside the repo you're reviewing (ideally in the tmux pane running Claude Code):

```bash
slicelens diff            # extract net diff → .slicelens/diff.json
# author .slicelens/spec.json   (the /slicelens skill does this for you)
slicelens serve           # render + wire annotations back to this pane
```

Or just run **`/slicelens`** in Claude Code — the skill extracts the diff, authors the
slice spec from the net diff (not the history), and boots the viewer.

In the viewer: toggle **Annotate**, drag a box over any part of the spec to screenshot it,
type a note, and **Send** (one or a batch). Each annotation arrives in your Claude Code
pane as `screenshot path + note`; the agent reads the shot, acts, and runs
`slicelens resolve <id>` — which **removes** the annotation and its screenshot outright.
Annotations are a live worklist (`open → sent → removed`): a responded-to one disappears,
so the board always shows exactly what's still outstanding.

## Layout

| Path | What |
|------|------|
| `bin/slicelens.mjs` | CLI entry (dispatch) |
| `src/cli/` | `diff`, `serve`, `resolve`, `status` |
| `src/server/` | bridge (Vite plugin: `/api`, live-reload), tmux send-keys, store, outbox |
| `viewer/` | Vite + React viewer (renders `spec.json`, annotation layer) |
| `skill/SKILL.md` | the `/slicelens` skill (net-diff slicing methodology) |

## How the wire-back works

slicelens is **agent-driven**, and the invoking agent owns how it gets pinged. At `serve`
time the agent supplies a **callback**, persisted per-instance in `.slicelens/runtime.json`:

- `--pane <id>` (or auto from `$TMUX_PANE`) — tmux `send-keys` a one-line nudge into that
  pane, so it lands as the agent's next message. For interactive agents in tmux.
- `--callback-cmd '<shell>'` — run any command on Send, with the payload in
  `$SLICELENS_MESSAGE` (one-line nudge) and `$SLICELENS_OUTBOX` (briefing path). The escape
  hatch for headless/background agents that aren't a plain tmux pane.

On **Send**, the bridge always writes a markdown briefing to `.slicelens/outbox/latest.md`
(each annotation = a `/tmp/slicelens/<id>.png` path + the note), then dispatches the
callback. Because each instance carries its own callback, two concurrent reviews ping two
different agents. Screenshots go to `/tmp/slicelens/`.
