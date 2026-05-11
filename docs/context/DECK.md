# Context Deck

## Purpose

This file routes agents to relevant context cards. It is an index, not project memory.

## Selection rule

Before non-trivial work, select relevant cards from this deck and summarize:

- loaded context
- potentially relevant context not loaded
- missing or uncertain context
- stop conditions

Do not load every card by default.

## Priority levels

- `critical`: must be considered when applicable
- `high`: should be loaded when related
- `normal`: useful supporting context
- `low`: optional or mechanically enforced elsewhere

## Routing table

| Task touches | Consider |
|---|---|
| implementation, refactoring, bug fixes | `WF-001`, `DP-001`, active task/milestone |
| user-facing behavior, defaults, automation, config | `DP-002`, `DP-001`, active product context |
| architecture, module boundaries, data shape, dependencies | `WF-001`, relevant architecture cards, ADRs |
| skills, agent behavior, workflow design | `WF-001`, `AR-001` |
| release, CI/CD, publishing, versioning, commits | `WF-REL-001`, semantic commits skill |
| docs that define behavior or process | relevant card for the behavior/process being documented |

## Workflow cards

### WF-001 — Context Cycle

Priority: critical

Load when starting non-trivial work, switching modes, reviewing scope, or recovering after context reset.

Summary:
Select relevant context before acting, execute inside approved scope, verify against selected context, and compress state afterward.

Card:
`docs/context/cards/WF-001-context-cycle.md`

### WF-REL-001 — CI/CD and Release Flow

Priority: high

Load when touching commits, PRs, GitHub Actions, release-it, npm publishing, versioning, or release docs.

Card:
`docs/context/cards/WF-REL-001-cicd-release-flow.md`

## Design principle cards

### DP-001 — No hidden scope expansion

Priority: critical

Load when implementing, refactoring, fixing bugs, or discovering adjacent improvements.

Card:
`docs/context/cards/DP-001-no-hidden-scope-expansion.md`

### DP-002 — Explicit user control

Priority: critical

Load when changing user-facing behavior, defaults, automation, onboarding, configuration, or agent autonomy.

Card:
`docs/context/cards/DP-002-explicit-user-control.md`

## Architecture cards

### AR-001 — Skills are workflows, context cards are project facts

Priority: high

Load when editing skills, context cards, `AGENTS.md`, runbooks, or agent-facing workflow structure.

Card:
`docs/context/cards/AR-001-skills-vs-context-cards.md`

## Skills

### Semantic commits

Use when writing, reviewing, or splitting commits.

Skill:
`skills/semantic-commits/SKILL.md`

## Runbooks

### Release flow

Use when diagnosing or manually checking release/publish behavior.

Runbook:
`docs/runbooks/release-flow.md`

## Stop conditions

Stop before implementation if:

- relevant context cannot be identified
- selected cards conflict
- required context appears missing
- the task requires an unapproved product, architecture, dependency, schema, UX, API, security, release, or workflow decision
- the task is too broad for one bounded context packet

## Maintenance rule

Add a card only when the context is reused, forgetting it would cause drift, and it has clear triggers.
