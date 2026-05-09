# PoC Implementation Notes

This document tracks the executable PoC harness that supports [POC](POC.md).

## What Is Implemented

* Deterministic prompt classification and routing core.
* Vendor-scoped target registries for OpenAI/Codex and Anthropic/Claude.
* Fixture-driven route validation set.
* CLI harness for route checks and fixture execution.
* OpenAI/Codex adapter spike with executable route-to-profile mapping.
* OpenAI SDK live execution path verified with API response IDs logged.
* Cheap OpenAI connection-check command for low-cost API reachability validation.
* Anthropic/Claude adapter parity with live execution path verification.
* Cheap Anthropic connection-check command for low-cost API reachability validation.
* Local NDJSON route-decision logging.
* Vendor feasibility matrix with OpenAI and Anthropic live verification evidence.
* Node test suite for route behavior assertions.

## Paths

* Router core: `src/poc/router.js`
* CLI harness: `src/poc/cli.js`
* OpenAI/Codex adapter: `src/poc/adapters/openai_codex_adapter.js`
* OpenAI SDK client: `src/poc/adapters/openai_sdk_client.js`
* Anthropic/Claude adapter: `src/poc/adapters/anthropic_claude_adapter.js`
* Anthropic SDK client: `src/poc/adapters/anthropic_sdk_client.js`
* OpenAI target registry: `src/poc/data/targets.openai.json`
* Anthropic target registry: `src/poc/data/targets.anthropic.json`
* Fixtures: `src/poc/data/fixtures.json`
* Route logs: `src/poc/logs/route-decisions.ndjson`
* Vendor matrix scaffold: `src/poc/vendor_matrix.json`
* Tests: `test/poc-router.test.js`
* Adapter tests: `test/poc-adapter.test.js`

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
```

## Current Gaps

* Real pre-execution hook for production surfaces remains to be validated in concrete integration tests.
