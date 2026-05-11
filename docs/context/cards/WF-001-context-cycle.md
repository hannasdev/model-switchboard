# WF-001 — Context Cycle

## Type

workflow-card

## Priority

critical

## Applies when

- starting non-trivial work
- switching between planning, implementation, review, and handoff
- beginning work in a fresh session
- recovering after context reset or drift
- reviewing whether implementation stayed inside approved scope

## Summary

Context is a working set, not memory.

Before acting, build the smallest sufficient working context for the current task. After acting, write back a compact state delta.

Default loop:

1. Select relevant context.
2. Plan within bounded scope.
3. Execute only inside approved scope.
4. Verify against selected context.
5. Compress the result into handoff/state.

## Core rule

Do not begin implementation until relevant context has been selected and summarized.

The context selection summary must include:

- loaded context
- potentially relevant context not loaded
- missing or uncertain context
- stop conditions

## Mode separation

Classify the current work mode before acting:

- Product / PRD discussion
- Architecture / design decision
- Task planning
- Implementation
- Review
- Handoff / state update

Do not blend modes silently. If work changes mode, say so and apply the rules for the new mode.

## Context selection

Before implementation or review, check:

- `docs/context/DECK.md`
- active task packet or milestone
- relevant PRD/product state
- relevant ADRs or decision log entries
- relevant code and tests
- relevant skills or runbooks

Prefer narrow, task-specific context over broad documents. Load only what is needed for the current step.

## Planning requirements

Before implementation, produce a bounded plan with:

- objective
- non-goals
- allowed scope
- likely affected files or areas
- applicable context cards
- decisions that must not be made during implementation
- verification strategy

Implementation requires explicit approval unless the user has already approved the task or asked for immediate implementation.

## Implementation rules

During implementation:

- stay inside approved scope
- do not silently add adjacent improvements
- do not reinterpret the milestone
- do not make unapproved product, architecture, dependency, schema, UX, API, security, release, or workflow decisions
- stop if selected context appears incomplete
- split the task if the working context becomes too large

## Review requirements

Review against:

- approved task or milestone
- selected context cards
- stated non-goals
- actual diff
- tests and verification output

Before PR, commit handoff, or task completion, produce a scope delta report:

- planned scope
- implemented scope
- not implemented
- extra changes
- decisions encountered
- tests/checks run
- open questions
- recommended next step

## Compression requirements

At the end of non-trivial work, produce or update compact state:

- completed work
- changed files
- tests/checks run
- decisions made
- decisions deferred
- open questions
- suggested next step

Durable decisions belong in ADRs or the decision log. Current execution state belongs in a handoff, task packet, or active milestone update.

## Stop and ask if

- relevant context cannot be identified
- selected context cards conflict
- required context appears missing
- implementation would exceed approved scope
- the task requires an unapproved product or architecture decision
- implementation would add or change dependencies
- implementation would change release, CI/CD, publishing, or versioning behavior
- the work no longer fits in one bounded context packet
