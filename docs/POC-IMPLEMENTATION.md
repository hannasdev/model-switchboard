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

## What Is Not Yet Proven

* A simulated production pre-execution hook surface is validated locally; a real product-integrated hook is still not validated.
* SDK live execution proves prompt submission to selected model/profile mappings; it does not prove routed execution inside the intended product surface.
* The `best coder` target capability claims for repo context, file reads, file edits, shell execution, and test execution are registry metadata, not end-to-end proof from the live SDK checks.
* Session continuity is represented as local session passthrough with turn-count/current-target advancement, not production-grade thread or agent orchestration.

## Paths

* Router core: `src/poc/router.js`
* CLI harness: `src/poc/cli.js`
* Production hook simulator: `src/poc/production_hook.js`
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

## Commands

```bash
npm test
npm run poc:fixtures
npm run poc:route -- --vendor openai --input "Implement the plan."
npm run poc:vendor-matrix
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

* Validate a real pre-execution hook for at least one production surface (beyond the local simulator).
* Refresh and confirm model/profile mappings before relying on them outside the PoC.
