# Router Contracts (Experimental)

## Status

Contract version: `0.1.0-experimental`

Stability: provisional

This contract set is intentionally minimal and revision-friendly.

It is normative for current implementation work in this repository, but it is not yet declared stable for external package consumers. Fields may change as additional integration surfaces validate or falsify assumptions.

## Purpose

These contracts define the control-plane boundary for router decisions.

They are designed to keep core routing semantics vendor-neutral while allowing vendor-specific execution behavior to be mapped in appendices.

## Design Rules

1. Route execution targets, not abstract models.
2. Keep hard constraints separate from soft preferences.
3. Keep durable session mode separate from latest-turn task type.
4. Do not allow manual overrides to bypass hard constraints.
5. Capture enough evidence for explainability and replay.

## Phase Alignment Notes

This document is aligned to the current phase plan with these constraints:

1. Contract v0.1 stays minimal, provisional, and revision-friendly.
2. Handoff/context-transfer is represented in core contracts, not only vendor appendices.
3. Policy inputs include named hard and soft constraints, even where implementation depth is staged.
4. Explainability and outcome attribution are first-class before broader policy tuning work.
5. Multi-surface validation is conditional and should not force premature schema expansion.

## Deferred Commitments In v0.1

The following choices are intentionally not frozen in `0.1.0-experimental`.

1. Final task taxonomy and mode taxonomy.
Interim stance: keep enums practical for current scope and evolve via schema versioning.

2. Continuity-cost scoring precision.
Interim stance: categorical continuity cost is the default; numeric scoring is deferred.

3. Risk signal ownership.
Interim stance: allow optional risk fields and record provenance in logs when available.

4. Strict hard-constraint enforcement policy.
Interim stance: represent privacy, availability, and client compatibility in contracts now; stage enforcement depth.

5. Stable outcome attribution ontology.
Interim stance: minimal attribution labels first, expansion only after replay evidence validates usefulness.

6. Cross-surface contract freeze.
Interim stance: Claude mapping is evidence-backed but non-universal; core schemas remain revision-friendly.

## Normative Minimal Core

### 1) SessionState

```json
{
  "schemaVersion": "0.1.0-experimental",
  "sessionId": "string",
  "threadId": "string",
  "mode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain",
  "currentTargetId": "string|null",
  "turnCount": "number",
  "routingOverride": "auto|stronger|cheaper|stay",
  "riskLevel": "low|medium|high|null",
  "failureSignals": {
    "recentToolFailures": "number",
    "recentTestFailures": "number"
  },
  "updatedAt": "ISO-8601 timestamp"
}
```

Notes:

* `mode` is durable session phase.
* `routingOverride` is user preference input, not authority to bypass constraints.
* `riskLevel` and `failureSignals` are optional in early implementations.

### 2) TaskClassification

```json
{
  "schemaVersion": "0.1.0-experimental",
  "taskType": "string",
  "proposedMode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain",
  "confidence": "number",
  "reason": "string",
  "signals": ["string"]
}
```

Notes:

* `taskType` describes latest-turn work intent.
* `proposedMode` may differ from current session mode.

### 3) ExecutionTargetMetadata

```json
{
  "schemaVersion": "0.1.0-experimental",
  "id": "string",
  "label": "string",
  "targetClass": "cheap_fast|medium_reasoning|strong_reasoning|strong_coding",
  "provider": "string",
  "clientSurface": "string",
  "modelProfile": "string",
  "effortProfile": "string|null",
  "capabilities": ["string"],
  "constraints": {
    "availability": "available|degraded|unavailable",
    "privacyTier": "local|standard|restricted|unknown"
  }
}
```

Notes:

* Execution target is `model + provider + client surface + capability/constraint behavior`.
* `availability` and `privacyTier` can be coarse initially.

### 4) RoutingDecision

```json
{
  "schemaVersion": "0.1.0-experimental",
  "status": "ok|refused",
  "mode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain",
  "taskType": "string",
  "requiredCapabilities": ["string"],
  "hardConstraintResults": {
    "eligibleTargetIds": ["string"],
    "blocked": [
      {
        "targetId": "string",
        "missingCapabilities": ["string"],
        "constraintReasons": ["string"]
      }
    ]
  },
  "softConstraintInputs": {
    "userPreference": "auto|stronger|cheaper|stay|null",
    "projectOverride": "string|null"
  },
  "targetClass": "cheap_fast|medium_reasoning|strong_reasoning|strong_coding|null",
  "selectedTargetId": "string|null",
  "shouldSwitch": "boolean|null",
  "continuityCost": "low|medium|high|null",
  "continuityDecision": "stay_on_current_target|select_target_without_current_context|avoid_switch_due_to_continuity_cost|switch_target|no_selected_target|null",
  "continuityReason": "string|null",
  "routingOverride": {
    "requested": "auto|stronger|cheaper|stay",
    "applied": "boolean",
    "reason": "string|null"
  },
  "modeResolution": {
    "previousMode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain|null",
    "proposedMode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain",
    "resolvedMode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain",
    "transitionReason": "string"
  }|null,
  "policyInputs": {
    "hardConstraints": {
      "privacy": "enforced|advisory|off",
      "availability": "enforced|advisory|off",
      "clientCompatibility": "enforced|advisory|off",
      "requiredPrivacyTier": "external|local|standard|restricted|unknown|null",
      "clientSurface": "string|null"
    },
    "softConstraints": {
      "userPreference": "auto|stronger|cheaper|stay",
      "projectOverride": "string|object|null"
    }
  }|null,
  "explanation": "string",
  "refusalReason": "string|null"
}
```

Notes:

* `status=refused` requires `refusalReason` and no selected target.
* `shouldSwitch` and `continuityCost` may be `null` when status is refused.
* `softConstraintInputs` records preference inputs for explainability even when policy depth is staged.
* `routingOverride` matches current implementation output naming.
* `continuityDecision`, `continuityReason`, `modeResolution`, and `policyInputs` are currently emitted by the implementation and treated as additive experimental fields in `0.1.0-experimental`.

### 5) ContextPackage

```json
{
  "schemaVersion": "0.1.0-experimental",
  "sessionId": "string",
  "threadId": "string",
  "turnIndex": "number",
  "routeLabel": "string",
  "targetId": "string",
  "mode": "plan|implement|debug|review|summarize|agent_workflow|out_of_domain",
  "wrapperContext": "{ kind: string, text: string }|null",
  "handoffSummary": "string|null",
  "createdAt": "ISO-8601 timestamp"
}
```

Notes:

* This is the minimal handoff/context contract for current scope.
* `wrapperContext` maps to current structured wrapper context evidence (for example `kind` and `text`).
* `handoffSummary` may remain null until explicit handoff flows are implemented.

### 6) RouterConfig

```json
{
  "schemaVersion": "0.1.0-experimental",
  "routesByTaskType": {
    "<taskType>": "cheap_fast|medium_reasoning|strong_reasoning|strong_coding"
  },
  "routesByMode": {
    "plan": "medium_reasoning",
    "implement": "strong_coding",
    "debug": "strong_coding",
    "review": "medium_reasoning",
    "summarize": "cheap_fast",
    "agent_workflow": "medium_reasoning",
    "out_of_domain": "medium_reasoning"
  },
  "capabilityRequirements": {
    "<mode>": ["string"]
  },
  "hardConstraintInputs": {
    "privacy": "enforced|advisory|off",
    "availability": "enforced|advisory|off",
    "clientCompatibility": "enforced|advisory|off"
  },
  "softConstraintInputs": {
    "userPreferences": "enabled|disabled",
    "projectOverrides": "enabled|disabled"
  },
  "escalationRules": {
    "<signal>": "cheap_fast|medium_reasoning|strong_reasoning|strong_coding"
  },
  "continuityPolicy": {
    "switchThreshold": "low|medium|high"
  }
}
```

Notes:

* Keep this config deterministic and fixture-testable.
* Hard and soft constraint inputs should be named even when implementations are staged.
* Unknown fields should be ignored by default in early versions.

### 7) RoutingLogEvent (Milestone 4)

Normalized event emitted for every routing decision. This is the primary log format for explainability and replay.

```json
{
  "schemaVersion": "0.1.0-experimental",
  "ts": "ISO-8601 timestamp",
  "source": "switchboard_wrapper|adapter_anthropic|adapter_gemini|adapter_openai|gateway_X",
  
  "sessionId": "string",
  "threadId": "string",
  "turnIndex": "number",
  "userPrompt": "string|null",
  
  "sessionState": { ... },
  "routingDecision": { ... },
  "contextPackage": { ... },
  
  "outcome": {
    "executionStatus": "executed|failed|planned",
    "exitCode": "number|null",
    "errorSignal": "null|tool_failure|test_failure|execution_timeout|auth_failure|hook_correlation_miss|target_not_available|low_confidence_escalation|user_correction_needed",
    "durationMs": "number|null"
  },
  
  "attribution": {
    "decisionId": "string",
    "decisionConfidence": "number",
    "switchingReason": "null|continuity_cost|capability_gap|user_override|escalation|availability",
    "escalationApplied": "boolean",
    "policyVersion": "string"
  },
  
  "hookCorrelation": { "status": "matched|unmatched|unavailable", ... }|null,
  "wrapperContext": { "kind": "string", "text": "string" }|null,
  
  "legacy": { ... }|null
}
```

Notes:

* `schemaVersion` matches core contracts for consistency.
* `sessionState`, `routingDecision`, `contextPackage` are the canonical contract shapes (see sections 1, 4, 5).
* `outcome` captures execution results for replay and evaluation.
* `attribution` stores decision metadata for queryability and outcome attribution.
* `decisionId` is unique per decision (UUID or deterministic hash) for correlating with hooks and feedback.
* `policyVersion` tracks which policy made this decision (for policy comparison replay).
* `hookCorrelation` records whether this decision correlated with hook events (optional).
* `wrapperContext` is the user-facing context message (if available).
* `legacy` field is present for backward compatibility; new readers should prefer canonical shapes.

## Compatibility And Migration

1. Changes that alter meanings of existing fields require a schema version bump.
2. New optional fields can be added in the same experimental minor version.
3. Existing readers should ignore unknown fields.
4. Existing writers should not delete known fields without migration notes.

## Appendix A: Claude Mapping (Current Evidence)

This appendix maps the current Claude workflow to the core contracts without claiming that all clients behave this way.

### A.1 Session Mapping

Current workflow signals in the switchboard implementation map as follows:

* `threadId` -> `SessionState.threadId`
* persisted `claudeSessionId` -> `SessionState.sessionId`
* stored `turnCount` -> `SessionState.turnCount`
* current route mode -> `SessionState.mode`
* `routingOverride` -> `SessionState.routingOverride`

Current workflow persistence now records a contract-backed `sessionState` object alongside compatibility fields in route-context storage.

### A.2 Target Mapping

Current route labels map to target classes in the Claude integration:

* `quick` -> `cheap_fast`
* `balanced` -> `medium_reasoning`
* `best coder` -> `strong_coding`

Claude launch flags are an execution detail in the workflow layer and should not alter core contract semantics.

### A.3 Continuity Mapping

Current continuity semantics are:

* first routed turn uses `--session-id`
* subsequent routed turns use `--resume <session-id>`
* stale resume recovery may retry with a fresh `--session-id`

These semantics belong to workflow execution behavior, not router decision semantics.

Current workflow evidence now separates router-decision data from Claude execution data in wrapper logs while preserving continuity semantics and stale-resume recovery behavior.

### A.4 Hook Correlation Mapping

Current hook evidence maps to `RoutingLogEvent.correlation`:

* matched route context -> `routeContextMatched=true`
* unmatched route context -> `routeContextMatched=false`
* hook event identity -> `hookEventId`

Hook timing and correlation quality remain surface-specific and should not be treated as universal across clients.

Current route-context persistence also records a contract-backed `ContextPackage` and `claudeExecution` block so hook correlation can consume stable handoff fields without depending only on legacy flat fields.

### A.5 Outcome Attribution (Milestone 4)

Routed decisions are tracked with minimal outcome signals to support policy evaluation without a full telemetry infrastructure.

**Error Signals** (populated in `RoutingLogEvent.outcome.errorSignal`):

- `null` — execution succeeded
- `tool_failure` — tool call failed during execution
- `test_failure` — test run failed
- `execution_timeout` — execution did not complete in allowed time
- `auth_failure` — authentication/authorization failed (e.g., Claude auth)
- `hook_correlation_miss` — decision did not correlate with expected hook events
- `target_not_available` — selected target became unavailable after decision
- `low_confidence_escalation` — router escalated due to confidence < 0.7
- `user_correction_needed` — user had to correct or re-issue after decision

**Switching Reasons** (populated in `RoutingLogEvent.attribution.switchingReason`):

- `null` — no switch occurred (stayed on current target)
- `continuity_cost` — switched due to continuity cost evaluation
- `capability_gap` — switched because current target lacks required capability
- `user_override` — switched due to user preference override
- `escalation` — switched due to escalation policy (e.g., low confidence, repeated failure)
- `availability` — switched because current target became unavailable

### A.6 Replay And Policy Evaluation (Milestone 4)

The normalized event structure enables offline policy evaluation against stored evidence.

**Storage:**
- `~/.model-switchboard/switchboard-turns.ndjson` — normalized RoutingLogEvent records
- `~/.model-switchboard/attributions/{sessionId}.ndjson` — outcome attribution records (keyed by `decisionId`)

**Evaluation Functions:**
- `loadSessionEvidence(sessionId)` — load all events for a session
- `replayRoutingDecision(evidence, policyVersion)` — re-evaluate one decision under alternate policy
- `evaluatePolicyOnEvidence(evidenceSet, policyVersion)` — batch evaluation across all turns

## Appendix B: Open Questions

1. Should `riskLevel` be router-owned or adapter-provided in v0.2?
2. Should continuity cost remain categorical or evolve to a weighted score?
3. Which minimal handoff payload fields are required before adding multi-surface handoff support?
4. What is the smallest stable taxonomy for outcome attribution that is still useful for policy tuning?
