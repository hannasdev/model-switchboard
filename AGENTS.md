# AGENTS.md

## Purpose

This file defines the always-loaded operating rules for AI agents working in this repository.

It is not the product specification, roadmap, decision log, release runbook, or workflow manual.

Use:
- `docs/product/**` for product state, PRDs, milestones, and open questions
- `docs/adr/**` for durable architecture or product decisions
- `docs/context/DECK.md` as the context-card index
- `docs/context/cards/**` for reusable context cards
- `docs/context/packets/**` for task-specific working context
- `skills/**/SKILL.md` for reusable agent workflows
- `docs/runbooks/**` for operational procedures

## Core invariant

Context is a working set, not memory.

Before non-trivial work, build the smallest sufficient working context. After non-trivial work, write back compact state. Do not rely on chat history as durable project memory.

## Default boot sequence

For any non-trivial product, architecture, implementation, documentation, or review task:

1. Read `docs/context/DECK.md`.
2. Select relevant context cards.
3. Load the active task, milestone, or product context.
4. Summarize loaded context, missing/uncertain context, and stop conditions.
5. Use `docs/context/cards/WF-001-context-cycle.md` for the detailed workflow.

Do not begin implementation until relevant context has been selected and summarized.

## Approval boundary

Do not implement before the user has approved the task or milestone plan, unless the user explicitly asks for immediate implementation.

During implementation, do not make unapproved product, architecture, dependency, schema, UX, API, security, persistence, release, or workflow decisions.

If an unapproved decision is required, stop and produce a decision proposal instead of coding around it.

Do not expand scope because an adjacent improvement seems useful.

## Scope boundary

Implementation must stay inside the approved task.

Stop before implementation if:
- selected context appears incomplete
- relevant context cards conflict
- public behavior would change beyond approved scope
- new dependencies are required
- release, CI/CD, publishing, or versioning behavior would change
- the work no longer fits in one bounded context packet

## Testing and verification

Run the smallest relevant test set first. Run broader checks before final handoff or PR.

Do not claim behavior is verified unless it was actually tested or checked.

If tests cannot be run, explain why and describe the risk.

## Commit and PR rules

Use the global semantic commits skill when writing or reviewing commits.

Local repository rules, hooks, and release tooling take precedence over global skills.

Before PR or handoff, produce a scope delta report. Use `WF-001` for the expected report content.

## Dependency rules

Do not add production dependencies without explicit approval.

If a new dependency seems necessary, stop and propose why it is needed, alternatives considered, maintenance/security risk, and effect on project complexity.

## Security and privacy rules

Do not introduce network calls, telemetry, external services, credential handling, or data persistence without explicit approval.

Do not expose secrets in logs, tests, examples, or documentation.

## Documentation rules

Keep this file small and stable.

Do not put full PRDs, milestone histories, long design discussions, release runbooks, or full context cards in this file.

When updating docs, use the ownership matrix in `docs/product/PRD.md` (`Documentation Ownership`) to choose the canonical destination before editing.

Docs update checklist:
- update the canonical doc first
- add or refresh cross-links from supporting docs
- avoid duplicating durable architecture text in MVP or milestone records

When adding project knowledge, choose the narrowest durable home:
- product behavior → `docs/product/**`
- durable decision → `docs/adr/**` or decision log
- reusable context → `docs/context/cards/**`
- task-specific state → `docs/context/packets/**`
- repeatable workflow → `skills/**/SKILL.md`
- operational procedure → `docs/runbooks/**`
