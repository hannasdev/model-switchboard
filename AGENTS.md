# AGENTS

This file is the fast navigation guide for humans and coding agents working in this repository.

Use it to find the right document for the scenario you are in, without reading the entire docs tree each time.

## Start Here

If you are not sure where to start, open [docs/PRD.md](docs/PRD.md).

## Scenario Guide

### I need product context, goals, and roadmap status

Read in this order:
1. [docs/PRD.md](docs/PRD.md)
2. [docs/product/PRODUCT-PRD.md](docs/product/PRODUCT-PRD.md)
3. [docs/product/MVP-PRD.md](docs/product/MVP-PRD.md)
4. [docs/product/ROUTER-PHASE-PLAN.md](docs/product/ROUTER-PHASE-PLAN.md)

### I am implementing or refactoring router behavior

Read in this order:
1. [docs/ARCHITECTURE-SPEC.md](docs/ARCHITECTURE-SPEC.md)
2. [docs/contracts/router-contracts.md](docs/contracts/router-contracts.md)
3. [docs/decision-log.md](docs/decision-log.md)

### I need milestone acceptance and execution details

Read in this order:
1. [docs/product/ROUTER-PHASE-PLAN.md](docs/product/ROUTER-PHASE-PLAN.md)
2. [docs/decision-log.md](docs/decision-log.md)
3. [docs/REPLAY-GUIDE.md](docs/REPLAY-GUIDE.md)

### I need security and risk context

Read in this order:
1. [SECURITY.md](SECURITY.md)
2. [docs/WRAPPER-THREAT-MODEL.md](docs/WRAPPER-THREAT-MODEL.md)

### I need release or delivery workflow context

Read in this order:
1. [docs/CI-CD.md](docs/CI-CD.md)
2. [docs/product/release-log.md](docs/product/release-log.md)
3. [CHANGELOG.md](CHANGELOG.md)

### I need historical or archived planning context

Read in this order:
1. [docs/archive/README.md](docs/archive/README.md)
2. Related archive docs under [docs/archive](docs/archive)

## Documentation Ownership Boundaries

Product docs live under [docs/product](docs/product).

Technical architecture and contracts live at:
1. [docs/ARCHITECTURE-SPEC.md](docs/ARCHITECTURE-SPEC.md)
2. [docs/contracts/router-contracts.md](docs/contracts/router-contracts.md)

Decision history lives in [docs/decision-log.md](docs/decision-log.md).

## Editing Rules For Future Updates

When moving or renaming docs:
1. Update links in [docs/PRD.md](docs/PRD.md)
2. Update links in this file, [AGENTS.md](AGENTS.md)
3. Run a repository-wide link/path search to catch stale references

When adding a new major doc:
1. Add it to the relevant scenario above
2. Keep scenario paths short and ordered by reading priority
