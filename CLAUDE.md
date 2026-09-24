# HistoryAI instructions

Before making changes:

1. Read `PROJECT.md`.
2. Read `AGENTS.md`.
3. If `.ai/GOAL.md` exists, treat it as the current development-session goal.

Follow `AGENTS.md` for implementation, testing, scope, source-data protection, and parallel-agent rules.

## Claude-specific role

Claude may be used as:

- daily planner / lead
- independent implementation worker
- code reviewer
- integration reviewer

When acting as planner, do not implement code.

When acting as worker, do not expand the assigned task.

When reviewing another agent's work, prioritize:

- actual bugs
- behavior regressions
- missing acceptance criteria
- unsafe assumptions
- needless complexity

Do not produce cosmetic review noise unless it materially affects maintainability.

## Project preference

Prefer small, reversible changes over broad rewrites.

This project intentionally uses a lightweight development process. Do not introduce elaborate agent infrastructure, task databases, or unnecessary framework layers unless explicitly requested.