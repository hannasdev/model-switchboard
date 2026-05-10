# PoC Implementation Notes

This document tracks the executable PoC harness that supports [POC](POC.md) and the follow-up PoC 2 Claude Code wrapper/hook validation.

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
* PoC 2 Switchboard workflow slice plans Claude Code launch/resume turns through a separable workflow layer while keeping router policy independent of Claude mechanics.
* PoC 2 continuity probe verifies two planned routed turns can share one Claude session id while changing route labels and model/effort flags.
* PoC 2 live continuity harness can execute planned Claude CLI turns, capture stdout/stderr previews, and verify whether the second turn sees first-turn context.
* PoC 2 live continuity is verified when the first turn starts Claude with `--session-id` and the second routed turn resumes with `--resume <session-id>`.
* Live run `live-poc2-007` verified both turns executed, the same Claude session id was used, route changed from `best coder` to `balanced`, turn count advanced, and the second turn returned the first-turn probe phrase.
* PoC 2 route-context correlation stores wrapper route metadata by Claude session id and lets Claude hooks log whether wrapper context was matched or missing.
* Hook correlation tests verify `UserPromptSubmit` can inject matched Switchboard route context and `PreToolUse` can log route-aware tool decision evidence.
* Live hook-correlation run `live-poc2-hooks-001` verified real `UserPromptSubmit` hook events matched wrapper route context for both routed turns.
* Live tool-correlation run `live-poc2-toolhook-001` verified a real `PreToolUse` hook event matched wrapper route context and logged an allowed `Read` decision.

## What Is Not Yet Proven

* The current product surface is still a PoC harness, not a polished end-user `switchboard` command.
* Live Claude continuity has been verified for non-interactive Claude CLI turns using `--session-id` for the first turn and `--resume <session-id>` for later turns; the interactive Claude session UX is not yet validated.
* Hook correlation is verified by Claude session id for live `UserPromptSubmit` and `PreToolUse` events, but broader production tool-governance policy is not hardened.
* PoC 2 live runs depend on Claude CLI authentication and may need to run outside sandboxed environments when Claude auth is stored in the local keychain/session.
* Cross-vendor routing remains intentionally unproven for the workflow product.
* Router extraction into `@model-switchboard/router` is not yet done; the current code only keeps the router/workflow boundary credible.

## Key Constraints Learned

* Reusing `--session-id` for the second non-interactive Claude turn fails with `Session ID ... is already in use`; resumed turns must use `--resume <session-id>`.
* Route context must be written before launching Claude so pre-execution hooks can correlate against wrapper decisions.
* Runtime logs and Claude local settings are intentionally ignored by git; live evidence should be summarized in docs rather than committed as generated artifacts.

## Paths

* Router core: `src/poc/router.js`
* CLI harness: `src/poc/cli.js`
* Claude CLI launcher: `src/poc/claude_cli_launcher.js`
* Claude hook bridge: `src/poc/claude_hook_bridge.js`
* Production hook simulator: `src/poc/production_hook.js`
* Gateway surface entrypoint: `src/poc/gateway_surface.js`
* PoC 2 Switchboard workflow: `src/poc/switchboard_workflow.js`
* PoC 2 Switchboard CLI harness: `src/poc/switchboard_cli.js`
* PoC 2 route context store: `src/poc/switchboard_route_context.js`
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
* Claude CLI launcher tests: `test/poc-claude-cli-launcher.test.js`
* Claude hook bridge tests: `test/poc-claude-hook-bridge.test.js`
* Production hook tests: `test/poc-production-hook.test.js`
* Gateway surface tests: `test/poc-gateway-surface.test.js`
* Capability action tests: `test/poc-capability-actions.test.js`
* Thread session tests: `test/poc-thread-session-store.test.js`
* Gateway thread continuity tests: `test/poc-gateway-thread-turn.test.js`
* PoC 2 Switchboard workflow tests: `test/poc-switchboard-workflow.test.js`

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
npm run poc:claude-cli-route -- --input "Implement the plan."
npm run poc:claude-cli-live -- --input "Implement the plan."
npm run poc:switchboard-turn -- --input "Implement the plan."
npm run poc:switchboard-turn -- --live true --thread-id poc2-toolhook --input "Review package.json by using the Read tool to inspect it, then reply with only the package name."
npm run poc:switchboard-continuity -- --thread-id poc2-continuity
npm run poc:switchboard-continuity-live -- --thread-id poc2-continuity-live
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

* Release-gate requires valid API credentials and network access to the configured vendors.
* The PoC 2 outcome has been summarized in [PoC Outcome Analysis](POC-OUTCOME-ANALYSIS.md); keep that decision record current as new live evidence lands.
* The router remains in the PoC source tree; extraction into a package boundary is a future productization step.
