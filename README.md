# Model Switchboard

[![npm version](https://img.shields.io/npm/v/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![npm downloads](https://img.shields.io/npm/dm/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![CI](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml) [![Release](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/hannasdev/model-switchboard/badge)](https://securityscorecards.dev/viewer/?uri=github.com/hannasdev/model-switchboard) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Deprecated

Model Switchboard is no longer under active product development.

The project explored whether a session-aware router could reduce model-selection overhead in AI-assisted software delivery by choosing the right model, effort level, or execution target before a turn. The implementation produced useful routing, explainability, replay, and feasibility-spike work, but the core product premise no longer looks strong enough to justify continuing the project as originally framed.

The short version: meaningful model switching requires control over the client or turn boundary. Modern AI coding clients increasingly hide the details that a router would need to make and verify strong routing decisions, including effective context construction, cache behavior, memory, tool state, provider-side model execution, and session compaction. A sidecar can still recommend a route, but it cannot reliably prove that the underlying client used the intended model or context in the way the router expects.

That leaves two viable shapes:

- An advisory tool that explains what target it would choose, while the user or external client still performs the work.
- A Switchboard-owned client, CLI, app-server loop, IDE extension, or orchestrator that controls the turn boundary directly.

The first shape is useful but too weak to remove enough user burden. The second shape is effectively a client or runtime replacement, which is not an obvious benefit for this project compared with using the native clients directly.

For that reason, this repository should be treated as an archived experiment rather than an active product direction.

## What Was Learned

- Routing execution targets is a better abstraction than routing abstract model names.
- Launch/resume-boundary routing can work for wrapper-style integrations, but it does not provide true in-session switching inside an opaque client.
- Advisory routing can provide explanations and handoff suggestions, but it does not remove the need for the user or client to apply the recommendation.
- A Switchboard-owned session loop can request different models across turns, but without provider-side effective-model attestation it still cannot fully prove what happened behind the serving boundary.
- The stronger the routing guarantee, the more the project must own the client, runtime, or orchestration layer.

## What Remains Useful

Parts of the repository may still be useful as reference material:

- Router contracts and execution-target modeling.
- Session-aware classification and deterministic policy ideas.
- Explainability and outcome-attribution logs.
- Replay/evaluation scaffolding for routing decisions.
- Feasibility notes for Claude wrapper, Codex CLI, and Codex app-server surfaces.

The main documentation entrypoint remains [docs/PRD.md](docs/PRD.md). The most relevant product and technical context lives in:

- [docs/product/PRODUCT-PRD.md](docs/product/PRODUCT-PRD.md)
- [docs/ARCHITECTURE-SPEC.md](docs/ARCHITECTURE-SPEC.md)
- [docs/contracts/router-contracts.md](docs/contracts/router-contracts.md)
- [docs/product/ROUTER-PHASE-PLAN.md](docs/product/ROUTER-PHASE-PLAN.md)
- [docs/REPLAY-GUIDE.md](docs/REPLAY-GUIDE.md)

## Historical Scope

Model Switchboard previously included three product paths:

- A Claude Code wrapper that selected model and effort settings at launch or resume boundaries.
- Advisory cross-surface routing for clients where Switchboard did not control execution.
- A Codex app-server feasibility spike that tested whether a Switchboard-owned session loop could request route-selected models on one continuous thread.

These paths remain in the repository for historical and technical reference, but they should not be read as an active recommendation to adopt Model Switchboard as a production workflow.

## Development

The existing test suite can still be run with:

```bash
npm test
```

The package, CLI, and spike commands are retained as-is unless the repository is later cleaned up further. Future work, if any, should start by deciding whether the goal is archival cleanup, extraction of reusable router ideas, or a new client-owned product with an explicitly different premise.

## Security

If you discover a security issue in this repository or the published package, follow the [Security Policy](SECURITY.md) for private reporting.
