# PoC Decision

## Decision

Proceed to the next PoC confirmation step before committing to the full vendor-scoped router MVP.

The current PoC validates the local deterministic routing policy, target registries, route explanations, adapter profile mapping, local logging, and live SDK reachability for OpenAI/Codex, Anthropic/Claude, and Google/Gemini.

It does not yet validate the final production hook surface. In particular, the live SDK checks prove that the router can select a model/profile before sending a prompt, but they do not prove that the intended product surface can intercept a user turn before execution, redirect that turn into a different agent/tool-capable target, preserve production session state, or perform repo-context/file-edit/test-execution work through the routed target.

## Evidence

1. Deterministic routing policy passed current fixture coverage (`11/11`) and tests (`npm test`).
2. OpenAI/Codex live checks succeeded:
   * Cheap connection check (`poc:openai-connection-check`) succeeded.
   * Routed live SDK execution (`poc:openai-adapter-live`) succeeded with logged response ID.
3. Anthropic/Claude live checks succeeded:
   * Cheap connection check (`poc:anthropic-connection-check`) succeeded.
   * Routed live SDK execution (`poc:anthropic-adapter-live`) succeeded with logged response ID.
4. Route and execution evidence is captured in local NDJSON logs at `src/poc/logs/route-decisions.ndjson`.
5. Google/Gemini live checks succeeded:
   * Cheap connection check (`poc:gemini-connection-check`) succeeded.
   * Routed live SDK execution (`poc:gemini-adapter-live`) succeeded with logged response ID.
6. Production-hook simulator checks succeeded:
   * `poc:production-hook` intercepts the turn pre-execution and routes before action dispatch.
   * Routed `best coder` turns can execute safe repo-context actions (file read, test command path).
   * Session continuity fields (`currentTargetId`, `turnCount`) advance across simulated turns.

## Missing PoC Confirmation

1. Validate at least one real production pre-execution hook surface that can see the user prompt before model or agent execution (beyond local simulator evidence).
2. Confirm full "best coder" capability claims in a real product-integrated path, including safe file-edit and shell/test execution behavior under real controls.
3. Validate repeated-turn continuity in product-level thread or agent orchestration beyond local session-field passthrough.
4. Decide whether `deep reasoning` is intentionally out of scope for this PoC or should be represented as a target when a vendor exposes a meaningful distinction.
5. Refresh or externally confirm model/profile mappings before treating the target registry as current.

## Remaining Risks

1. Current validation path is CLI harness + SDK clients, not the final production hook surface.
2. Vendor model catalogs evolve; model ID mapping requires periodic refresh.
3. Session continuity is validated as local session passthrough, not full production-grade thread orchestration.
4. Target capability metadata is manually asserted and has not been proven against real tool-capable execution.

## MVP Guidance

1. Treat the remaining PoC confirmation list as the first implementation risk-reduction milestone.
2. If at least one production surface passes those checks, proceed with a vendor-scoped MVP that keeps deterministic routing and explicit explanations.
3. Keep connection checks and adapter smoke runs in the development workflow to catch vendor mapping drift early.
4. If production execution-target routing is not available, pivot to a narrower model/profile router or route-advisor workflow before building broader MVP features.
