# Model Switchboard

[![npm version](https://img.shields.io/npm/v/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![npm downloads](https://img.shields.io/npm/dm/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![CI](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml) [![Release](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/hannasdev/model-switchboard/badge)](https://securityscorecards.dev/viewer/?uri=github.com/hannasdev/model-switchboard) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Model Switchboard is a routing layer for AI-assisted software delivery.

It keeps coding sessions moving by choosing model and effort settings before each turn, so you do not have to make that call manually every time.

## Get, Feedback, and Contribute

- Obtain the software:
   - GitHub repository: https://github.com/hannasdev/model-switchboard
   - npm package: https://www.npmjs.com/package/model-switchboard
- Provide feedback (bug reports and enhancements):
   - Issues: https://github.com/hannasdev/model-switchboard/issues
- Contribute to the project:
   - Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## Why It Exists

Choosing the right model repeatedly is a real cognitive tax. A single coding session can shift between quick clarifications, planning, implementation, and debugging, each with different cost and quality needs.

Model Switchboard reduces that overhead with consistent routing decisions and a short explanation of why a route was selected.

## Core Value

- Fewer manual model-selection decisions during active development.
- Better default cost and quality tradeoffs by task type.
- Session-aware continuity across routed turns.
- Clear, auditable decisions through concise route explanations and local evidence logs.

## Current Product Slice

The current MVP is a Claude Code workflow integration powered by a separable router core.

High-level flow:

1. You send a prompt through Switchboard.
2. Switchboard classifies the turn and selects a route label.
3. Switchboard launches or resumes Claude with matching model and effort settings.
4. Route context, session state, and hook evidence are recorded for explainability, replay, and governance.

## What It Is Not

- Not a replacement for your coding client.
- Not a general-purpose agent runtime.
- Not a cross-vendor orchestration product in this MVP phase.

## Security & Code Quality

This project prioritizes security for AI-related software:

- **Vulnerability Scanning**: Automated dependency scanning via npm audit and [Snyk](https://snyk.io) on every push
- **Static Analysis**: ESLint with security plugin to detect common vulnerabilities
- **Responsible Disclosure**: Follow the [Security Policy](SECURITY.md) to report vulnerabilities privately
- **Test Coverage**: Comprehensive test suite validates security-relevant code paths
- **Developer Knowledge**: Core team has expertise in secure software design and threat modeling

See [SECURITY.md](SECURITY.md) for details on the vulnerability reporting process and security practices.

## Primary Commands

| Command | What It Does | Use It When |
| --- | --- | --- |
| `switchboard "your prompt"` | Routes a single prompt, chooses target/effort, then launches or resumes Claude for that turn. | You want normal prompt-driven usage with routing applied automatically. |
| `switchboard --interactive` | Starts an interactive Claude session through Switchboard with route-aware session handling. | You want a live back-and-forth session instead of one-shot prompts. |
| `switchboard explain` | Shows the latest routing decision, reasoning signals, and correlated evidence for a thread. | You want to audit why a route was chosen or debug routing behavior. |
| `switchboard advise --surface openai-codex "your prompt"` | Returns an advisory routing recommendation for a selected surface without taking over execution. | You want a cross-surface recommendation or policy check before running a turn. |
| `switchboard probe continuity` | Runs a continuity probe for prompt-driven turns and reports whether session continuity checks pass. | You want to verify non-interactive continuity behavior after changes. |
| `switchboard probe continuity-interactive` | Runs the interactive continuity probe and verifies resume/session behavior across turns. | You want to validate interactive continuity and related checks. |
| `npm test` | Runs the full automated test suite for adapters, router, workflow, and CLI behavior. | You changed routing/workflow/docs and want a full regression check. |

### Typical First Run

1. Send one routed prompt:
   `switchboard "Implement the retry logic for stale session recovery."`
2. Inspect why the route was chosen:
   `switchboard explain`
3. Validate behavior before opening a PR:
   `npm test`

For detailed command documentation, environment variables, and output formats, see [CLI Reference](docs/CLI-REFERENCE.md).
