# Session-Aware AI Router Architecture Spec

## Purpose

This document is the technical architecture and design reference for the Session-Aware AI Router.

It covers architecture, integration strategy, contracts, routing policy flow, context transfer, configuration precedence, privacy boundaries, observability, and design decisions.

For product-level framing and roadmap priorities, see [product/PRODUCT-PRD.md](product/PRODUCT-PRD.md).

## Status Snapshot

Milestone 4 is complete and the repository now has a contract-backed explainability and outcome-attribution foundation. The execution plan, decision log, release log, and replay guide are updated to reflect that state. Recent boundary-hardening refactors have extracted explain and prompt-classifier concerns into dedicated modules, reducing policy-layer coupling.

Milestone 5 validation is now underway with an advisory second-surface proof. The advisory path returns contract-backed routing decisions for non-Claude surfaces and is being verified for cross-surface consistency across OpenAI Codex, Google Gemini, and Claude surface identifiers.

## 7. Architecture

```text
User Surface / Client
  ↓
Client Adapter
  ↓
Router Control Plane
  ├─ Session Controller
  ├─ Task Classifier
  ├─ Routing Policy
  ├─ Execution Target Registry
  ├─ Handoff / Context Contract
  └─ Routing Logs
  ↓
Execution Surface
  ↓
Model Provider / Gateway / Agent Runtime
```

### 7.1 User Surface / Client

The user surface is where the user interacts with AI.

Examples:

* Codex CLI.
* Claude Code.
* GitHub Copilot Chat.
* Cursor.
* OpenClaw.
* A custom CLI.
* An IDE plugin.

The router should not assume it owns the user UI. Some clients may allow deep integration; others may only allow advisory or sidecar integration.

### 7.2 Client Adapter

A client adapter normalizes requests from a client into the router’s internal format.

Responsibilities:

* Attach session ID and metadata.
* Provide recent conversation or session summary if available.
* Provide available execution targets.
* Provide declared tool/capability metadata if available.
* Return the routing decision or selected target to the client.

The adapter is replaceable. Supporting a new client should not require changing the session controller or routing policy.

### 7.3 Router Control Plane

The router control plane owns routing decisions.

It maintains the current work mode:

* `clarify`
* `plan`
* `implement`
* `debug`
* `review`
* `summarize`
* `document`
* `agent_workflow`

It also tracks approval state, risk, continuity cost, user corrections, manual escalation, known failures, and current target class.

### 7.4 Execution Surface

The execution surface is the actual environment where work happens.

Examples:

* A CLI agent with repo access.
* An IDE chat with file-context access.
* A hosted coding agent.
* A gateway-backed API call.
* A local model with no tool access.

The router should not assume the same underlying model has the same capabilities across execution surfaces.

## 8. Integration Strategy

There is no single universal insertion point across AI coding tools. The router should support multiple integration patterns over time, but the MVP should target one controllable path.

### 8.1 Primary Integration: CLI or Orchestrator-Native

Best MVP path.

Examples:

* Custom CLI wrapper.
* Claude Code wrapper.
* OpenClaw integration.
* Local orchestrator.

Benefits:

* Strongest control over session state.
* Easier to inspect and debug.
* Fewer vendor-specific UI constraints.
* Natural fit for routing commands and local state.

### 8.2 Proxy / Gateway Integration

Useful where the client supports configurable base URLs, providers, or OpenAI-compatible endpoints.

Examples:

* Codex CLI custom provider.
* Claude Code through approved proxy configuration.
* OpenAI-compatible clients.

Limitations:

* The router may not see all session state.
* Tool availability may differ through a proxy.
* Provider-specific behavior can leak through.
* Privacy and permission constraints must still be enforced by the client/tooling layer.

### 8.3 Advisory Sidecar Integration

Useful where the client owns the UI and runtime.

Examples:

* Copilot Chat.
* Vendor IDE extensions.
* Tools that do not expose a stable routing hook.

In advisory mode, the router may not select the model directly. It can still provide:

* Recommended target class.
* Handoff package.
* Project/session state.
* Routing explanation.
* Suggested manual escalation.
* Config generation.

## 9. Core Contracts

The detailed data structures should live in the companion document **Router Contracts**, committed at:

```text
docs/contracts/router-contracts.md
```

The main design document treats these contracts conceptually. Implementations should use the contract document as the canonical source for exact fields, schema versions, examples, and persisted shapes.

Implementation requirement:

```text
Do not begin implementation against this PRD unless the companion Router Contracts document exists in the repository, or this PRD includes a temporary normative schema appendix.
```

If the companion contract file is missing, the PRD is incomplete for implementation purposes.

Core contracts:

* `SessionState`
* `TaskClassification`
* `ExecutionTargetMetadata`
* `RoutingDecision`
* `ContextPackage`
* `RoutingPolicy`
* `RouterConfig`
* `RoutingLogEvent`

The most important contract distinction is this:

```text
The router routes execution targets, not abstract models.
```

An execution target is the combination of:

```text
model + provider + client surface + tool availability + permissions + privacy tier + context behavior
```

This distinction matters because the same underlying model may behave very differently in a browser chat, a CLI coding agent, a proxy-backed API call, or an IDE extension.

## 10. Routing Logic

Routing should follow this order:

```text
1. Read current session state.
2. Classify the latest user turn in session context.
3. Propose or update session mode.
4. Derive required capabilities.
5. Filter execution targets by hard constraints.
6. Apply safety/risk escalation.
7. Apply manual override if valid.
8. Apply project overrides and global preferences.
9. Apply cost and latency preferences.
10. Decide whether switching is worth the continuity cost.
11. Return selected target or routing refusal.
```

Hard constraints should be applied before preferences.

Hard constraints include:

* Required capabilities.
* Declared privacy/data-boundary policy.
* Target availability.
* Client/tool-surface compatibility.

Manual override should not bypass hard constraints. A user may escalate to a stronger target class, but the router should still refuse targets that cannot perform the required work or violate declared policy.

### 10.1 Mode and Task-Type Resolution

Modes and task types are separate dimensions.

```text
Mode = durable session phase.
Task type = latest-turn work classification.
```

The mode describes where the conversation currently is in the software-delivery workflow: planning, implementing, debugging, reviewing, summarizing, or managing agent workflow.

The task type describes what the latest turn appears to ask for: `multi_file_refactor`, `failing_tests`, `code_review`, `architecture_decision`, and so on.

Resolution should be deterministic:

```text
1. Classify the latest turn into a task type.
2. Propose a mode transition if the task implies one.
3. Let the session controller accept or reject the mode transition.
4. Derive baseline capabilities from the resolved mode.
5. Add task-specific capabilities where needed.
6. Choose route by task type if configured.
7. Fall back to the resolved mode route if no task-specific route exists.
```

Example:

```text
Latest user turn: /implement
Previous mode: plan
Task type: multi_file_refactor
Proposed mode: implement
Resolved mode: implement
Route lookup: multi_file_refactor → strong_coding
Capability baseline: implement capabilities
Task additions: none
```

If task type and mode disagree, the session controller should prefer preserving the current mode unless the user has issued an explicit command or the task clearly requires transition.

### 10.2 Basic Route Defaults

```yaml
routes:
  simple_explanation: cheap_fast
  project_discussion: medium_reasoning
  discuss_user_value: medium_reasoning
  compare_tradeoffs: strong_reasoning
  architecture_decision: strong_reasoning
  single_file_edit: strong_coding
  multi_file_refactor: strong_coding
  test_generation: strong_coding
  failing_tests: strong_coding
  code_review: medium_reasoning
  documentation: medium_reasoning
  handoff_summary: cheap_fast
  agent_workflow: medium_reasoning
  out_of_domain: medium_reasoning
```

### 10.3 Required Capability Examples

```yaml
capability_requirements:
  plan:
    required:
      - chat
      - reasoning
      - structured_output

  implement:
    required:
      - repo_context
      - file_read
      - file_edit
      - code_generation

  debug:
    required:
      - repo_context
      - file_read
      - shell_execution
      - test_execution
      - code_generation

  review:
    required:
      - repo_context
      - file_read
      - reasoning
      - structured_output

  summarize:
    required:
      - chat
      - structured_output
```

If no eligible execution target satisfies the required capabilities, the router should fail clearly rather than allowing an under-equipped target to attempt the task.

Possible alternatives:

* Stay in planning mode.
* Ask the user to enable a capable target.
* Suggest a different client surface.
* Offer a lower-capability workflow.

### 10.4 Escalation Rules

```yaml
escalation:
  low_classifier_confidence: strong_reasoning
  user_corrected_assumption: strong_reasoning
  repeated_test_failure: strong_coding
  high_risk_implementation: strong_coding
  cheap_target_failed: medium_reasoning
```

Manual escalation commands should be supported:

```text
/escalate
/stronger
/use strong_reasoning
/use strong_coding
/auto
```

The default override target should be a target class, not a concrete provider model. Concrete target overrides may be useful for advanced debugging or benchmarking, but they are not the primary user interface.

When multiple escalation triggers fire in the same turn, the router should resolve them deterministically. MVP behavior should use priority order, not weighted scoring.

Escalation priority:

```text
1. Capability miss or unavailable target.
2. Privacy or declared policy violation.
3. High-risk implementation.
4. Repeated test failure.
5. User corrected an assumption.
6. Low classifier confidence.
7. Cheap target failed.
```

The highest-priority active trigger wins. If the winning trigger maps to a target class with no eligible execution target, the router should fail clearly or propose an eligible alternative. It should not silently fall back to an incapable target.

If two triggers share the same priority, choose the more capable target class. For MVP purposes:

```text
strong_coding > strong_reasoning > medium_reasoning > cheap_fast
```

### 10.5 Continuity Rules

Switching targets has a cost.

Avoid switching when:

* The current target is capable enough.
* The current target has useful session context.
* The expected gain from switching is small.
* The task is mid-implementation and the current target is not failing.
* The user is responding to a proposal made by the current target.

Prefer switching when:

* The current target lacks required capabilities.
* The user explicitly escalates.
* The user corrects a bad assumption.
* The task moves from planning to implementation.
* The task enters a higher-risk area.
* Tests repeatedly fail.
* The current target is unavailable or rate-limited.

### 10.6 Implementation Approval

Implementation approval should support both explicit commands and contextual inference, but the MVP must start with explicit commands.

MVP approval commands:

```text
/implement
/go
/apply
```

Later versions may infer approval from conversational phrases such as:

```text
Go ahead.
Yes, do that.
Let's implement it.
Apply the change.
```

Contextual approval is deliberately deferred because getting it wrong breaks the user’s mental model. Casual agreement must not be interpreted as permission to modify files.

Contextual approval should only be inferred when all of the following are true:

* The previous assistant response clearly proposed a bounded implementation plan or concrete change.
* The target files, system area, or scope are known.
* The current mode is `plan`, `review`, or `debug`, not arbitrary conversation.
* The classifier confidence is high.
* The phrase is not more likely to mean “continue explaining,” “continue planning,” or “show me more detail.”

The session controller owns approval state. The classifier may propose approval, but policy decides whether the inference is accepted.

MVP rule:

```text
Do not infer implementation approval from “go ahead” or similar phrases.
```

## 11. Context Transfer and Handoff

The router should define context transfer by functional continuity, not by fixed token count.

After a target switch, the receiving target should be able to continue the current software-delivery task without asking the user to repeat already-known information, reopening settled decisions, losing implementation approval state, or ignoring known constraints and failures.

Continuity checks:

```text
- What are we doing?
- What phase are we in?
- What has the user approved?
- What must not be changed?
- What has already been decided?
- What failed or was rejected?
- What should happen next?
```

Terminology:

```text
Context transfer:
  The continuity goal when moving work between execution targets or sessions.

Context package:
  The structured artifact used to preserve the information needed for context transfer.

Compaction:
  One possible technique for producing a smaller context package from a longer transcript.
```

Compaction is deferred from MVP. The MVP should support explicit handoff and context packages, not automatic transcript compression.

### 11.1 Context Package Contract

A context package should include:

* Session ID.
* Current mode.
* Active goal.
* Active scope.
* Approval state.
* Decisions made.
* Rejected approaches.
* Constraints.
* Files or systems in scope.
* Validation state.
* Known failures.
* Next recommended action.
* Recent verbatim turns that affect approval, correction, or intent.

For MVP, context packaging should be explicit rather than fully automatic.

Supported MVP commands may include:

```text
/handoff
/summarize-session
/switch-with-handoff
```

Automatic context packaging before every target switch is deferred. It is valuable, but it adds a second major source of failure. The first version should prove routing value before adding automatic context packaging or compaction.

### 11.2 Context Transfer Walkthrough

Scenario:

```text
Current target: local-summary
Current target class: cheap_fast
Current mode: plan
User message: /implement
Task: multi-file refactor
```

The user and assistant have discussed simplifying a configuration loader. The assistant proposed a bounded plan touching three files. The user approves implementation with `/implement`.

The router classifies the next step:

```yaml
primary_task_type: multi_file_refactor
new_mode: implement
required_capabilities:
  - repo_context
  - file_read
  - file_edit
  - code_generation
risk: medium
requires_continuity: true
```

The current target is blocked:

```text
local-summary is missing repo_context, file_read, file_edit, and code_generation.
```

The router selects an eligible `strong_coding` target.

Before switching, the context package should include:

```yaml
session_id: session-123
current_mode: implement
active_goal: Simplify the configuration loader without changing public behavior.
approval_state:
  approved_for_implementation: true
  approval_source: explicit_command
files_in_scope:
  - src/config/loadConfig.ts
  - src/config/schema.ts
  - tests/config/loadConfig.test.ts
decisions_made:
  - Reuse the existing config loader instead of introducing a new persistence layer.
  - Preserve current config file format.
rejected_approaches:
  - Do not introduce a new database-backed config store.
constraints:
  - Keep the change limited to configuration loading.
  - Do not alter CLI flags.
  - Add or update tests alongside implementation.
validation:
  - command: npm test -- config
    result: not_run
recent_verbatim_turns:
  - assistant: Proposed bounded implementation plan.
  - user: /implement
next_recommended_action: Read the files in scope, apply the planned refactor, then run config tests.
```

The package should not include:

* Stale brainstorming that has been superseded.
* Raw tool output already summarized.
* Historical alternatives no longer under consideration.
* unrelated conversation from the same session.

The receiving target should be able to answer the continuity checks without asking the user to restate the plan.

### 11.3 Handoff Storage

Generated handoff files should be stored locally by default, not committed to the repository by default. They are session artifacts: useful for continuity, but often temporary, user-specific, branch-specific, noisy, or sensitive.

Global router configuration should live in a user-level directory:

```text
~/.<router-name>/
  config.yaml
  targets.yaml
  routing-policy.yaml
```

Optional repo-level configuration and local state may live in:

```text
repo/
  .<router-name>/
    config.yaml
    state/
      session-state.json
      session-handoff.md
```

Suggested `.gitignore` entry:

```text
.<router-name>/state/
```

A repo may choose to commit `.<router-name>/config.yaml` if the overrides are intended as shared team policy. User-specific or sensitive overrides should remain local.

Durable project context should be committed separately:

```text
repo/
  AGENTS.md
  docs/
    agent/
      architecture.md
      testing.md
      handoff-template.md
```

## 12. Configuration and Precedence

User preferences are global by default, with optional project-specific overrides.

Suggested precedence:

```text
hard constraints
  > safety / risk policy
  > valid manual override
  > project-specific override from ./.<router-name>/
  > global user preference from ~/.<router-name>/
  > default routing policy
```

Manual override does not bypass hard constraints.

### 12.1 Precedence Example

Global user config:

```yaml
# ~/.<router-name>/config.yaml
schema_version: "1.0"
routing_preference: balanced
privacy_posture: balanced
allow_external_providers: true
manual_override:
  default_scope: next_response
  allow_concrete_target_override: false
```

Project override:

```yaml
# repo/.<router-name>/config.yaml
schema_version: "1.0"
routing_preference: prefer_quality
risk_policy:
  high_risk_paths:
    - "src/auth/**"
    - "src/billing/**"
default_target_class_overrides:
  review: strong_reasoning
```

Session/manual override:

```yaml
manual_override:
  target_class: strong_coding
  scope: next_response
  reason: "The current target is missing edge cases in the refactor plan."
```

Resolution:

```text
1. Hard constraints still apply first.
2. Safety/risk policy may escalate auth or billing work.
3. The manual override can step up to strong_coding for the next response if an eligible target exists.
4. The project preference for quality overrides the global balanced preference.
5. The global config still provides defaults not specified by the project.
```

If the manual override requests a target that lacks required capabilities or violates declared privacy policy, the router should refuse it and explain why.

## 13. Project Instruction Integration

The router should not replace project instruction files.

Recommended convention:

* `AGENTS.md` is canonical project guidance.
* Vendor-specific files such as `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md` are adapters.
* `docs/agent/` contains durable project context and committed templates.
* `~/.<router-name>/` contains global user preferences and target configuration.
* `./.<router-name>/` contains optional repo-level overrides and local generated state.

Common files:

```text
~/.<router-name>/config.yaml
~/.<router-name>/targets.yaml
~/.<router-name>/routing-policy.yaml
AGENTS.md
CLAUDE.md
.github/copilot-instructions.md
GEMINI.md
docs/agent/project-context.md
docs/agent/architecture.md
docs/agent/testing.md
docs/agent/handoff-template.md
.<router-name>/config.yaml
.<router-name>/state/session-handoff.md
```

## 14. Privacy and Data Boundaries

The router should respect privacy and data-boundary constraints during routing, but it should not own sensitive-data discovery.

Sensitive-data handling is a cross-cutting concern. The router should consume policy and metadata from other layers, such as:

* User-level privacy preferences.
* Project-level routing policy.
* Client/tool-surface metadata.
* Repository conventions.
* Existing secret scanners or DLP tools.
* Explicit sensitivity labels on files, paths, tasks, or context packages.

The router should answer:

```text
Given the declared sensitivity of this context and the privacy tier of available targets, which targets are eligible?
```

It should not attempt to answer by itself:

```text
Is this entire repository safe to send to an external provider?
```

### 14.1 Responsibility Matrix

| Responsibility                                                       | Owner                                                                   | Router role                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Detect secrets                                                       | Client, repo tooling, secret scanner, security tooling                  | Consume the result if exposed as metadata.                                |
| Classify sensitive files or data                                     | Repo policy, security tooling, organization policy, user/project config | Read declared sensitivity labels.                                         |
| Redact sensitive content                                             | Client, tool surface, security tooling                                  | Assume redaction happened upstream or refuse route if policy requires it. |
| Apply organization-specific compliance rules                         | Organization policy / security tooling                                  | Enforce only declared routing constraints.                                |
| Filter eligible targets by privacy tier                              | Router                                                                  | Owns this at routing time.                                                |
| Warn when privacy constraints limit model choice                     | Router                                                                  | Owns this at routing time.                                                |
| Decide whether the whole repository is safe for an external provider | Not router                                                              | Out of scope.                                                             |

Privacy is a routing constraint, not a full discovery problem.

## 15. Observability and Evaluation

Routing decisions should be logged.

The MVP should log raw routing facts, not try to compute a perfect success score.

### 15.1 What to Log in MVP

MVP logs should capture:

* Session ID.
* Timestamp.
* Previous mode and new mode.
* Task classification.
* Required capabilities.
* Eligible and blocked targets.
* Selected target.
* Whether a switch occurred.
* Whether manual override was used.
* Whether fallback was triggered.
* Basic validation result if available.
* Cost and token count if available.
* Path attribution.

Outcome signals should include:

```text
Path attribution:
  - automatic route followed
  - user manually escalated
  - user manually downshifted
  - user pinned a target
  - user ignored or overrode a warning

Hard validation:
  - tests passed
  - build passed
  - lint/typecheck passed
  - command failed
  - diff applied successfully

User interaction:
  - user accepted the result
  - user corrected an assumption
  - user asked the model to redo the work
  - user manually escalated to a stronger target

Router behavior:
  - target switched automatically
  - target switched manually
  - fallback triggered
  - classifier confidence low
  - required capability missing

Continuity:
  - target asked for already-known information
  - target reopened a settled decision
  - target ignored a rejected approach
  - target lost approval state

Cost:
  - actual cost
  - token count
  - estimated always-strong baseline
  - estimated cheapest-eligible baseline
```

Manual escalation should be treated as a signal that the previous route may have been underpowered.

However, outcomes after heavy manual deviation should be weighted differently from outcomes produced by the intended automated path. The router should learn most strongly from decisions it actually controlled.

### 15.2 What to Defer

The MVP should not attempt to automatically calculate:

* A universal success score.
* Learned routing weights.
* Final quality judgment.
* Full cost-effectiveness scoring.
* Production impact.
* Long-term review quality.

Those can be analyzed later from logs. The first version should make the data visible without pretending the router can perfectly evaluate success.

### 15.3 Example Log Entry

```json
{
  "sessionId": "abc123",
  "timestamp": "2026-05-08T12:00:00Z",
  "previousMode": "plan",
  "newMode": "implement",
  "classification": {
    "primaryTaskType": "multi_file_refactor",
    "complexity": "high",
    "risk": "medium",
    "confidence": 0.84
  },
  "routingDecision": {
    "targetClass": "strong_coding",
    "selectedExecutionTargetId": "openclaw-codex-high",
    "shouldSwitch": true,
    "reason": "User approved implementation after planning. Multi-file refactor requires strong coding target."
  },
  "outcome": {
    "pathAttribution": "automatic_route",
    "testsPassed": true,
    "userManuallyEscalated": false,
    "userCorrectedAssumption": false,
    "tokens": 21400,
    "cost": 0.73
  }
}
```


## 18. Decisions

### 18.1 Session State Ownership

Session state is stored per conversation.

A conversation may be linked to a repository, branch, task, issue, PR, or handoff file, but those are metadata relationships rather than the ownership boundary.

Benefits:

* Reuses the session concept users already understand.
* Avoids creating a competing task lifecycle model.
* Keeps routing behavior aligned with conversational intent.
* Allows users to reset context intentionally by starting a new conversation.

Trade-offs:

* A single conversation can drift across multiple tasks.
* Long-running work may span multiple conversations and require explicit handoff.
* Branch-level or task-level analytics require metadata links.

### 18.2 Optimized Domain Scope

The optimized domain is conversational software delivery, not arbitrary conversation and not code generation alone.

The classifier should recognize the kinds of messages that commonly occur during software delivery. Out-of-domain messages should be detected and routed conservatively.

### 18.3 Execution Targets, Not Abstract Models

Routing should use execution-target metadata rather than model metadata alone.

The same model can have different capabilities depending on the client surface, provider path, available tools, permissions, and context behavior.

### 18.4 Implementation Approval

MVP implementation approval requires explicit commands such as:

```text
/implement
/go
/apply
```

Contextual approval may be added later, but only when the previous assistant turn clearly proposed a bounded implementation plan.

### 18.5 Manual Routing Override

Manual override exists mainly as user-controlled escalation.

The user should be able to say:

```text
/escalate
/stronger
/use strong_reasoning
/use strong_coding
/auto
```

The user should not need to memorize concrete vendor model names.

### 18.6 User Preferences

User preferences are global by default, with optional project-specific overrides.

The normative precedence rule lives in Section 12, **Configuration and Precedence**. Decision summary: project-specific overrides may refine global preferences, but neither project nor manual overrides bypass hard constraints.

### 18.7 Context Transfer

Context transfer is defined by functional continuity, not token count.

The receiving target must be able to continue without asking the user to repeat already-known information, reopening settled decisions, losing approval state, or ignoring known constraints and failures.

Automatic context packaging is deferred from MVP.

### 18.8 Handoff Storage

Generated handoffs are local by default and should be gitignored.

Durable conventions, templates, and project documentation may be committed.

Global router configuration lives outside repositories in `~/.<router-name>/`.

Repo-level overrides may live in `./.<router-name>/`.

### 18.9 Sensitive Information

The router enforces declared privacy constraints, but it does not own sensitive-data discovery, DLP, compliance, or secret scanning.

Security tooling, repository policy, or client surfaces should classify or redact sensitive content. The router filters eligible execution targets based on declared policy and target privacy metadata.

### 18.10 Evaluation

The router evaluates success using outcome signals, not explicit user ratings alone.

Evaluation must be attribution-aware. Outcomes from the intended automatic path should weigh more heavily than outcomes dominated by user overrides.

The MVP logs raw events for manual review. Learned routing and derived success scores are deferred.

## 19. Design Biases

This system should prefer:

* Control plane over agent runtime.
* Execution targets over abstract models.
* Explicit contracts over implicit behavior.
* Small replaceable modules over one clever monolith.
* Inspectable routing over opaque autonomy.
* Deterministic policy before learned routing.
* Continuity preservation over unnecessary switching.
* User-controlled escalation over manual model shopping.
* Telemetry before optimization.
* Narrow MVP before universal integration.

The router should behave less like a magic oracle and more like air traffic control: aware of context, conservative under risk, and boring in the ways infrastructure should be boring.
