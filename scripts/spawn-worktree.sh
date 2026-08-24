#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Matt Pocock Sub-Agent Git Worktree Spawner
# Creates an isolated git worktree branch for a specific task slice.
# Usage: ./scripts/spawn-worktree.sh TASK-03-MCP-SERVER
# ==============================================================================

TASK_NAME="${1:-}"

if [[ -z "$TASK_NAME" ]]; then
  echo "Usage: ./scripts/spawn-worktree.sh <TASK_NAME>"
  echo "Example: ./scripts/spawn-worktree.sh TASK-03-MCP-SERVER"
  exit 1
fi

BRANCH_NAME="feature/${TASK_NAME,,}"
WORKTREE_DIR="../wastat-${TASK_NAME,,}"

echo "🚀 Spawning isolated worktree for ${TASK_NAME} at ${WORKTREE_DIR}..."

# Check if branch exists
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  git worktree add "${WORKTREE_DIR}" "${BRANCH_NAME}"
else
  git worktree add -b "${BRANCH_NAME}" "${WORKTREE_DIR}" main
fi

# Copy .env safely to worktree without git tracking
if [[ -f ".env" ]]; then
  cp .env "${WORKTREE_DIR}/.env"
fi

echo "✅ Worktree ready: ${WORKTREE_DIR}"
echo "Run: cd ${WORKTREE_DIR} && npm test"
