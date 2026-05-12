# Switchboard MVP Refactor Plan

## Purpose

Before this refactor, the MVP worked but still carried PoC-shaped paths:

* Product CLI code lived in `src/switchboard/`, but imported core workflow modules from `src/poc/`.
* Runtime state defaulted to `src/poc/logs`.
* Claude hook, route-context, session-store, and workflow modules were product-relevant but named and located as PoC code.

This refactor should make the MVP structure match the product boundary without changing behavior.

## Status

Completed in the current pass:

* Added `src/switchboard/paths.js` with shared product defaults under `~/.model-switchboard`.
* Moved Switchboard workflow, route-context, session-store, and Claude hook implementation into `src/switchboard`.
* Moved router implementation into `src/router/router.js`.
* Moved `claude-cli-launcher.js` into `src/switchboard/claude-cli-launcher.js`.
* Moved target registry data into `src/router/data/`.
* Removed the old `src/poc/*` harnesses and compatibility wrappers intentionally; the MVP surface is now the product `switchboard` command plus focused tests.
* Updated Claude hook settings to call `src/switchboard/claude-hook-bridge.js`.

All planned refactor steps are complete.

## Goals

1. Move product-facing Switchboard modules out of `src/poc`.
2. Remove old PoC commands and wrappers once their validation role is superseded.
3. Move default runtime state out of source-tree PoC logs.
4. Keep wrapper, hooks, and explain using one shared path/config model.
5. Preserve MVP behavior and focused tests.

## Non-Goals

* Do not publish `@model-switchboard/router`.
* Do not introduce cross-vendor product routing.
* Do not add a rich config system.
* Do not add interactive no-prompt `switchboard`.
* Do not redesign the routing policy.

## Proposed Target Structure

```text
bin/
  switchboard.js

src/
  router/
    router.js
    data/
      targets.anthropic.json
      targets.openai.json
      targets.gemini.json
  switchboard/
    cli.js
    workflow.js
    claude-cli-launcher.js
    claude-hook-bridge.js
    route-context.js
    session-store.js
    paths.js
```

The exact filenames can change, but the boundary should be:

* `src/router`: vendor-neutral or target-registry routing logic.
* `src/switchboard`: Claude Code wrapper workflow, CLI, hook bridge, route-context/session evidence.

## Runtime State Paths

Product defaults now write to a local app-state directory:

```text
~/.model-switchboard/
  switchboard-sessions.json
  switchboard-route-context.json
  switchboard-turns.ndjson
  claude-hook-events.ndjson
```

Tests should continue to inject temp paths. `bin/switchboard.js` should use product defaults.

## Refactor Steps

1. Add `src/switchboard/paths.js`.
   * Export default product paths.
   * Keep path overrides injectable for tests.

2. Move route context and session store.
   * Moved `src/poc/switchboard_route-context.js` to `src/switchboard/route-context.js`.
   * Moved `src/poc/thread_session-store.js` to `src/switchboard/session-store.js`.
   * Update imports.

3. Move Claude workflow modules.
   * Moved `src/poc/switchboard_workflow.js` to `src/switchboard/workflow.js`.
   * Moved `src/poc/claude-cli-launcher.js` to `src/switchboard/claude-cli-launcher.js`.
   * Moved `src/poc/claude-hook-bridge.js` to `src/switchboard/claude-hook-bridge.js`.
   * Updated Claude hook settings to point at the product hook bridge.

4. Move or re-export router core.
   * Moved `src/poc/router.js` to `src/router/router.js`.
   * Moved target data into `src/router/data/`.

5. Update tests.
   * Product tests should import product paths.
   * Remove tests for deleted PoC-only harnesses.
   * Keep all temp-path injection.

6. Update docs.
   * Update `docs/POC-IMPLEMENTATION.md` paths.
   * Update this plan or mark it complete.

## Acceptance Criteria

* `bin/switchboard.js` imports only product modules under `src/switchboard`.
* Product runtime defaults no longer point at `src/poc/logs`.
* Removed PoC npm scripts are no longer documented as active commands.
* `switchboard --dry-run "Implement the plan."` still produces compact route output.
* `switchboard explain` still summarizes latest evidence.
* Claude hook settings point at `src/switchboard/claude-hook-bridge.js`.
* `npm test` passes.
* `git diff --check` passes.

## Suggested Verification Commands

```bash
node bin/switchboard.js --dry-run --thread-id refactor-smoke "Implement the plan."
node bin/switchboard.js explain --thread-id refactor-smoke
node --test test/switchboard-cli.test.js
node --test test/switchboard-workflow.test.js
node --test test/claude-hook-bridge.test.js
npm test
```

Live verification can be repeated after structural cleanup:

```bash
node bin/switchboard.js --thread-id refactor-live --no-tools "Reply exactly SWITCHBOARD_OK."
node bin/switchboard.js --thread-id refactor-live --no-tools "What exact token did I ask you to reply with in the previous turn? Reply with only that token."
node bin/switchboard.js explain --thread-id refactor-live
```
