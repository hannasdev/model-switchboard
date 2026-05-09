# PoC Decision

## Decision

Go for a vendor-scoped router MVP.

The PoC validated the critical external dependency: at least one, and now two, vendor ecosystems support useful pre-execution routing with target selection and route explanations, without brittle terminal UI automation.

## Evidence

1. Deterministic routing policy passed fixture coverage (`11/11`) and tests (`npm test`).
2. OpenAI/Codex live checks succeeded:
   * Cheap connection check (`poc:openai-connection-check`) succeeded.
   * Routed live execution (`poc:openai-adapter-live`) succeeded with logged response ID.
3. Anthropic/Claude live checks succeeded:
   * Cheap connection check (`poc:anthropic-connection-check`) succeeded.
   * Routed live execution (`poc:anthropic-adapter-live`) succeeded with logged response ID.
4. Route and execution evidence is captured in local NDJSON logs at `src/poc/logs/route-decisions.ndjson`.

## Remaining Risks

1. Current validation path is CLI harness + SDK clients, not the final production hook surface.
2. Vendor model catalogs evolve; model ID mapping requires periodic refresh.
3. Session continuity is validated as local session passthrough, not full production-grade thread orchestration.

## MVP Guidance

1. Proceed with a vendor-scoped MVP that keeps deterministic routing and explicit explanations.
2. Treat production pre-execution hook integration as the first implementation risk-reduction milestone.
3. Keep connection checks and adapter smoke runs in the development workflow to catch vendor mapping drift early.
