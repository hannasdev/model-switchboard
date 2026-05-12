# Refactoring Plan

Findings from the May 2026 architecture review. Work on these one at a time. Mark items as **Done** when complete.

---

## 1. Unify target mappings — LOW effort / HIGH value

**Problem:** Two parallel, unconnected mapping structures had to be kept in sync manually.

- `src/adapters/model_mappings.js` — `targetId → profile → model` (used by SDK adapters)
- `src/adapters/model_mappings.js` — `TARGET_TO_CLAUDE_CLI` (`targetId → { model, effort }`) (used by CLI path)

Adding or renaming a target required updates in both places with no guardrail.

**Status:** Done

---

## 2. Extract shared fs-utils — LOW effort

**Problem:** `session_store.js` and `route_context.js` each define nearly identical private helpers:

```js
function ensureFile(storePath) { ... }
function readStore(storePath) { ... }
function writeStore(storePath, data) { ... }
```

Divergence risk: if one is fixed, the other silently stays broken.

**Status:** Done

---

## 3. Hard-code `ANTHROPIC_TARGETS_PATH` in one place — LOW effort

**Problem:** The same path was independently resolved in two files:

```js
// now centralized in src/switchboard/paths.js
export const ANTHROPIC_TARGETS_PATH = path.join(__dirname, "..", "router", "data", "targets.anthropic.json");
```

**Status:** Done

---

## 4. Extract `explain` command from `workflow.js` — MEDIUM effort

**Problem:** `workflow.js` handles session loading, routing coordination, log writing, context-package building, attribution construction, serialization helpers, the `explain` command, and continuity probes. It is both orchestrator and utility module.

The `explain` command is conceptually separate — it reads past logs rather than driving a new turn — so it's the most obvious thing to split out.

**Fix:** Create `src/switchboard/explain.js` that owns `explainLatestSwitchboardTurn`, `reconstructReasoning`, and related read-only log helpers. Import from `workflow.js` if needed, then remove the implementation there.

**Status:** Not started

---

## 5. Separate prompt classifier from router — MEDIUM effort

**Problem:** `router.js` mixes two distinct concerns:

- `classifyPrompt` — keyword-matching heuristics that produce `taskType` / `proposedMode` signals
- `routePrompt` — policy evaluation, hard/soft constraints, continuity cost, target selection

The classifier produces signals; the router consumes them. They have different change rates and different test surfaces.

**Fix:** Extract `classifyPrompt` (and its supporting constants like `TASK_TYPE_TO_ADDITIONAL_REQUIREMENTS`) into `src/router/classifier.js`. Keep `router.js` as the policy engine that imports from the classifier.

**Status:** Not started

---

## 6. Remove or promote `extractTurnFields` — LOW effort

**Problem:** `route_context.js` had a function named `deriveLegacyTurnFields`. The "legacy" label signaled it had been kept alive longer than intended and imposed a cognitive tax on every reader.

**Status:** Done

---

## 7. Align file naming convention — LOW effort

**Problem:** Source files use `snake_case` (`anthropic_claude_adapter.js`, `session_store.js`); test files use `kebab-case` (`claude-cli-launcher.test.js`, `thread-session-store.test.js`). Pairing a source file with its test requires a mental translation step.

**Fix:** Decide on one convention (kebab-case is more common in the JS ecosystem) and rename files accordingly. Update all imports.

**Status:** Not started

---

## Order of execution

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | Unify target mappings | Low | Do first — prevents divergence bugs |
| 2 | Shared fs-utils | Low | Quick win, reduces duplication |
| 3 | Paths constant | Low | Quick win, no logic changes |
| 6 | Legacy field | Low | Audit first to confirm safe to delete |
| 4 | Extract explain | Medium | Biggest readability gain in workflow.js |
| 5 | Separate classifier | Medium | Makes router independently testable |
| 7 | File naming | Low | Do last — touches many files at once |
