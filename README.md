# Model Switchboard

[![npm version](https://img.shields.io/npm/v/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![npm downloads](https://img.shields.io/npm/dm/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![CI](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml) [![Release](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/hannasdev/model-switchboard/badge)](https://securityscorecards.dev/viewer/?uri=github.com/hannasdev/model-switchboard) [![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12820/badge)](https://www.bestpractices.dev/projects/12820) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Model Switchboard is an experimental routing layer for AI-assisted software delivery.

Its goal is to keep coding sessions moving by choosing model and effort settings before each turn, so you do not have to make that call manually every time.

The project is still exploring the product shape for automatic model hot-swapping. It is useful today as a Claude Code routing wrapper and as a Codex feasibility spike, but it is not yet a polished replacement for an existing AI coding workflow.

## Why It Exists

Choosing the right model repeatedly is a real cognitive tax. A single coding session can shift between quick clarifications, planning, implementation, and debugging, each with different cost and quality needs.

Model Switchboard explores reducing that overhead with consistent routing decisions and a short explanation of why a route was selected.

## Core Value

- Fewer manual model-selection decisions during active development.
- Better default cost and quality tradeoffs by task type.
- Session-aware continuity across routed turns.
- Clear, auditable decisions through concise route explanations and local evidence logs.

## Current Product Slice

The current MVP is a Claude Code workflow integration powered by a separable router core. The Codex work is an active spike to test whether Switchboard can go beyond advisory routing and actually control per-turn model changes inside one continuous session.

High-level flow:

1. You send a prompt through Switchboard.
2. Switchboard classifies the turn and selects a route label.
3. Switchboard launches or resumes Claude with matching model and effort settings for that launch.
4. Route context, session state, and hook evidence are recorded for explainability, replay, and governance.

## Usage Paths

Switchboard currently has three distinct paths. They are intentionally not equivalent.

### Claude Code Wrapper

This is the most complete path today.

Use:

```bash
switchboard "your prompt"
switchboard --interactive
switchboard explain
```

What it allows:

- Routes each prompt before launching or resuming Claude.
- Applies model and effort choices at Claude launch/resume boundaries.
- Records local routing evidence for explainability and replay.

Advantages:

- Most productized workflow in this repository.
- Uses the existing Claude Code user experience.
- Good fit for prompt-by-prompt routing with auditability.

Does not yet support:

- Automatic model changes inside an already-running Claude interactive session.
- Eliminating the cognitive overhead of model choice during a long-lived stock Claude TUI session.

### Advisory Cross-Surface Routing

This path gives a recommendation without taking over execution.

Use:

```bash
switchboard advise --surface openai-codex "your prompt"
```

What it allows:

- Asks Switchboard what it would choose for a target surface.
- Lets you keep using another client manually.

Advantages:

- Low-risk way to test routing policy across vendors or clients.
- Does not require Switchboard to own the session process.

Does not yet support:

- Automatic execution.
- Automatic in-session model switching.
- Reducing all model-selection overhead, because the user still has to apply the recommendation.

### Codex App-Server Spike

This is the experimental hot-swapping path.

Use:

```bash
npm run switchboard:spike:codex-app-server:preflight
npm run switchboard:spike:codex-app-server:protocol
npm run switchboard:spike:codex-app-server:lifecycle
npm run switchboard:spike:codex-app-server
```

What it allows:

- Starts `codex app-server --listen stdio://`.
- Creates one Codex app-server thread.
- Sends multiple `turn/start` requests on that same thread.
- Requests different models on different turns without a `codex exec resume` boundary.

Advantages:

- This is the only current path that suggests Switchboard could go beyond Claude parity.
- It demonstrates a possible Switchboard-owned session surface with per-turn model override.
- It preserves one app-server thread/session while route-selected model requests change.

Does not yet support:

- A polished end-user UI.
- Hot-swapping inside the stock Codex TUI.
- Production stability guarantees, because the app-server surface is still experimental.
- Provider-side backend model attestation; current evidence proves requested model overrides and same-thread completion, not a durable backend model field.

## What It Is Not

- Not a finished replacement for your coding client.
- Not a general-purpose agent runtime.
- Not a claim that stock Claude or stock Codex TUI sessions can be hot-swapped today.
- Not a production-grade cross-vendor orchestration product in this MVP phase.

## Primary Commands

The commands below mix productized MVP commands and spike commands. Commands containing `spike` are feasibility evidence for the Codex direction, not polished product UX.

| Command | What It Does | Use It When |
| --- | --- | --- |
| `switchboard "your prompt"` | Routes a single prompt, chooses target/effort, then launches or resumes Claude for that turn. | You want normal prompt-driven usage with routing applied automatically. |
| `switchboard --interactive` | Starts an interactive Claude session through Switchboard with route-aware session handling. The launched Claude session keeps the selected model/effort; it does not auto-switch models mid-session. | You want a live back-and-forth session instead of one-shot prompts. |
| `switchboard explain` | Shows the latest routing decision, reasoning signals, and correlated evidence for a thread. | You want to audit why a route was chosen or debug routing behavior. |
| `switchboard advise --surface openai-codex "your prompt"` | Returns an advisory routing recommendation for a selected surface without taking over execution. | You want a cross-surface recommendation or policy check before running a turn. |
| `switchboard probe continuity` | Runs a continuity probe for prompt-driven turns and reports whether session continuity checks pass. | You want to verify non-interactive continuity behavior after changes. |
| `switchboard probe continuity-interactive` | Runs the interactive continuity probe and verifies resume/session behavior across turns. | You want to validate interactive continuity and related checks. |
| `npm run switchboard:spike:codex-cli` | Inspects the local Codex CLI command surface and maps two routed turns to Codex `exec`/`resume --model` plans without making live model calls. | You want a product-aligned feasibility signal for Codex CLI route authority before building a deeper integration. |
| `npm run switchboard:spike:codex-cli:live` | Runs the bounded two-turn Codex CLI resume probe with route-selected models and captures JSON/session evidence. | You are ready to collect live evidence for the Codex CLI feasibility spike. |
| `npm run switchboard:spike:codex-app-server:preflight` | Verifies the local Codex CLI version, app-server command availability, login status, and redacted app-server auth evidence before a routed session starts. | You want to check whether a normal user install can support the Codex app-server spike path. |
| `npm run switchboard:spike:codex-app-server:protocol` | Generates Codex app-server TypeScript bindings and verifies the minimum protocol shape Switchboard depends on. | You are checking whether Codex app-server protocol changes would break the feasibility spike. |
| `npm run switchboard:spike:codex-app-server:lifecycle` | Starts Codex app-server, verifies protocol-error handling, completes one turn, interrupts a second turn, captures stderr/malformed-output evidence, and shuts the process down. | You are checking whether Switchboard can safely own the app-server process lifecycle. |
| `npm run switchboard:spike:codex-app-server` | Runs the bounded app-server in-session switch probe with one thread and two route-selected `turn/start` model overrides. | You are evaluating whether Codex app-server can be a Switchboard-controlled session surface beyond `exec`/`resume` parity. |
| `npm test` | Runs the full automated test suite for adapters, router, workflow, and CLI behavior. | You changed routing/workflow/docs and want a full regression check. |

### Interactive Mode Clarification

`switchboard --interactive` selects model/effort at launch, then enters Claude interactive mode with that selection.

Inside that active Claude session, Switchboard does not automatically switch to a different model on later user messages.

If you want per-turn re-routing and potential target/model changes, run prompts through Switchboard as separate turns (for example: `switchboard "..."` each turn) rather than staying in one interactive session.

### Typical First Run

1. Send one routed prompt:
   `switchboard "Implement the retry logic for stale session recovery."`
2. Inspect why the route was chosen:
   `switchboard explain`
3. Validate behavior before opening a PR:
   `npm test`

For detailed command documentation, environment variables, and output formats, see [CLI Reference](docs/CLI-REFERENCE.md).

## Get, Provide Feedback, and Contribute

- Obtain the software:
   - GitHub repository: https://github.com/hannasdev/model-switchboard
   - npm package: https://www.npmjs.com/package/model-switchboard
- Provide feedback (bug reports and enhancements):
   - Issues: https://github.com/hannasdev/model-switchboard/issues
- Contribute to the project:
   - Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## Security & Code Quality

This project prioritizes security for AI-related software:

- **Vulnerability Scanning**: Automated dependency scanning via `npm audit` in CI on pull requests and pushes to `main`, plus [Snyk](https://snyk.io) scans on pushes to `main` and a daily schedule when `SNYK_TOKEN` is configured
- **Static Analysis**: ESLint with security plugin to detect common vulnerabilities
- **Responsible Disclosure**: Follow the [Security Policy](SECURITY.md) to report vulnerabilities privately
- **Test Coverage**: Comprehensive test suite validates security-relevant code paths
- **Developer Knowledge**: Core team has expertise in secure software design and threat modeling

See [SECURITY.md](SECURITY.md) for details on the vulnerability reporting process and security practices.
