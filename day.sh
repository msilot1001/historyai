#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

GOAL="${*:-}"

if [[ -z "$GOAL" ]]; then
  echo 'Usage: ./day.sh "오늘 할 것"'
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
  echo "Commit or stash current changes before running ./day.sh."
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

python3 - "$RUN_DIR/plan.json" "$GOAL" <<'PY'
import json, sys

path = sys.argv[1]
goal = sys.argv[2]

with open(path, encoding="utf-8") as f:
    data = json.load(f)

tasks = data.get("tasks", [])
if not tasks:
    raise SystemExit("Planner returned no tasks.")
if any(t.get("agent") != "codex" for t in tasks):
    raise SystemExit("Planner returned a non-Codex worker.")
ids = [t.get("id") for t in tasks]
if any(not isinstance(i, str) or not i.isascii() or not i.replace("_", "").isalnum() for i in ids) or len(set(ids)) != len(ids):
    raise SystemExit("Planner returned invalid or duplicate task IDs.")
if any(not isinstance(t.get("parallel_group"), int) or t["parallel_group"] < 1 for t in tasks):
    raise SystemExit("Planner returned invalid parallel groups.")
groups = {t["parallel_group"] for t in tasks}
if any(sum(t["parallel_group"] == group for t in tasks) > 2 for group in groups):
    raise SystemExit("Planner assigned more than two concurrent workers.")
order = data.get("integration_order")
if not isinstance(order, list) or sorted(order) != sorted(ids):
    raise SystemExit("Integration order must list every task exactly once.")
if "캠페인" in goal and not data.get("full_campaign"):
    raise SystemExit("Planner omitted the requested full campaign.")
if data.get("full_campaign"):
    covered = {n for t in tasks for n in t.get("requirements", [])}
    if covered != set(range(1, 6)):
        raise SystemExit("Full campaign plan must cover requirements 1–5.")
    if not data.get("release", {}).get("enabled"):
        raise SystemExit("Full campaign plan must include a release phase.")

print()
print("=== TODAY'S PLAN ===")
print(data.get("summary", ""))

for t in data.get("tasks", []):
    print()
    print(f"[{t['id']}] {t['title']}")
    print(f"  agent: {t['agent']}")
    print(f"  difficulty: {t.get('difficulty', 'normal')}")
    print(f"  parallel group: {t.get('parallel_group', 1)}")
    if t.get("requirements"):
        print(f"  requirements: {', '.join(map(str, t['requirements']))}")
    files = ", ".join(t.get("expected_files", []))
    if files:
        print(f"  expected files: {files}")
    print(f"  goal: {t.get('goal', '')}")
    for criterion in t.get("acceptance", []):
        print(f"    - {criterion}")

print()
print("Release phase:", "included" if data.get("release", {}).get("enabled") else "none")
if data.get("release", {}).get("enabled"):
    print(data["release"].get("instructions", ""))
for note in data.get("notes", []):
    print(f"- {note}")
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

  git worktree add -b "$BRANCH" "$WORKTREE" "$INTEGRATION_BRANCH"

  cp .ai/GOAL.md "$WORKTREE/.ai/GOAL.md"

  (
    cd "$WORKTREE"

    PROMPT="$(cat "$RUN_DIR/task-${TASK_ID}.md")"

    echo "[$TASK_ID] Starting $AGENT: $TITLE"

    npm ci --no-audit --no-fund
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

INTEGRATION_BRANCH="ai/integration-${RUN_ID}"
INTEGRATION_DIR="$ROOT/.worktrees/integration-${RUN_ID}"

git worktree add -b "$INTEGRATION_BRANCH" "$INTEGRATION_DIR" "$BASE_BRANCH"

DAY_GROUPS="$(python3 - "$RUN_DIR/plan.json" <<'PY'
import json, sys
p=json.load(open(sys.argv[1]))
print(" ".join(str(x) for x in sorted(set(t.get("parallel_group",1) for t in p["tasks"]))))
PY
)"

for DAY_GROUP in $DAY_GROUPS; do
  IDS="$(python3 - "$RUN_DIR/plan.json" "$DAY_GROUP" <<'PY'
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

  ORDER="$(python3 - "$RUN_DIR/plan.json" "$DAY_GROUP" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
g=int(sys.argv[2])
task_by_id={t["id"]:t for t in p["tasks"]}
print(" ".join(i for i in p["integration_order"] if task_by_id[i]["parallel_group"] == g))
PY
)"

  for ID in $ORDER; do
    BRANCH="ai/day-${RUN_ID}-${ID}"

    echo "Merging $BRANCH..."

    if ! git -C "$INTEGRATION_DIR" merge --no-edit "$BRANCH"; then
      echo
      echo "Integration failed. Inspect the worktree and task logs:"
      echo "  $INTEGRATION_DIR"
      echo "  $RUN_DIR"
      exit 1
    fi
  done
done

echo
echo "Running integrated verification..."
npm --prefix "$INTEGRATION_DIR" ci --no-audit --no-fund
npm --prefix "$INTEGRATION_DIR" test
npm --prefix "$INTEGRATION_DIR" run build

git -C "$INTEGRATION_DIR" log --oneline "$BASE_BRANCH"..HEAD > "$RUN_DIR/integration-commits.txt"
git -C "$INTEGRATION_DIR" diff --stat "$BASE_BRANCH"...HEAD > "$RUN_DIR/integration-stat.txt"

if [[ "$(git -C "$ROOT" branch --show-current)" != "$BASE_BRANCH" || -n "$(git -C "$ROOT" status --porcelain)" ]]; then
  echo "Base worktree changed during the run. Integration is ready at $INTEGRATION_DIR."
  exit 1
fi

git -C "$ROOT" merge --ff-only "$INTEGRATION_BRANCH"

RELEASE_ENABLED="$(python3 - "$RUN_DIR/plan.json" <<'PY'
import json, sys
print("1" if json.load(open(sys.argv[1])).get("release", {}).get("enabled") else "0")
PY
)"

if [[ "$RELEASE_ENABLED" == "1" ]]; then
  python3 - "$RUN_DIR/plan.json" "$RUN_DIR/release-prompt.md" <<'PY'
import json, pathlib, sys
plan = json.load(open(sys.argv[1]))
instructions = plan["release"]["instructions"]
pathlib.Path(sys.argv[2]).write_text(f"""You are the HistoryAI release agent. The user approved this complete plan once and asked for the run to continue without another plan approval.

Read PROJECT.md, AGENTS.md, the integrated commits, and the approved plan. Do not implement unrelated changes.

Release instructions:
{instructions}

Before changing production, validate the target, existing data, counts, reference integrity, and rollback path. Preserve existing card IDs, attempts, grades, coaching records, and secrets. Never insert fake learning attempts. Push committed changes to the private GitHub repository, deploy the verified build to Vercel production, and check https://history-memory-web-v2.vercel.app. If a required credential, permission, or verification is missing, stop that action and report the exact blocker. Do not claim a release that did not succeed.

Output ONLY a JSON object with keys status (complete or blocked), github, redis, vercel, live_url, and blocker. Use empty strings for unavailable evidence.
""")
PY

  echo "Running approved release phase..."
  (
    cd "$ROOT"
    codex exec --full-auto --output-last-message "$RUN_DIR/release-report.json" "$(cat "$RUN_DIR/release-prompt.md")"
  ) > "$RUN_DIR/release.log" 2>&1

  python3 - "$RUN_DIR/release-report.json" <<'PY'
import json, sys
report = json.load(open(sys.argv[1]))
print("Release status:", report.get("status", "unknown"))
for key in ("github", "redis", "vercel", "live_url", "blocker"):
    if report.get(key):
        print(f"{key}: {report[key]}")
if report.get("status") != "complete":
    raise SystemExit("Release incomplete. See the release report and log.")
if any(not report.get(key) for key in ("github", "redis", "vercel", "live_url")):
    raise SystemExit("Release report is missing GitHub, Redis, Vercel, or live URL evidence.")
PY
fi

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
echo "Integrated branch:"
echo "  $BASE_BRANCH"
if [[ "$RELEASE_ENABLED" == "1" ]]; then
  echo "Release report:"
  echo "  $RUN_DIR/release-report.json"
fi
echo
echo "Logs:"
echo "  $RUN_DIR"
