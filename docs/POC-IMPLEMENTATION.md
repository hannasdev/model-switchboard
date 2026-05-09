# PoC Implementation Notes

This document tracks the executable PoC harness that supports [POC](POC.md).

## What Is Implemented

* Deterministic prompt classification and routing core.
* Vendor-scoped target registries for OpenAI/Codex, Anthropic/Claude, and Google/Gemini.
* Fixture-driven route validation set.
* CLI harness for route checks and fixture execution.
* OpenAI/Codex adapter spike with executable route-to-profile mapping.
* OpenAI SDK live execution path verified with API response IDs logged.
* Cheap OpenAI connection-check command for low-cost API reachability validation.
* Anthropic/Claude adapter parity with live execution path verification.
* Cheap Anthropic connection-check command for low-cost API reachability validation.
* Google/Gemini adapter parity with live execution path verification.
* Cheap Gemini connection-check command for low-cost API reachability validation.
* Local NDJSON route-decision logging.
* Vendor feasibility matrix with OpenAI, Anthropic, and Gemini live verification evidence.
* Node test suite for route behavior assertions.
* Fixture assertions now validate required capabilities and explanation reason snippets per fixture.
* User-correction fixture now validates correction classification precedence (`user_correction_signal`) so dissatisfaction is not masked by generic planning keywords.
* Production-surface hook simulator that intercepts a turn pre-execution, routes it, executes a safe repo action for `best coder`, and advances session state.
* Production-hook tests covering routed tool execution, non-tool quick path, and test-action invocation via injected runner.
* `deep reasoning` is intentionally not represented as a standalone active target in current PoC registries; correction/planning escalation falls back to `balanced` when no `deep reasoning` target exists.
* Centralized target/profile/model mapping registry with automated cross-vendor consistency checks (`poc:mapping-check`).
* Live connection-check refresh completed on May 9, 2026 (OpenAI, Anthropic, Gemini) with successful profile-to-model execution.
* Router-owned gateway entrypoint validates pre-execution interception contract, routing, and adapter dispatch boundaries (`gateway_entrypoint` evidence in NDJSON logs).
* `best coder` capability actions are now validated in the gateway path under explicit controls: safe file read, safe file edit to scoped probe log, and shell test execution (`npm test`).
* Threaded gateway turns now persist and reload continuity state by `threadId`, proving repeated-turn routing continuity beyond per-request in-memory session fields.
* Release-gate command now runs mapping consistency checks and vendor connection checks in one pass with structured per-vendor pass/fail output (`poc:release-gate`).

## What Is Not Yet Proven

* A real router-owned pre-execution hook surface is validated locally; direct integration into an external vendor-owned UI/client surface is still not validated.
* SDK live execution proves prompt submission to selected model/profile mappings; it does not prove routed execution inside the intended product surface.
* Continuity is currently proven with local file-backed thread orchestration, not a vendor-owned external thread/runtime service.

## Paths

* Router core: `src/poc/router.js`
* CLI harness: `src/poc/cli.js`
* Production hook simulator: `src/poc/production_hook.js`
* Gateway surface entrypoint: `src/poc/gateway_surface.js`
* Capability action runner: `src/poc/capability_actions.js`
* Thread session store: `src/poc/thread_session_store.js`
* OpenAI/Codex adapter: `src/poc/adapters/openai_codex_adapter.js`
* OpenAI SDK client: `src/poc/adapters/openai_sdk_client.js`
* Anthropic/Claude adapter: `src/poc/adapters/anthropic_claude_adapter.js`
* Anthropic SDK client: `src/poc/adapters/anthropic_sdk_client.js`
* Google/Gemini adapter: `src/poc/adapters/gemini_adapter.js`
* Gemini SDK client: `src/poc/adapters/gemini_sdk_client.js`
* OpenAI target registry: `src/poc/data/targets.openai.json`
* Anthropic target registry: `src/poc/data/targets.anthropic.json`
* Gemini target registry: `src/poc/data/targets.gemini.json`
* Fixtures: `src/poc/data/fixtures.json`
* Route logs: `src/poc/logs/route-decisions.ndjson`
* Vendor matrix scaffold: `src/poc/vendor_matrix.json`
* Tests: `test/poc-router.test.js`
* Adapter tests: `test/poc-adapter.test.js`
* Production hook tests: `test/poc-production-hook.test.js`
* Gateway surface tests: `test/poc-gateway-surface.test.js`
* Capability action tests: `test/poc-capability-actions.test.js`
* Thread session tests: `test/poc-thread-session-store.test.js`
* Gateway thread continuity tests: `test/poc-gateway-thread-turn.test.js`

## Commands

```bash
npm test
npm run poc:fixtures
npm run poc:route -- --vendor openai --input "Implement the plan."
npm run poc:vendor-matrix
npm run poc:mapping-check
npm run poc:gateway-surface
npm run poc:gateway-surface -- --tool-action run_tests
npm run poc:gateway-thread-turn -- --thread-id poc-thread-1 --input "Implement the plan."
npm run poc:release-gate
npm run poc:openai-adapter-spike -- --input "Implement the plan."
npm run poc:openai-adapter-live -- --input "Implement the plan."
npm run poc:openai-connection-check
npm run poc:anthropic-adapter-spike -- --input "Implement the plan."
npm run poc:anthropic-adapter-live -- --input "Implement the plan."
npm run poc:anthropic-connection-check
npm run poc:gemini-adapter-spike -- --input "Implement the plan."
npm run poc:gemini-adapter-live -- --input "Implement the plan."
npm run poc:gemini-connection-check
npm run poc:production-hook -- --input "Implement the plan." --tool-action read_file
```

## Current Gaps

* External vendor connectivity is environment-dependent; release-gate should be executed in CI or release environment with valid network access and credentials.
