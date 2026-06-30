#!/usr/bin/env bash
# slicelens self-install. Idempotent.
#   1. installs deps
#   2. symlinks the skill into ~/.claude/skills/slicelens
#   3. puts the `slicelens` CLI on PATH (~/.local/bin)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "slicelens: installing deps…"
if command -v pnpm >/dev/null 2>&1; then
    pnpm install --silent
else
    npm install --silent
fi

# --- skill ---
SKILL_DST="$HOME/.claude/skills/slicelens"
mkdir -p "$HOME/.claude/skills"
rm -rf "$SKILL_DST"
ln -s "$HERE/skill" "$SKILL_DST"
echo "slicelens: skill → $SKILL_DST"

# --- CLI on PATH ---
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
chmod +x "$HERE/bin/slicelens.mjs"
ln -sf "$HERE/bin/slicelens.mjs" "$BIN_DIR/slicelens"
echo "slicelens: CLI → $BIN_DIR/slicelens"

if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
    echo
    echo "  NOTE: $BIN_DIR is not on your PATH. Add to your shell rc:"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

echo
echo "slicelens installed. From a repo under review:  slicelens diff && slicelens serve"
echo "Or invoke the skill in Claude Code:  /slicelens"
