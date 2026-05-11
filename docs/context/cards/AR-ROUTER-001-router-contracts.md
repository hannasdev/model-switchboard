# AR-ROUTER-001 — Router Contracts

## Type

architecture-card

## Priority

critical

## Applies when

- changing router decision behavior
- changing session state, task classification, target metadata, routing decisions, context packages, router config, or routing log events
- changing model/provider/client-surface routing behavior
- changing continuity, handoff, replay, attribution, or policy evaluation behavior
- changing adapter mappings for Claude, OpenAI, Gemini, or other clients
- changing schemas, logs, migrations, compatibility, or versioning

## Relevant paths

- `docs/contracts/router/v0.1.0-experimental.md`
- router implementation files
- adapter implementation files
- routing log/event code
- policy evaluation and replay code
- related tests and fixtures

## Summary

Router contracts define the normative control-plane boundary for routing decisions.

Core routing semantics must remain vendor-neutral. Vendor-specific behavior belongs in appendices, adapter mappings, or workflow execution layers.

## Required context

Before implementing router-related changes, load the relevant sections of:

`docs/contracts/router/v0.1.0-experimental.md`

Prefer loading only the sections relevant to the task instead of the whole contract.

## Design rules

- Route execution targets, not abstract models.
- Keep hard constraints separate from soft preferences.
- Keep durable session mode separate from latest-turn task type.
- Do not allow manual overrides to bypass hard constraints.
- Capture enough evidence for explainability and replay.

## Stop and ask if

- a contract field meaning would change
- a required field would be removed
- a schema version bump may be needed
- vendor-specific behavior is leaking into core router semantics
- hard constraints and soft preferences are being mixed
- manual override behavior could bypass constraints
- replay, attribution, or explainability evidence would become weaker
- implementation requires expanding the schema beyond the current milestone

## Related documents

- `docs/contracts/router/v0.1.0-experimental.md`
- relevant ADRs
- `docs/product/OPEN_QUESTIONS.md`
