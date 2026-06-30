---
name: slicelens
description: Slice the current branch's net diff (vs a base) into a layered, reviewable PR stack, render it in a browser viewer, and wire in-browser screenshot annotations back to this session. Use when the user wants to review/digest a big branch as ordered slices, or says "slice this branch", "spec out these PRs", "slicelens".
---

# slicelens — slice a branch into a reviewable PR stack

You produce a **layered slice spec** of the current branch's net diff, render it in the
slicelens viewer, and then iterate on it from in-browser annotations the user sends back
to this pane.

The `slicelens` CLI is on PATH after install. All state lives in the **target repo's**
`.slicelens/` — always run from inside the repo under review.

## The one rule that matters: slice the NET DIFF, not the history

The only input is `git diff <base>..HEAD` — the net difference between the branch tip and
its base. Everything you produce is a partition of THAT diff:

- **Each slice is a subset of the net diff's hunks. The union of all slices IS the diff.**
- **Order slices so each compiles and tests green stacked on the previous** (dependency
  layering: a module lands before its consumer; an address scheme before its callers).
- **Do NOT reconstruct the development history.** Work that was added *and then removed*
  inside the branch does not appear in the net diff, so it is **not a slice**. Verify
  before you write: if a symbol/state/file isn't in `git diff <base>..HEAD`, it does not
  exist in the end state — do not give it a slice, a "removal", or a "fix".
- **Frame every slice as what the end-state architecture IS**, never as a fix for a bug
  this branch first introduced. "The keep/drop decision rides the live DOM" — not "fixes
  the cycling race we caused". If a slice's only justification is undoing earlier
  branch-internal work, it's a phantom: delete it.
- Surface the churn you excluded in an `excluded` list so the reviewer sees you checked.

A "remove X" or "fix Y" slice is almost always a sign you sliced the journey. Stop and
re-derive from the net diff.

## Flow

1. **Pick the base.** Default to the fork point: `git merge-base main HEAD`. If the user
   named a base, use it.

2. **Extract the diff:** `slicelens diff --base <ref>` → writes `.slicelens/diff.json`
   (commit range, per-file name-status + line counts). Read it, and read the actual diff
   (`git diff <base>..HEAD`, per-file as needed) to understand the change.

3. **Author `.slicelens/spec.json`** (schema below). For each candidate slice, verify it's
   a real net-diff component (present in the end state), assign its hunks, and place it in
   dependency order. Keep slices code-free: describe logic and system design, list file
   paths as scope markers, never paste code.

4. **Serve it — and attach YOUR callback (find your own tmux pane).** slicelens delivers
   annotations to a pane via `send-keys`; the callback is persisted per-instance in
   `.slicelens/runtime.json`. `slicelens serve` self-detects the pane in this order:
   `--pane` → `$TMUX_PANE` (interactive agents inherit it) → controlling-tty match against
   `#{pane_tty}`. For an ordinary interactive Claude Code session in tmux, just run
   `slicelens serve` and it finds your pane.

   If serve prints "no callback set", you're a **detached/background** session: there is no
   inherited `$TMUX_PANE` and your procs have no controlling tty, so a pane can't be
   self-detected (and macOS blocks reading other procs' env to match a session id). In that
   case **ask the user which tmux pane they're in** and pass it — `--pane` accepts a pane id
   (`%32`) or a human ref (`session:window.pane`, e.g. `andy-agentic:2.0`). Verify with a
   non-submitting marker before relying on it: `tmux send-keys -t <pane> -l '[ping]'` (no
   Enter) and have them confirm it appears in their input.

   Run serve in the background; print the URL the CLI shows.

5. **Iterate.** When the user annotates and hits Send, you get a one-line nudge in this
   pane. Then, for the batch:
   - Read `.slicelens/outbox/latest.md` — each annotation is a screenshot path + a note.
   - **Read each screenshot path** (the Read tool renders the PNG) to see the region.
   - For notes about the spec/slicing → edit `.slicelens/spec.json` (the viewer hot-reloads).
   - For notes about the underlying code/architecture → discuss with the user here, change
     code as agreed.
   - **REQUIRED: the moment you have responded to an annotation, remove it** —
     `slicelens resolve <id>`. This deletes the record and its screenshot; the viewer drops
     it instantly. Annotations are a live worklist, not a log: a responded-to annotation
     must not linger. Resolve each as you finish it (don't batch the removals to the end),
     so the board always shows exactly what's still outstanding.

## spec.json schema

```jsonc
{
  "meta": {
    "repo": "name", "base": "<ref>", "branch": "<branch>",
    "head": "<sha>", "generatedAt": "<iso>",
    "stats": { "files": N, "additions": N, "deletions": N },
    "title": "…", "subtitle": "…",
    "intro": ["<inline-html paragraph>", "…"],        // optional overview
    "principle": "<inline-html>"                        // optional; the slicing principle
  },
  "excluded": [                                         // branch-internal churn you cut
    { "title": "transient state", "reason": "<inline-html: added then removed; absent from net diff>" }
  ],
  "slices": [
    {
      "id": "s1", "number": "01",
      "title": "…",
      "kind": "foundation | modules | orchestration | subtraction | gate | …",
      "dependsOn": [],                                  // slice ids
      "unblocks": "…",                                  // optional
      "sections": {                                     // all optional, inline-html
        "net": "Net change in the end state — what's different vs base.",
        "design": "How it works (architecture).",
        "layering": "Why it compiles in this position.",
        "verify": "How to check it."
      },
      "files": [
        { "path": "lib/…", "status": "modified|added|deleted", "note": "optional" }
      ]
    }
  ]
}
```

Section strings render as inline HTML (local, trusted): use `<b>`, `<i>`,
`<span class="mono">…</span>`, `<ul><li>…`. `b.g` = green, `b.w` = amber.

## CLI reference

- `slicelens diff [--base <ref>]` — extract net diff → `.slicelens/diff.json`
- `slicelens serve [--port N] [--pane <id>] [--callback-cmd '<sh>'] [--spec <path>] [--open]`
  — render + wire the callback. `--callback-cmd` runs on Send with the payload in
  `$SLICELENS_MESSAGE` (one-line nudge) and `$SLICELENS_OUTBOX` (briefing path).
- `slicelens resolve <id...> | --all-sent` — mark annotations addressed
- `slicelens status` — annotation counts

## Notes

- Run everything from the target repo directory; `.slicelens/` is created there.
- The callback is per-instance: each agent reviewing each branch writes its own into its
  own `.slicelens/runtime.json`, so two concurrent reviews ping two different agents.
- The outbox file (`.slicelens/outbox/latest.md`) is always written on Send, regardless of
  callback — it's the durable record you read.
- Don't commit the target repo's `.slicelens/` (transient review state).
