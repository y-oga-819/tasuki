#!/bin/bash
# tasuki-commit-gate.sh
# Claude Code PreToolUse Hook: blocks git commit without Tasuki review approval.
#
# Installation:
#   1. Copy this file to ~/.claude/hooks/tasuki-commit-gate.sh
#   2. chmod +x ~/.claude/hooks/tasuki-commit-gate.sh
#   3. Add to ~/.claude/settings.json:
#      {
#        "hooks": {
#          "PreToolUse": [
#            {
#              "matcher": "Bash",
#              "command": "~/.claude/hooks/tasuki-commit-gate.sh"
#            }
#          ]
#        }
#      }

set -euo pipefail

# Read tool input from stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only intercept git commit commands
if ! echo "$COMMAND" | grep -qE '(^|[;&|]\s*)git\s+commit'; then
  exit 0
fi

# Get repository info (resolve to absolute path so it works in both normal repos and worktrees)
GIT_COMMON_DIR=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" && pwd) || exit 0
REPO_NAME=$(basename "$(dirname "$GIT_COMMON_DIR")")
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

REVIEW_FILE="/tmp/tasuki/${REPO_NAME}/${BRANCH_NAME}/review.json"

# No review file -> block
if [ ! -f "$REVIEW_FILE" ]; then
  echo "Tasuki: commit blocked - no review approval found."
  echo "  Open Tasuki to review and approve the changes."
  exit 2
fi

# Check version
VERSION=$(jq -r '.version // 1' "$REVIEW_FILE")

# Check status
STATUS=$(jq -r '.status // ""' "$REVIEW_FILE")

# Rejected -> block
if [ "$STATUS" = "rejected" ]; then
  echo "Tasuki: commit blocked - review was rejected."
  echo "  Address the review comments and get approval in Tasuki."
  exit 2
fi

# Approved -> pass
if [ "$STATUS" = "approved" ]; then
  # Show resolved comments as context
  RESOLVED_CODE=$(jq '(.resolved_comments | length)' "$REVIEW_FILE" 2>/dev/null || echo "0")
  RESOLVED_DOC=$(jq '(.resolved_doc_comments | length)' "$REVIEW_FILE" 2>/dev/null || echo "0")
  RESOLVED_TOTAL=$((RESOLVED_CODE + RESOLVED_DOC))

  if [ "$RESOLVED_TOTAL" -gt 0 ]; then
    echo "Tasuki: review approved (${RESOLVED_TOTAL} resolved comments)"
    echo ""
    jq -r '.resolved_comments[]? | "  \(.file):\(.line) - \(.body)"' "$REVIEW_FILE"
    jq -r '.resolved_doc_comments[]? | "  \(.file) [\(.section)] - \(.body)"' "$REVIEW_FILE"
    echo ""
  else
    echo "Tasuki: review approved (no comments)"
  fi

  # Consume the gate file (one-time use)
  rm -f "$REVIEW_FILE"
  exit 0
fi

# Unknown status -> block
echo "Tasuki: commit blocked - unknown review status: ${STATUS}"
exit 2
