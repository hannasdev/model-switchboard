# PoC Decision

## Decision

Proceed to the next PoC confirmation step before committing to the full vendor-scoped router MVP.

For this PoC, treat `deep reasoning` as intentionally out of scope as a standalone routed target.

The current PoC validates the local deterministic routing policy, target registries, route explanations, adapter profile mapping, local logging, live SDK reachability for OpenAI/Codex, Anthropic/Claude, and Google/Gemini, and a real router-owned gateway entrypoint that intercepts prompts before execution.

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
7. Target registries and fixture outcomes currently validate useful routing with `quick`, `balanced`, and `best coder` only; no evaluated registry includes a distinct `deep reasoning` route target today.
8. Mapping and live verification refresh completed on May 9, 2026:
   * `poc:mapping-check` passed for OpenAI/Codex, Anthropic/Claude, and Google/Gemini (`status: ok`).
   * Vendor connection checks succeeded with live SDK responses using mapped fast profiles and expected models.
9. Gateway-surface hook confirmation completed on May 9, 2026:
   * `gateway-surface` entrypoint receives request envelopes, routes before dispatch, and records hook timing evidence (`receivedAt`, `routedAt`, `dispatchedAt`).
   * Gateway tests passed for execution and refusal paths (`test/poc-gateway-surface.test.js`).
   * Live gateway dispatch attempts were non-deterministic in this environment (transient network/credential errors), but pre-execution hook interception and target-selection-before-dispatch behavior is proven in the gateway contract itself.
10. Best-coder capability confirmation completed on May 9, 2026 in the gateway contract path:
   * Safe file read capability executed in routed `best coder` turns.
   * Safe file edit capability executed to scoped probe path (`src/poc/logs/capability-probe.txt`).
   * Shell/test capability executed via controlled `npm test` action with captured exit status and output preview.
11. Repeated-turn continuity confirmation completed on May 9, 2026:
   * `gateway-thread-turn` persists `nextSession` by `threadId` and reloads it on subsequent turns.
   * Two-turn evidence shows state progression (`turnCount: 0 -> 1 -> 2`) and routed target continuity updates (`openai-coder -> openai-quick`) across separate invocations.
   * Thread/session store and gateway continuity tests pass (`test/poc-thread-session-store.test.js`, `test/poc-gateway-thread-turn.test.js`).
12. Release-gate workflow confirmation completed on May 9, 2026:
   * `poc:release-gate` now executes mapping checks and all vendor connection checks in a single command.
   * Gate output is structured and non-crashing under transient failures, with explicit per-vendor reasons.
   * Current run correctly surfaced environment connectivity failures as `failed`, making it suitable as a release-blocking signal.

## Missing PoC Confirmation

1. No blocking PoC confirmations remain for the local gateway-scoped validation path.

## Remaining Risks

1. Current validation still relies on local harness/gateway evidence and does not yet include direct integration in a vendor-owned external UI/client runtime.
2. Vendor model catalogs evolve; model ID mapping requires periodic refresh.
3. Thread continuity is currently file-backed local orchestration; it still needs confirmation in a vendor-owned external runtime if that runtime is chosen for MVP delivery.
4. Capability proof is currently against the router-owned gateway contract and scoped safe actions; equivalent controls still need confirmation in a vendor-owned external runtime.

## MVP Guidance

1. Proceed with a vendor-scoped MVP only if the MVP uses the router-owned gateway path validated by this PoC.
2. Keep deterministic routing, explicit explanations, scoped capability controls, and persisted thread continuity in the MVP baseline.
3. Keep connection checks and adapter smoke runs in the development workflow to catch vendor mapping drift early.
4. If the MVP must run inside a vendor-owned external UI/client runtime, treat that runtime integration as a new risk-reduction milestone before broader product work.
5. If production execution-target routing is not available in the chosen runtime, pivot to a narrower model/profile router or route-advisor workflow before building broader MVP features.
