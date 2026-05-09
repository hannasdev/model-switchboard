# PoC Implementation Notes

This document tracks the executable PoC harness that supports [POC](POC.md).

## What Is Implemented

* Deterministic prompt classification and routing core.
* Vendor-scoped target registries for OpenAI/Codex and Anthropic/Claude.
* Fixture-driven route validation set.
* CLI harness for route checks and fixture execution.
* OpenAI/Codex adapter spike with executable route-to-profile mapping.
* Local NDJSON route-decision logging.
* Initial vendor feasibility matrix scaffold.
* Node test suite for route behavior assertions.

## Paths

* Router core: `src/poc/router.js`
* CLI harness: `src/poc/cli.js`
* OpenAI/Codex adapter: `src/poc/adapters/openai_codex_adapter.js`
* OpenAI SDK client: `src/poc/adapters/openai_sdk_client.js`
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
npm run poc:adapter-spike -- --input "Implement the plan."
npm run poc:adapter-live -- --input "Implement the plan."
```

## Current Gaps

* OpenAI live execution requires `OPENAI_API_KEY`; without it, the SDK path reports `not_executed`.
* Anthropic adapter is not yet implemented.
* Real pre-execution hook for production surfaces remains to be validated in concrete integration tests.
