# Model Switchboard

[![npm version](https://img.shields.io/npm/v/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![npm downloads](https://img.shields.io/npm/dm/model-switchboard.svg)](https://www.npmjs.com/package/model-switchboard) [![CI](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/ci.yml) [![Release](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml/badge.svg)](https://github.com/hannasdev/model-switchboard/actions/workflows/release.yml) [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/hannasdev/model-switchboard/badge)](https://securityscorecards.dev/viewer/?uri=github.com/hannasdev/model-switchboard) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Model Switchboard is a routing layer for AI-assisted software delivery.

It keeps coding sessions moving by choosing model and effort settings before each turn, so you do not have to make that call manually every time.

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
4. Route context and hook evidence are recorded for explainability and governance.

## What It Is Not

- Not a replacement for your coding client.
- Not a general-purpose agent runtime.
- Not a cross-vendor orchestration product in this MVP phase.

## Primary Commands

- `switchboard "your prompt"`
- `switchboard --interactive`
- `switchboard explain`
- `switchboard probe continuity`
- `switchboard probe continuity-interactive`
- `npm test`

## Project Status

Version 1.0.0 is the first stable release of the prompt-driven Switchboard workflow for Claude Code.

Non-interactive continuity is verified for routed turns. Interactive continuity is verified for session reuse, resume semantics, hook correlation, and override handling, while stale-resume recovery and fail-closed error handling remain explicitly tracked as follow-up validation for fully supported interactive parity.

## Delivery Model

Feature branches, tagged releases, and npm publishing are now part of the delivery workflow.

See [CI/CD and Release Flow](docs/CI-CD.md).
