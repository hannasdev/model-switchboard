# PoC Implementation Notes

This document tracks the executable PoC harness that supports [POC](POC.md) and the follow-up PoC 2 Claude Code wrapper/hook validation.

Note: the old `src/poc/*` harnesses, gateway/prod-hook simulators, and `npm run poc:*` commands were intentionally removed after the MVP surface moved to the product `switchboard` command. The historical bullets below describe validation evidence from the PoC phase; the active paths and commands are listed in the later sections.

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
* Historical PoC release-gate command ran mapping consistency checks and vendor connection checks in one pass with structured per-vendor pass/fail output (`poc:release-gate`).
* PoC 2 Switchboard workflow slice plans Claude Code launch/resume turns through a separable workflow layer while keeping router policy independent of Claude mechanics.
* PoC 2 continuity probe verifies two planned routed turns can share one Claude session id while changing route labels and model/effort flags.
* PoC 2 live continuity harness can execute planned Claude CLI turns, capture stdout/stderr previews, and verify whether the second turn sees first-turn context.
* PoC 2 live continuity is verified when the first turn starts Claude with `--session-id` and the second routed turn resumes with `--resume <session-id>`.
* Live run `live-poc2-007` verified both turns executed, the same Claude session id was used, route changed from `best coder` to `balanced`, turn count advanced, and the second turn returned the first-turn probe phrase.
* PoC 2 route-context correlation stores wrapper route metadata by Claude session id and lets Claude hooks log whether wrapper context was matched or missing.
* Hook correlation tests verify `UserPromptSubmit` can inject matched Switchboard route context and `PreToolUse` can log route-aware tool decision evidence.
* Live hook-correlation run `live-poc2-hooks-001` verified real `UserPromptSubmit` hook events matched wrapper route context for both routed turns.
* Live tool-correlation run `live-poc2-toolhook-001` verified a real `PreToolUse` hook event matched wrapper route context and logged an allowed `Read` decision.
* MVP `switchboard` bin entrypoint now supports prompt-driven routed turns, with `--dry-run` for deterministic route planning and default live execution for real use.
* MVP `switchboard explain` summarizes the latest route decision, Claude flags, session id, route-context match, hook events, and tool decisions from local evidence logs.
* MVP CLI reports pre-launch failures cleanly so route-context write failures stop before Claude launch.
* MVP hook policy now fails closed for `PreToolUse` events without matched Switchboard route context, including otherwise safe tools.
* MVP coarse overrides are wired through generic routing and exposed by the CLI: `--stronger`, `--cheaper`, and `--stay`.
* MVP wrapper threat model is documented in [Switchboard Wrapper Threat Model](../WRAPPER-THREAT-MODEL.md).
* MVP live verification completed through `node bin/switchboard.js` with `--no-tools`: first turn executed via Claude CLI and returned `SWITCHBOARD_OK`; second turn reused the same Claude session id and recovered the previous-turn token; `switchboard explain` showed matched route context and correlated `UserPromptSubmit` hook events.

## What Is Not Yet Proven

* The current product surface is an initial prompt-driven `switchboard` command, not yet a fully polished end-user workflow.
* Live Claude continuity has been verified for non-interactive Claude CLI turns using `--session-id` for the first turn and `--resume <session-id>` for later turns; the interactive Claude session UX is not yet validated.
* Hook correlation is verified by Claude session id for live `UserPromptSubmit` and `PreToolUse` events, but broader production tool-governance policy beyond route-context trust is not hardened.
* PoC 2 live runs depend on Claude CLI authentication and may need to run outside sandboxed environments when Claude auth is stored in the local keychain/session.
* Cross-vendor routing remains intentionally unproven for the workflow product.
* Router extraction into `@model-switchboard/router` is not yet done; the current code only keeps the router/workflow boundary credible.

## Key Constraints Learned

* Reusing `--session-id` for the second non-interactive Claude turn fails with `Session ID ... is already in use`; resumed turns must use `--resume <session-id>`.
* Route context must be written before launching Claude so pre-execution hooks can correlate against wrapper decisions.
* Runtime logs and Claude local settings are intentionally ignored by git; live evidence should be summarized in docs rather than committed as generated artifacts.

## Paths

### Product Slice

* Switchboard bin entrypoint: `bin/switchboard.js`
* Switchboard CLI: `src/switchboard/cli.js`
* Shared product paths: `src/switchboard/paths.js`
* Switchboard workflow: `src/switchboard/workflow.js`
* Switchboard route-context store: `src/switchboard/route-context.js`
* Switchboard session store: `src/switchboard/session-store.js`
* Claude hook bridge: `src/switchboard/claude-hook-bridge.js`
* Router core: `src/router/router.js`
* Switchboard CLI tests: `test/switchboard-cli.test.js`
* Switchboard path tests: `test/switchboard-paths.test.js`

### Router and Adapter Surface

* OpenAI/Codex adapter: `src/adapters/openai-codex-adapter.js`
* OpenAI SDK client: `src/adapters/openai-sdk-client.js`
* Anthropic/Claude adapter: `src/adapters/anthropic-claude-adapter.js`
* Anthropic SDK client: `src/adapters/anthropic-sdk-client.js`
* Google/Gemini adapter: `src/adapters/gemini-adapter.js`
* Gemini SDK client: `src/adapters/gemini-sdk-client.js`
* Mapping registry: `src/adapters/model-mappings.js`
* OpenAI target registry: `src/router/data/targets.openai.json`
* Anthropic target registry: `src/router/data/targets.anthropic.json`
* Gemini target registry: `src/router/data/targets.gemini.json`
* Fixtures: `src/router/data/fixtures.json`
* Router tests: `test/router.test.js`
* Adapter tests: `test/adapters.test.js`
* Claude CLI launcher tests: `test/claude-cli-launcher.test.js`
* Claude hook bridge tests: `test/claude-hook-bridge.test.js`
* Thread session tests: `test/thread-session-store.test.js`
* Switchboard workflow tests: `test/switchboard-workflow.test.js`

## Commands

```bash
npm test
npm test
node bin/switchboard.js --dry-run --thread-id smoke-mvp "Implement the plan."
node bin/switchboard.js explain --thread-id smoke-mvp
npm run check:openai
npm run check:anthropic
npm run check:gemini
```

## Current Gaps

* Vendor live checks require valid API credentials and network access to the configured vendors.
* The PoC 2 outcome has been summarized in [PoC Outcome Analysis](POC-OUTCOME-ANALYSIS.md); keep that decision record current as new live evidence lands.
* Router extraction into a standalone package is still future productization work.
* Product-facing Switchboard code now lives under `src/switchboard`, router data under `src/router`, and adapter code under `src/adapters`.
