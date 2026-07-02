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

A "fix Y" slice for a bug the branch itself introduced is a sign you sliced the journey.
Stop and re-derive from the net diff.

## Removals are slices too

The net diff has two sides. Code that exists at base and is **gone at the end** is just as
much a slice as new code — deletions and replacements of base machinery are first-class,
reviewable changes ("main's content-fingerprint system goes away, replaced by X").

Do NOT confuse the two kinds of "removed":
- **Removed from base** (existed at base, absent at the end) → belongs in a slice, either
  its own or explicitly named in the slice that replaces it. Never bury it in `excluded`.
- **Added-then-removed inside the branch** (absent at base AND at the end) → not in the
  net diff at all → `excluded`.

`excluded` is ONLY for: (a) branch-internal churn (added and removed within the branch),
(b) working-tree debug marked for stripping before commit, (c) files the user explicitly
excluded. Everything else in the diff — additions AND deletions — must be mapped to a
slice. The slice map must account for every hunk.

## Granularity — a slice is one encapsulable piece of logic

Each slice must be a self-contained review: a reader holds the whole thing in their head
and says "okay, this makes sense" in one sitting. Not 100 confetti slices — but split
whenever one slice bundles more than one mechanism.

Signals a slice is too big (split it):
- The design section needs multiple bold sub-headers or 5+ bullets covering different
  mechanisms.
- The file list spans 3+ unrelated areas of the tree (e.g. a DOM module + server
  rendering + tool contracts).
- You can't state its purpose in one sentence without "and".
- Reviewing it requires understanding two new subsystems at once.

Prefer: new module alone (no consumers yet) → its first consumer as the next slice →
the surface/UI that exposes it as another. A pure-addition slice followed by a wiring
slice is easier to review than one module-plus-wiring blob.

## The end goal — slices are an implementation plan

Once the spec is settled with the user, the slices get REBUILT on a fresh worktree/branch,
in order: implement slice 1 perfectly and cleanly, verify it (build + tests + review),
commit it, dump it from working memory, move to slice 2. The finished stack replaces the
messy original branch with a hygienic, review-shaped history.

Write every slice so it can be implemented without re-reading the others: name what it
depends on, what it contains, and what "done" looks like (the verify section). If a slice
can't be implemented standalone by someone holding only its card, it's underspecified or
too entangled — fix the spec, not the implementer.

## Flow

1. **Pick the base.** Default to the fork point: `git merge-base main HEAD`. If the user
   named a base, use it.

2. **Extract the diff:** `slicelens diff --base <ref>` → writes `.slicelens/diff.json`
   (commit range, per-file name-status + line counts). Read it, and read the actual diff
   (`git diff <base>..HEAD`, per-file as needed) to understand the change.

3. **Author `.slicelens/spec.json`** (schema below). For each candidate slice, verify it's
   a real net-diff component (present in the end state), assign its hunks, and place it in
   dependency order. Keep slices code-free: describe logic and system design, list file
   paths as scope markers, never paste code. Write every section in plain English — see
   **Voice** below; it's the default, not a polish pass.

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

## Voice — write slices to be digestible

The reader is a human reviewing a plan, not someone reading the code. Every section must
answer **what changed and why it matters** in plain English. This is the default and it is
not optional.

- **Lead with the human purpose, not the symbol name.** Write "Read what the user actually
  sees — strip the HTML tags down to the plain on-screen text" — not "`visibleText` —
  DOMParser `textContent` of a serialized fragment." Put the function/file name in parens
  or `mono` as a secondary pointer for the implementer, never as the explanation itself.
- **Keep a technical term only when it earns its place** — when the precise word is clearer
  than a paraphrase and a reviewer needs it: DOM, alignment, selection (collapsed /
  zero-width), clipboard, fingerprint, block, HTML. Use them plainly, in context.
- **Cut jargon that doesn't add understanding.** No raw codepoints (`U+200B` → "invisible
  zero-width characters"), no greek-letter deltas (`Δold→Δnew` → "just the part that
  changed"), no internal coordinate-space talk, no leading with private helper names.
- **Say why it's relevant.** A slice that lists what changed but not why the feature needs
  it has failed. Tie each piece to the user-visible behavior it serves.
- **Titles are plain and action-first** — "Find, preview, and paste the edit", "Turn the
  feature on" — not "Resolve/apply pipeline orchestration".
- Same voice for the `excluded` notes: plain reason it isn't a slice.

Litmus test: a reviewer who has never seen this code should understand what each slice does
and why, without looking anything up.

## CLI reference

- `slicelens diff [--base <ref>]` — extract net diff → `.slicelens/diff.json`
- `slicelens serve [--port N] [--pane <id>] [--callback-cmd '<sh>'] [--spec <path>] [--open]`
  — render + wire the callback. `--callback-cmd` runs on Send with the payload in
  `$SLICELENS_MESSAGE` (one-line nudge) and `$SLICELENS_OUTBOX` (briefing path).
- `slicelens resolve <id...> | --all-sent` — mark annotations addressed
- `slicelens status` — annotation counts

## Learn from every round

This skill is a living document. After each feedback round with the user, ask: does this
feedback generalize beyond this one spec? If yes, fold it into this file (the skill lives
in the slicelens repo, `skill/SKILL.md` — edit it there and commit) so the next invocation
starts smarter. Lessons that have already been folded in this way: the plain-English
voice, removals-are-slices, the granularity signals, resolve-means-remove, and the
background-agent callback flow. Spec-specific feedback (this slice's wording, this
diff's grouping) stays in the spec; only generalizable process lessons go here.

## Notes

- Run everything from the target repo directory; `.slicelens/` is created there.
- The callback is per-instance: each agent reviewing each branch writes its own into its
  own `.slicelens/runtime.json`, so two concurrent reviews ping two different agents.
- The outbox file (`.slicelens/outbox/latest.md`) is always written on Send, regardless of
  callback — it's the durable record you read.
- Don't commit the target repo's `.slicelens/` (transient review state).
