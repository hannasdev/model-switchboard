# PoC Implementation Notes

This document tracks the executable PoC harness that supports [POC](POC.md).

## What Is Implemented

* Deterministic prompt classification and routing core.
* Vendor-scoped target registries for OpenAI/Codex and Anthropic/Claude.
* Fixture-driven route validation set.
* CLI harness for route checks and fixture execution.
* Local NDJSON route-decision logging.
* Initial vendor feasibility matrix scaffold.
* Node test suite for route behavior assertions.

## Paths

* Router core: `src/poc/router.js`
* CLI harness: `src/poc/cli.js`
* OpenAI target registry: `src/poc/data/targets.openai.json`
* Anthropic target registry: `src/poc/data/targets.anthropic.json`
* Fixtures: `src/poc/data/fixtures.json`
* Route logs: `src/poc/logs/route-decisions.ndjson`
* Vendor matrix scaffold: `src/poc/vendor_matrix.json`
* Tests: `test/poc-router.test.js`

## Commands

```bash
npm test
npm run poc:fixtures
npm run poc:route -- --vendor openai --input "Implement the plan."
npm run poc:vendor-matrix
```

## Current Gaps

* Vendor adapters are not yet implemented.
* No real pre-execution hook or SDK route execution yet.
* Vendor matrix is a starter scaffold and must be validated with concrete integration tests.
