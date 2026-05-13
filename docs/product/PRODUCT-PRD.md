# Session-Aware AI Router Product PRD

## Purpose

This document is the product-facing PRD for the Session-Aware AI Router.

It focuses on user problem, product boundary, goals, scope, MVP shape, and roadmap direction.

For technical design details, see [ARCHITECTURE-SPEC.md](../ARCHITECTURE-SPEC.md).

## Status Snapshot

Milestone 4 is complete and the repository now has a contract-backed explainability and outcome-attribution foundation. The execution plan, decision log, release log, and replay guide are updated to reflect that state. Recent boundary-hardening refactors have extracted explain and prompt-classifier concerns into dedicated modules, reducing policy-layer coupling.

Milestone 5 validation is now underway with an advisory second-surface proof. The advisory path returns contract-backed routing decisions for non-Claude surfaces and is being verified for cross-surface consistency across OpenAI Codex, Google Gemini, and Claude surface identifiers.

## 1. Executive Summary

This router is a vendor-neutral control plane for conversational software-delivery work. It does not replace coding agents, IDE extensions, model gateways, shell sandboxes, or security tooling. Its job is narrower: decide which execution target should handle the next step of a session based on conversation state, task phase, required capabilities, user preferences, privacy constraints, and continuity cost.

The central distinction is that the router does not route abstract models. It routes execution targets: a model running through a specific client surface with specific tools, permissions, context behavior, and provider constraints.

The MVP should be intentionally small and should prove the core user value before absorbing adjacent infrastructure concerns. The first product surface should be vendor-scoped, routing among targets inside one ecosystem, while the underlying router architecture remains vendor-neutral. Automatic context packaging/compaction, learned routing, cross-vendor routing, multi-client adapters, privacy scanning, and advanced telemetry are deferred until the control-plane layer proves its value.

## 2. Key Design Idea

The classifier does not choose the model.

The classifier describes the work.

The routing policy chooses a target class.

The execution-target registry maps that target class to eligible execution targets.

A gateway or client adapter may then execute the decision.

```text
Conversation
  → Session State
  → Task Classification
  → Required Capabilities
  → Routing Policy
  → Target Class
  → Eligible Execution Target
  → Client/Gateway Execution
```

This is the core architectural move. It keeps model choice vendor-neutral, prevents the classifier from directly selecting arbitrary provider SKUs, and makes routing decisions explainable.

The first implementation does not need to expose that full vendor-neutrality to users. A vendor-scoped router can still use this architecture internally while routing only among one vendor's targets.

The router should answer:

```text
Given this session state and task phase, what kind of execution target is appropriate now?
```

It should not require the user to memorize which vendor model is best for each task.

## 3. Core Product Boundary

The router is a control plane, not an agent runtime.

It owns:

* Session state.
* Task phase classification.
* Routing policy.
* Target-class abstraction.
* Execution-target eligibility.
* Manual escalation workflow.
* Handoff/context-transfer contract.
* Routing logs and outcome attribution.
* Explanation of routing decisions.

It does not own:

* IDE user experience.
* Full coding-agent orchestration.
* Tool execution.
* Shell sandboxing.
* File-edit mechanics.
* Secret scanning.
* Data-loss prevention or compliance.
* Provider-specific model behavior.
* Inline autocomplete.
* Full gateway/provider abstraction.

This boundary is intentional. The router should solve the part that is currently under-served: session-aware routing decisions. It should not absorb every adjacent AI-tooling responsibility simply because the surrounding ecosystem is messy.

## 4. Problem Statement

Modern AI-assisted development often involves multiple tools and execution surfaces:

* OpenAI Codex.
* Claude Code.
* GitHub Copilot.
* Cursor.
* Gemini CLI.
* OpenClaw or other orchestrators.
* Local and hosted models.
* OpenAI-compatible gateways such as LiteLLM or Bifrost.

These tools differ in cost, capability, context handling, tool access, coding ability, reasoning quality, and behavior under ambiguity.

The primary user pain is repeated model-choice fatigue. Many engineers can make a good model choice when forced to think about it, but they do not want to spend conscious attention deciding whether each turn deserves the most expensive model, a faster cheaper target, a local/private target, or a coding-capable target.

Continuity and handoff become important because they are consequences of solving model choice across execution targets. They are not the first wedge by themselves.

Users may switch targets because of:

* Token exhaustion.
* Cost limits.
* Rate limits.
* Model regressions.
* Provider outages.
* New model releases.
* Different task types requiring different strengths.
* A current model being underpowered for the work.

Most routing systems only inspect the latest prompt. That is insufficient for conversational software-delivery workflows where model need depends on accumulated context, current phase, approval state, risk, and tool capability.

## 5. Goals and Non-Goals

### 5.1 Goals

The router should optimize for conversational software-delivery workflows, including:

* Requirement clarification.
* User-value discussion.
* Architecture and trade-off analysis.
* Implementation planning.
* Code implementation.
* Debugging.
* Test writing and validation.
* Review.
* Documentation and PR communication.
* Agent/session management.

The router should:

1. Route based on conversation state, not just the latest message.
2. Preserve continuity when switching would cause more harm than benefit.
3. Separate task classification from target selection.
4. Use stable target classes rather than hard-coded vendor model names.
5. Route execution targets, not abstract models.
6. Filter by required capabilities before applying preferences.
7. Make routing decisions inspectable and debuggable.
8. Support user-controlled escalation without forcing users to memorize model strengths.
9. Log enough information to improve policy over time.
10. Support explicit handoff between sessions or execution targets.

### 5.2 Non-Goals

The router should not:

1. Attempt to be a full coding agent.
2. Replace project documentation such as `AGENTS.md`, `CLAUDE.md`, or repository conventions.
3. Depend on a single model vendor.
4. Depend on a single agent client.
5. Hide routing decisions behind opaque “AI magic.”
6. Require perfect autonomous judgment in the first version.
7. Allow a classifier model to directly choose arbitrary vendor model names.
8. Attempt to classify arbitrary human conversation beyond the software-delivery domain.
9. Treat “coding” as code generation only while ignoring planning, product reasoning, testing, review, and documentation.
10. Act as a full data-loss-prevention, compliance, or secret-scanning system.
11. Become a universal adapter for every AI client in the MVP.
12. Own automatic context packaging or compaction as an MVP requirement.
13. Replace LiteLLM, Bifrost, provider SDKs, or other gateway layers.

## 6. Scope Boundary

The optimized domain is software delivery.

The router should not classify the full range of human conversation. The domain is intentionally constrained so classification can operate over a smaller and more practical set of expected intents.

Expected categories include:

* Clarifying requirements.
* Discussing user value.
* Exploring solution options.
* Comparing trade-offs.
* Planning implementation.
* Implementing code changes.
* Debugging failures.
* Writing or updating tests.
* Reviewing code or design.
* Refactoring.
* Writing documentation, PR descriptions, changelogs, or release notes.
* Managing agent workflow, model switching, or handoff.

Out-of-domain messages should be detected rather than forced into software-delivery categories. The router may route them to a general-capable target, keep the current target, or mark them as outside the optimized routing domain.

The scope should be narrow enough to make routing reliable, but broad enough to cover real engineering work. The router should optimize for software delivery, not merely code generation.


## 16. MVP Design

The first version should be deliberately boring.

The authoritative first-release scope is defined in [MVP PRD](MVP-PRD.md). The current applied MVP is a Claude Code-scoped Switchboard wrapper with pre-launch/pre-resume model and effort routing, hook correlation, local logs, and conservative tool governance. The broader checklist below remains useful architectural context, but it should not expand MVP scope beyond the dedicated MVP PRD.

### 16.1 MVP Checklist

| Area           | MVP includes                                                     | MVP defers                                      |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Integration    | One integration surface: Claude Code wrapper or custom CLI       | Multi-client adapters                           |
| Commands       | Explicit approval and escalation commands                        | Natural-language approval inference             |
| Classification | Minimal rule-based classifier                                    | Learned classifier or complex inference         |
| Routing        | Deterministic YAML policy                                        | Learned routing                                 |
| Targets        | Execution-target registry                                        | Full gateway abstraction                        |
| Context        | Minimal local session continuity and explicit handoff            | Automatic context packaging before every switch |
| State          | Local state in `~/.<router-name>/` and `./.<router-name>/state/` | Distributed or server-side state                |
| Observability  | Basic routing logs                                               | Advanced telemetry scoring                      |
| Privacy        | Enforce declared constraints                                     | Privacy scanning / DLP                          |
| UI             | Commands only                                                    | Full UI, dropdowns, dashboards                  |

### 16.2 MVP Components

1. One integration surface: Claude Code wrapper or custom CLI.
2. Session state per conversation.
3. Explicit approval and escalation commands.
4. Minimal rule-based classifier.
5. Execution-target registry.
6. Deterministic YAML routing policy.
7. Local state in `~/.<router-name>/` and `./.<router-name>/state/`.
8. Basic routing logs.
9. Manual handoff command.

### 16.3 MVP Modes

Start with:

* `plan`
* `implement`
* `debug`
* `review`
* `summarize`
* `agent_workflow`

### 16.4 MVP Target Classes

Start with:

* `cheap_fast`
* `medium_reasoning`
* `strong_reasoning`
* `strong_coding`

Do not add a separate `writer` or `research` target class until real routing logs show that they are needed.

### 16.5 MVP Routing Policy

```yaml
routes:
  plan: strong_reasoning
  implement: strong_coding
  debug: strong_coding
  review: medium_reasoning
  summarize: cheap_fast
  agent_workflow: medium_reasoning

escalation:
  user_corrected_assumption: strong_reasoning
  repeated_test_failure: strong_coding
  low_classifier_confidence: strong_reasoning
```

## 17. Future Enhancements

### 17.1 Deferred from MVP

These items were explicitly deferred from the Claude Code MVP. They are the first candidates for post-MVP work once the MVP has proven value under real usage.

**Cross-vendor routing**: Route among OpenAI, Anthropic, and Gemini targets based on task classification and capability. The router/workflow boundary was designed to support this, but it requires proven MVP routing pressure before the boundary is hardened enough to extract a separate `@model-switchboard/router` package.

**`@model-switchboard/router` package extraction**: Once the boundary has survived real workflow pressure, extract and publish the router as a standalone public package under the `@model-switchboard` namespace. The MVP should use the current monorepo structure while the boundary is still stabilizing.

**`deep reasoning` as a standalone target**: Only worth adding if a vendor exposes a meaningful distinction from `balanced` or `best coder` routing. No current Claude evidence supports a useful distinction.

**In-session automatic model switching**: Hooks cannot change the active model inside a running Claude session through any supported mechanism. Near-term direction (committed 2026-05-13, DEC-2026-05-13-per-turn-routing-ux-friction): pursue hook-based advisory injection that surfaces the routing recommendation inside the running session via UserPromptSubmit, so users can act on it without being forced to cycle sessions. True in-session switching remains deferred until Claude exposes a supported hook output. A client surface survey (Cursor, GitHub Copilot Chat, Gemini CLI, gateway-backed paths) is also planned to identify whether any alternative surface provides better per-turn routing authority.

**Fully interactive Claude shell parity**: `switchboard --interactive` is implemented and live-verified for basic continuity. It is not yet considered fully supported. See Section 17.2 for the validation criteria before removing the experimental label.

**Broad tool permission automation**: The MVP policy is conservative and fail-closed. Richer tool-governance policy requires real usage data to know where automation adds value without adding risk.

**Automatic context packaging**: Valuable before target switches, but adds a second major failure surface. Defer until routing value is proven first.

**Full gateway execution as the primary product surface**: Viable but not the right first UX. The Claude Code wrapper path proved a better early product fit.

**Learned routing**: Requires real usage logs. The deterministic policy should be proven first.

### 17.2 `--interactive` Validation Criteria

`switchboard --interactive` will be considered fully supported (not experimental) when the following are verified in a live environment:

1. **Continuity across multiple interactive turns**: At least three sequential interactive turns share the same Claude session id, each resuming without prompting the user to restate settled context.
2. **Stale-resume recovery in interactive mode**: If Claude no longer holds the session id, the wrapper retries with a fresh `--session-id` automatically and the user sees a clear recovery message rather than a crash.
3. **Hook correlation in interactive mode**: `UserPromptSubmit` and `PreToolUse` hook events are captured and correlated with route context during an interactive session, not just in prompt-driven mode.
4. **Override controls work in interactive mode**: `--stronger`, `--cheaper`, and `--stay` flags are accepted and applied correctly when launching an interactive session.
5. **Failure behavior is consistent with prompt-driven mode**: Auth failure, route-context write failure, and hook setup failure all fail closed rather than silently degrading.

### 17.3 General Future Enhancements

Possible later features:

1. Automatic context packaging before model switches.
2. Proxy/gateway integration.
3. Advisory sidecar integration for vendor-owned UIs.
4. Richer telemetry and derived success metrics.
5. Learned routing based on real outcomes.
6. Replay mode for evaluating alternate routing decisions.
7. Context package provenance.
8. Cost budgets per project.
9. Latency-sensitive routing.
10. Privacy-sensitive routing based on stronger upstream metadata.
11. Integration with secret scanners, DLP tools, or repository sensitivity labels.
12. Tool-availability-aware routing refinements.
13. Automatic handoff generation before token exhaustion.
14. Model benchmarking from real project tasks.
15. UI showing why a target was chosen.
16. Confidence calibration for classifier decisions.
17. Automatic detection of repeated failure modes.
18. Integration with `AGENTS.md` and `SKILL.md` discovery.
19. Dedicated documentation/writer target class if logs show value.
20. Web research routing if client/tool support is reliable.

