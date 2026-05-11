# Milestone 4: Explainability and Outcome Attribution Foundation

**Status:** Complete (2026-05-11)

**Objective:** Complete the observability and replay foundation so routed decisions can be inspected, explained, and evaluated offline without reading implementation details.

## Problem Statement

Currently, after a routing decision is made and Claude executes it, there is no structured way to:

1. Understand *why* that specific target was chosen (constraint analysis is buried in evidence)
2. Query whether the decision was correct post-hoc (no outcome attribution)
3. Evaluate a new policy against historical decisions (no replay infrastructure)
4. Categorize decision failures (no outcome taxonomy)

This limits our ability to debug routing issues, validate policy changes, and tune the router based on evidence.

Milestone 4 closes these gaps by normalizing logs into queryable contract-backed events, adding outcome attribution, enhancing explain output with decision rationale, and enabling offline policy evaluation against fixtures.

## Scope

### 1. Routing Log Event Normalization

**Current:** Evidence objects with mixed contract shapes, legacy fields, and raw decision metadata.

**Target:** Normalized `RoutingLogEvent` that is:
- Schema-versioned (matches contract pattern)
- Queryable (all decision inputs and outputs at top level)
- Attributable (includes confidence, decision ID, policy version)
- Replay-ready (contains all state needed to re-evaluate the decision)

**Structure:**

```typescript
interface RoutingLogEvent {
  schemaVersion: "0.1.0-experimental"
  ts: string  // ISO timestamp
  source: "switchboard_wrapper" | "adapter_X"
  
  // Canonical contract shapes from M3
  sessionState: SessionState
  routingDecision: RoutingDecision
  contextPackage: ContextPackage
  
  // Execution outcome (new)
  outcome: {
    executionStatus: "executed" | "failed" | "planned"
    exitCode: number | null
    errorSignal: string | null  // "tool_failure" | "test_failure" | etc
    durationMs: number | null
  }
  
  // Attribution and queryability (new)
  attribution: {
    decisionId: string  // UUID or deterministic hash
    decisionConfidence: number  // 0.0..1.0
    switchingReason: string | null  // null | "continuity_cost" | "capability_gap" | ...
    escalationApplied: boolean
    policyVersion: string  // e.g. "0.1.0" or git SHA
  }
  
  // Optional: hook correlation and wrapper context
  hookCorrelation: any | null
  wrapperContext: any | null
  
  // Backward compat: legacy field derivation if needed
  legacy: any | null
}
```

**Implementation:**
- Add `RoutingLogEvent` type to `docs/contracts/router-contracts.md`
- Modify `workflow.js` to construct normalized event in `buildSwitchboardTurn()`
- Update `appendLog()` to emit RoutingLogEvent shape
- Add schema validation test

**Acceptance:** All logs emit normalized RoutingLogEvent; existing tests still pass.

### 2. Attribution and Outcome Taxonomy

**Current:** No structured way to record whether a decision was correct.

**Target:** Post-hoc decision quality tracking with minimal taxonomy.

**Attribution Record Structure:**

```typescript
interface DecisionAttribution {
  decisionId: string
  sessionId: string
  threadId: string
  turnIndex: number
  ts: string
  
  // Decision metadata
  selectedTargetId: string
  selectedTargetLabel: string
  selectedTargetClass: string
  
  // Outcome (filled in later by feedback loop or metrics)
  executionStatus: "executed" | "failed" | "not_run"
  failureSignal: string | null  // See taxonomy below
  successSignal: string | null  // "completed_on_first_try" | "required_escalation" | ...
  userFeedback: any | null  // Future: collected feedback
  
  // Metadata for grouping/filtering
  policyVersion: string
  confidence: number
  switchingReason: string | null
  
  // For join with logs
  logEventTs: string
}
```

**Outcome Taxonomy (minimal):**

```typescript
enum FailureSignal {
  null = "success",
  TOOL_FAILURE = "tool_failure",  // Tool call failed
  TEST_FAILURE = "test_failure",  // Test run failed
  EXECUTION_TIMEOUT = "execution_timeout",
  AUTH_FAILURE = "auth_failure",  // Claude auth failed
  HOOK_MISS = "hook_correlation_miss",
  TARGET_UNAVAILABLE = "target_not_available",
  LOW_CONFIDENCE = "low_confidence_escalation",
  USER_CORRECTION = "user_correction_needed"
}

enum SuccessSignal {
  FIRST_TRY = "completed_on_first_try",
  REQUIRED_ESCALATION = "required_escalation_but_succeeded",
  FALLBACK_ACCEPTABLE = "fallback_acceptable",
  CONTINUITY_PRESERVED = "continuity_preserved"
}
```

**Storage:**
- New file: `src/switchboard/attribution_store.js`
- One NDJSON file per session in `~/.switchboard/attributions/{sessionId}.ndjson`
- Key by `decisionId` for post-hoc updates

**Implementation:**
- Generate `decisionId` in `buildSwitchboardTurn()` (deterministic: hash of sessionId + threadId + turnCount)
- Add `attribution` object to RoutingLogEvent
- Create `saveAttribution()` function
- Add outcome taxonomy constants
- Tests for attribution generation

**Acceptance:** Decisions can be tracked post-hoc; 73+ tests passing.

### 3. Enhanced Explain Output with Reasoning

**Current:** `explainLatestSwitchboardTurn()` returns evidence blocks; user must infer decision logic.

**Target:** Structured reasoning reconstruction that shows constraint evaluation.

**Enhanced Explain Shape:**

```typescript
interface ExplainOutput {
  // Existing fields...
  status: "found" | "missing"
  threadId: string | null
  routerEvidence: { ... }
  claudeEvidence: { ... }
  
  // NEW: Decision reasoning (reconstructed from evidence)
  reasoning: {
    taskType: string | null
    modeResolution: {
      input: string
      resolvedMode: string
      reasoning: string
    } | null
    
    requiredCapabilities: string[]
    
    hardConstraintEvaluation: {
      privacy: {
        applied: boolean
        reason: string
        blockedTargets: string[]
      }
      availability: {
        applied: boolean
        reason: string
        blockedTargets: string[]
      }
      clientCompatibility: {
        applied: boolean
        reason: string
        blockedTargets: string[]
      }
    }
    
    softConstraintEvaluation: {
      userPreference: string | null
      projectOverride: string | null
      impact: string  // "influenced_choice" | "no_eligible_higher_class" | ...
    }
    
    continuityCost: {
      calculated: "low" | "medium" | "high"
      decision: "stay" | "switch" | "no_eligible_current"
      reason: string
      costImpactOnChoice: boolean
    }
    
    selectedTargetRationale: string  // Summary of why this target
    confidence: number  // 0.0..1.0
  }
  
  // Existing fields...
  routeContext: { ... }
  hookEvents: { ... }
}
```

**CLI Output Example:**

```
Switchboard: plan → implement (mode_transition)
Thread: thread-1
Claude session: session-123
Claude target: sonnet / high

Router route: best coder (implement)
Router status: ok

Decision Reasoning:
  Task type: code_implementation
  Required capabilities: file_edit, file_read, repo_context
  Constraints:
    - Privacy: standard (no blocks)
    - Availability: all targets available
  Continuity: stay_on_anthropic_coder (low_cost)
  Confidence: 0.95
  Rationale: "Selected best_coder because task is implementation, 
             privacy constraints satisfied, low switch cost"

Route context: matched
Hook events: 2
```

**Implementation:**
- Extract reasoning from `routerEvidence.routingDecision` fields
- Create `reconstructReasoning()` function in `workflow.js`
- Modify `explainLatestSwitchboardTurn()` to include reasoning
- Update `printHumanExplain()` in `cli.js` to show rationale
- Tests for reasoning reconstruction

**Acceptance:** Users can understand *why* without reading code; 73+ tests passing.

### 4. Replay Infrastructure for Policy Evaluation

**Current:** No way to test if a new policy would have made different decisions on past evidence.

**Target:** Offline policy evaluation using stored session evidence.

**New Functions:**

```typescript
// Load evidence for a session
function loadSessionEvidence(sessionId: string): RoutingLogEvent[]

// Evaluate one decision under a different policy
function replayRoutingDecision(
  evidence: RoutingLogEvent,
  policy?: RoutingPolicy
): {
  original: RoutingDecision
  replayed: RoutingDecision
  matches: boolean
  differences: string[]
  confidence: number
}

// Batch evaluate all decisions in a session against current policy
function evaluateSessionPolicy(
  sessionId: string,
  policy?: RoutingPolicy
): {
  sessionId: string
  matchRate: number  // 0.0..1.0
  regressions: DecisionComparison[]
  improvements: DecisionComparison[]
  policyCoverage: string[]  // Modes/task types covered
  summary: string
}

// Compare two policies on a set of evidence
function comparePolicies(
  evidence: RoutingLogEvent[],
  policyA: RoutingPolicy,
  policyB: RoutingPolicy
): PolicyComparison
```

**Fixtures:** 
- `test/fixtures/sessions/` — recorded evidence from real turns
- `test/fixtures/policies/` — named policy configurations for comparison
- `test/fixtures/targets/` — target sets for replay

**Implementation:**
- Add `loadSessionEvidence()` to workflow.js
- Add `replayRoutingDecision()` to workflow.js
- Create fixtures directory structure
- Add integration tests comparing policies
- Document replay pattern in docs

**Acceptance:** Can replay old decisions with new policy; 73+ tests passing.

### 5. Contract Update and Documentation

**Updates to `docs/contracts/router-contracts.md`:**
- Document `RoutingLogEvent` as new normalized shape
- Explain attribution and decisionId usage
- Add outcome taxonomy enum
- Show replay example

**New file: `docs/REPLAY-GUIDE.md`**
- How to capture session evidence
- How to evaluate a policy against past sessions
- How to interpret comparison results
- Example: "Policy tuning workflow"

**Implementation:**
- Update contracts.md with 3 new appendix sections
- Create REPLAY-GUIDE.md with examples
- Update ROUTER-PHASE-PLAN.md to mark M4 complete

**Acceptance:** Documented; examples work; team can use replay pattern.

## Build Order (Phases)

### Phase 1: Foundation (1-2 days)
1. Add `RoutingLogEvent` schema to contracts.md
2. Implement event normalization in `workflow.js`
3. Add outcome taxonomy constants
4. Update test fixtures
5. **Gate:** All logs emit normalized events; 73+ tests pass

### Phase 2: Attribution (1 day)
6. Implement `attribution_store.js` (save/load)
7. Generate `decisionId` in `buildSwitchboardTurn()`
8. Populate `attribution` in RoutingLogEvent
9. Add attribution tests
10. **Gate:** Decisions are attributable; attribution queries work

### Phase 3: Explain Enhancement (1-2 days)
11. Extract reasoning from evidence
12. Implement `reconstructReasoning()` function
13. Extend `explainLatestSwitchboardTurn()` return shape
14. Update `printHumanExplain()` in CLI
15. Add explain tests
16. **Gate:** Reasoning visible in explain output; tests pass

### Phase 4: Replay (1-2 days)
17. Implement replay functions
18. Create test fixtures (sessions, policies)
19. Add replay evaluation tests
20. Document replay pattern
21. **Gate:** Can replay decisions; policy comparison works

### Phase 5: Documentation & Closeout (1 day)
22. Update contracts.md appendices
23. Create REPLAY-GUIDE.md
24. Update ROUTER-PHASE-PLAN.md
25. Add M4 decision record
26. Add release notes
27. **Gate:** All 73+ tests pass; CI green; docs complete

## Acceptance Criteria

- [ ] All logs emit `RoutingLogEvent` with `schemaVersion: "0.1.0-experimental"`
- [ ] Attribution records store `decisionId`, `confidence`, `switchingReason`, `policyVersion`
- [ ] `explain` command shows "Decision Reasoning" section
- [ ] `replayRoutingDecision()` can evaluate past evidence against current policy
- [ ] Outcome taxonomy covers all error/success paths in codebase
- [ ] 73+ tests still passing; no regressions
- [ ] All 7 CI checks passing (CodeQL, Fuzz, Node 22/24)
- [ ] Contracts updated with RoutingLogEvent and outcome enum
- [ ] REPLAY-GUIDE.md documents the pattern with working examples

## Known Deferred

The following items are intentionally deferred to Milestone 5 or later:

- User feedback collection and storage (future: decision quality signals)
- Learned/adaptive routing based on outcome patterns
- Advanced replay tooling (A/B testing frameworks, policy optimization)
- Multi-surface coordination (only after second surface is validated in M5)
- Production observability dashboards
- Outcome-based SLO tracking

## Success Signals

After M4 is complete:

1. **Post-hoc inspection:** Any routed turn can be examined to understand why that decision was made, without reading code or asking humans.
2. **Policy evaluation:** A new policy can be tested against stored evidence to see if it would have made better or worse decisions.
3. **Replay foundation:** The evidence is structured so that evaluation can be done offline, without live Claude runs.
4. **Team clarity:** The outcome taxonomy is minimal but covers the key failure modes we care about.
5. **Ready for M5:** When the second surface is integrated, all decisions will be logged in the same normalized format, enabling comparison.

## Next Steps After M4

- **M5:** Second Surface Proof (validate router boundary reuse)
- **M6+:** Learned routing, policy optimization, multi-surface coordination

---

**Decision Gate for M5:**
M5 only proceeds if M4 shows:
- Stable contract shapes (no breaking changes)
- Explainability foundation (decisions are understandable)
- Replay infrastructure (policies are testable)
- No unresolved regressions in M1-M4

If the gate is not met, M5 is deferred and M4 work is refined.
