#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

GOAL="${*:-}"

if [[ -z "$GOAL" ]]; then
  echo 'Usage: ./day "오늘 할 것"'
  exit 1
fi

for cmd in git python3 codex npm; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Missing command: $cmd"
    if [[ "$cmd" == "npm" ]]; then
      echo "Install Node.js with nvm, then open a new shell or load nvm before running ./day.sh."
    fi
    exit 1
  }
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean."
  echo "Commit or stash current changes before running ./day."
  exit 1
fi

mkdir -p .ai/runs .worktrees

RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$ROOT/.ai/runs/$RUN_ID"
mkdir -p "$RUN_DIR"

cat > .ai/GOAL.md <<EOF
# Daily Goal

$(date '+%Y-%m-%d %H:%M')

$GOAL
EOF

git status --short > "$RUN_DIR/git-status.txt"
git log --oneline -12 > "$RUN_DIR/git-log.txt"

find . \
  -maxdepth 2 \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './dist/*' \
  -not -path './.worktrees/*' \
  -not -path './.ai/runs/*' \
  | sort > "$RUN_DIR/tree.txt"

PLANNER_PROMPT="$RUN_DIR/planner-prompt.md"

cat > "$PLANNER_PROMPT" <<EOF
$(cat .ai/planner.md)

## Repository snapshot

### Daily goal
$(cat .ai/GOAL.md)

### Recent commits
$(cat "$RUN_DIR/git-log.txt")

### Repository structure
$(cat "$RUN_DIR/tree.txt")
EOF

echo
echo "Planning today's work..."
echo

codex exec --sandbox read-only --output-last-message "$RUN_DIR/plan.json" "$(cat "$PLANNER_PROMPT")" > "$RUN_DIR/planner.log" 2>&1

python3 - "$RUN_DIR/plan.json" <<'PY'
import json, sys

path = sys.argv[1]

with open(path, encoding="utf-8") as f:
    data = json.load(f)

tasks = data.get("tasks", [])
if not tasks:
    raise SystemExit("Planner returned no tasks.")
if any(t.get("agent") != "codex" for t in tasks):
    raise SystemExit("Planner returned a non-Codex worker.")

print()
print("=== TODAY'S PLAN ===")
print(data.get("summary", ""))

for t in data.get("tasks", []):
    print()
    print(f"[{t['id']}] {t['title']}")
    print(f"  agent: {t['agent']}")
    print(f"  difficulty: {t.get('difficulty', 'normal')}")
    print(f"  parallel group: {t.get('parallel_group', 1)}")
    files = ", ".join(t.get("expected_files", []))
    if files:
        print(f"  expected files: {files}")
    print(f"  goal: {t.get('goal', '')}")

print()
PY

if [[ "${DAY_AUTO:-0}" != "1" ]]; then
  read -r -p "Run this plan? [Y/n] " ANSWER
  ANSWER="${ANSWER:-Y}"

  case "$ANSWER" in
    y|Y|yes|YES) ;;
    *) echo "Cancelled."; exit 0 ;;
  esac
fi

python3 - "$RUN_DIR/plan.json" "$RUN_DIR" <<'PY'
import json, pathlib, sys

plan_path = pathlib.Path(sys.argv[1])
run_dir = pathlib.Path(sys.argv[2])

plan = json.loads(plan_path.read_text())

worker = pathlib.Path(".ai/worker.md").read_text()

for task in plan["tasks"]:
    body = f"""{worker}

# Assigned task

ID: {task["id"]}
Title: {task["title"]}

## Goal

{task.get("goal", "")}

## Acceptance criteria

""" + "\n".join(f"- {x}" for x in task.get("acceptance", []))

    body += f"""

## Task-specific instructions

{task.get("instructions", "")}
"""

    (run_dir / f'task-{task["id"]}.md').write_text(body)
PY

BASE_BRANCH="$(git branch --show-current)"

run_task() {
  TASK_ID="$1"

  TASK_JSON="$(python3 - "$RUN_DIR/plan.json" "$TASK_ID" <<'PY'
import json, sys

plan = json.load(open(sys.argv[1]))
target = sys.argv[2]

for task in plan["tasks"]:
    if task["id"] == target:
        print(json.dumps(task))
        break
else:
    raise SystemExit(1)
PY
)"

  AGENT="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["agent"])' "$TASK_JSON")"
  TITLE="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["title"])' "$TASK_JSON")"

  BRANCH="ai/day-${RUN_ID}-${TASK_ID}"
  WORKTREE="$ROOT/.worktrees/${RUN_ID}-${TASK_ID}"

  git worktree add -b "$BRANCH" "$WORKTREE" "$BASE_BRANCH"

  cp .ai/GOAL.md "$WORKTREE/.ai/GOAL.md"

  (
    cd "$WORKTREE"

    PROMPT="$(cat "$RUN_DIR/task-${TASK_ID}.md")"

    echo "[$TASK_ID] Starting $AGENT: $TITLE"

    ${CODEX_CMD:-codex exec --full-auto} "$PROMPT"

    npm test
    npm run build

    git add -A

    if ! git diff --cached --quiet; then
      git commit -m "ai: $TITLE"
    fi

  ) > "$RUN_DIR/task-${TASK_ID}.log" 2>&1

  echo "[$TASK_ID] Done"
}

GROUPS="$(python3 - "$RUN_DIR/plan.json" <<'PY'
import json, sys
p=json.load(open(sys.argv[1]))
print(" ".join(str(x) for x in sorted(set(t.get("parallel_group",1) for t in p["tasks"]))))
PY
)"

for GROUP in $GROUPS; do
  IDS="$(python3 - "$RUN_DIR/plan.json" "$GROUP" <<'PY'
import json, sys
p=json.load(open(sys.argv[1]))
g=int(sys.argv[2])
print(" ".join(t["id"] for t in p["tasks"] if t.get("parallel_group",1)==g))
PY
)"

  PIDS=""

  for ID in $IDS; do
    run_task "$ID" &
    PIDS="$PIDS $!"
  done

  FAILED=0

  for PID in $PIDS; do
    if ! wait "$PID"; then
      FAILED=1
    fi
  done

  if [[ "$FAILED" == "1" ]]; then
    echo
    echo "One or more workers failed."
    echo "Logs: $RUN_DIR"
    exit 1
  fi
done

INTEGRATION_BRANCH="ai/integration-${RUN_ID}"
INTEGRATION_DIR="$ROOT/.worktrees/integration-${RUN_ID}"

git worktree add -b "$INTEGRATION_BRANCH" "$INTEGRATION_DIR" "$BASE_BRANCH"

cd "$INTEGRATION_DIR"

ORDER="$(python3 - "$RUN_DIR/plan.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
print(" ".join(p.get("integration_order") or [t["id"] for t in p["tasks"]]))
PY
)"

for ID in $ORDER; do
  BRANCH="ai/day-${RUN_ID}-${ID}"

  echo "Merging $BRANCH..."

  if ! git merge --no-edit "$BRANCH"; then
    echo
    echo "Merge conflict."
    echo "Integration worktree:"
    echo "$INTEGRATION_DIR"
    echo
    echo "No automatic conflict resolution was attempted."
    exit 1
  fi
done

echo
echo "Running integrated verification..."
npm test
npm run build

git log --oneline "$BASE_BRANCH"..HEAD > "$RUN_DIR/integration-commits.txt"
git diff --stat "$BASE_BRANCH"...HEAD > "$RUN_DIR/integration-stat.txt"

echo
echo "========================================"
echo "DAY COMPLETE"
echo "========================================"
echo
echo "Integration branch:"
echo "  $INTEGRATION_BRANCH"
echo
echo "Integration worktree:"
echo "  $INTEGRATION_DIR"
echo
echo "Verification:"
echo "  npm test       ✓"
echo "  npm run build  ✓"
echo
echo "Review the result, then merge manually:"
echo
echo "  git switch $BASE_BRANCH"
echo "  git merge $INTEGRATION_BRANCH"
echo
echo "Logs:"
echo "  $RUN_DIR"
