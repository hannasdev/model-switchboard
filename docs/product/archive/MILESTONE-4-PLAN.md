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
- One NDJSON file per session in `~/.model-switchboard/attributions/{sessionId}.ndjson`
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