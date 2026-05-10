# Switchboard MVP Refactor Plan

## Purpose

The MVP now works, but the implementation still carries PoC-shaped paths:

* Product CLI code lives in `src/switchboard/`, but imports core workflow modules from `src/poc/`.
* Runtime state defaults to `src/poc/logs`.
* Claude hook, route-context, session-store, and workflow modules are product-relevant but named and located as PoC code.

This refactor should make the MVP structure match the product boundary without changing behavior.

## Status

Completed in the current pass:

* Added `src/switchboard/paths.js` with shared product defaults under `~/.model-switchboard`.
* Moved Switchboard workflow, route-context, session-store, and Claude hook implementation into `src/switchboard`.
* Moved router implementation into `src/router/router.js`.
* Moved `claude_cli_launcher.js` into `src/switchboard/claude_cli_launcher.js`.
* Moved target registry data into `src/router/data/`.
* Kept `src/poc/*` compatibility wrappers so existing PoC commands still resolve their legacy `src/poc/logs` defaults.

All planned refactor steps are complete.

## Goals

1. Move product-facing Switchboard modules out of `src/poc`.
2. Keep PoC commands working by making them call the product modules.
3. Move default runtime state out of source-tree PoC logs.
4. Keep wrapper, hooks, and explain using one shared path/config model.
5. Preserve all existing behavior and tests.

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
    claude_cli_launcher.js
    claude_hook_bridge.js
    route_context.js
    session_store.js
    paths.js
  poc/
    cli.js
    switchboard_cli.js
    ...
```

The exact filenames can change, but the boundary should be:

* `src/router`: vendor-neutral or target-registry routing logic.
* `src/switchboard`: Claude Code wrapper workflow, CLI, hook bridge, route-context/session evidence.
* `src/poc`: old harnesses, compatibility commands, and experiments.

## Runtime State Paths

The current defaults write to `src/poc/logs`. The product path should move to a local app-state directory.

Suggested default:

```text
~/.model-switchboard/
  switchboard-sessions.json
  switchboard-route-context.json
  switchboard-turns.ndjson
  claude-hook-events.ndjson
```

Tests should continue to inject temp paths. PoC commands may keep explicit PoC paths if useful, but `bin/switchboard.js` should use product defaults.

## Refactor Steps

1. Add `src/switchboard/paths.js`.
   * Export default product paths.
   * Keep path overrides injectable for tests.

2. Move route context and session store.
   * Move `src/poc/switchboard_route_context.js` to `src/switchboard/route_context.js`.
   * Move `src/poc/thread_session_store.js` to `src/switchboard/session_store.js`.
   * Update imports.

3. Move Claude workflow modules.
   * Move `src/poc/switchboard_workflow.js` to `src/switchboard/workflow.js`.
   * Move `src/poc/claude_cli_launcher.js` to `src/switchboard/claude_cli_launcher.js`.
   * Move `src/poc/claude_hook_bridge.js` to `src/switchboard/claude_hook_bridge.js`.
   * Keep old PoC files as thin re-export wrappers if that minimizes churn.

4. Move or re-export router core.
   * Prefer moving `src/poc/router.js` to `src/router/router.js`.
   * Keep `src/poc/router.js` as a re-export wrapper for existing PoC imports.
   * Move target data only if it does not create too much churn in one pass.

5. Update tests.
   * Product tests should import product paths.
   * PoC tests can keep PoC compatibility imports if wrappers remain.
   * Keep all temp-path injection.

6. Update docs.
   * Update `docs/POC-IMPLEMENTATION.md` paths.
   * Update this plan or mark it complete.

## Acceptance Criteria

* `bin/switchboard.js` imports only product modules under `src/switchboard`.
* Product runtime defaults no longer point at `src/poc/logs`.
* PoC npm scripts still work.
* `switchboard --dry-run "Implement the plan."` still produces compact route output.
* `switchboard explain` still summarizes latest evidence.
* `npm test` passes.
* `git diff --check` passes.

## Suggested Verification Commands

```bash
node bin/switchboard.js --dry-run --thread-id refactor-smoke "Implement the plan."
node bin/switchboard.js explain --thread-id refactor-smoke
node --test test/switchboard-cli.test.js
node --test test/poc-switchboard-workflow.test.js
node --test test/poc-claude-hook-bridge.test.js
npm test
```

Live verification can be repeated after structural cleanup:

```bash
node bin/switchboard.js --thread-id refactor-live --no-tools "Reply exactly SWITCHBOARD_OK."
node bin/switchboard.js --thread-id refactor-live --no-tools "What exact token did I ask you to reply with in the previous turn? Reply with only that token."
node bin/switchboard.js explain --thread-id refactor-live
```
