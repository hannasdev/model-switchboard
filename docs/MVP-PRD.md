# Session-Aware AI Router MVP PRD

The first milestone before this MVP is the [PoC](POC.md), which validates vendor feasibility and the smallest routing loop before product buildout.

## 1. Product Summary

Software engineers increasingly have access to many capable AI models and coding surfaces, but most users do not want to make a conscious model-selection decision for every turn. The router reduces model-choice fatigue by choosing an appropriate execution target for the current software-delivery step.

The MVP should be vendor-scoped at the product surface. It should route among multiple targets inside one vendor ecosystem first, such as OpenAI/Codex targets or Anthropic/Claude targets, while keeping the underlying router core vendor-neutral.

The MVP should prove a simple thesis:

```text
Use cheaper or faster targets when the expected outcome is not meaningfully affected, and escalate when task risk, complexity, required tools, or user intent justify it.
```

The router is not primarily for users who enjoy manual model benchmarking. It is for engineers who want good defaults, visible reasoning, and a way to override the decision when they care.

The MVP should not try to be a universal cross-vendor router. Cross-vendor routing can come later after the routing policy, labels, explanations, and outcome signals are proven within one ecosystem.

## 2. User Problem

The primary pain is not that users lack access to powerful models. The pain is that choosing among models and tools is a repeated cognitive tax.

Common examples:

* A high-end model is useful for architecture and difficult debugging, but wasteful for acknowledgements, summaries, and low-risk routine turns.
* A cheaper or faster model is fine for many steps, but users do not want to constantly decide where the boundary is.
* Model names, vendor SKUs, and client capabilities change faster than most engineers want to track.
* The best choice depends on the task, available tools, privacy constraints, cost posture, and current conversation state.

The secondary need is continuity. Once routing is introduced, switching targets can lose context, permissions, approval state, or settled decisions. The MVP should acknowledge this need, but it should not promise seamless automatic handoff yet.

## 3. First User and Target Audience

First user:

* A senior, high-context software engineer who actively uses AI tools.
* Comfortable with configuration and early tooling.
* Wants better defaults because repeated model choice is annoying, not because they cannot make the decision manually.

Broader target audience:

* Average software engineers using AI coding tools.
* Engineers who know that model choice matters but do not know which model is best for which task.
* Engineers who are overusing the most expensive model because it is easier than thinking.
* Engineers who underuse stronger models because escalation requires too much conscious effort.

The product should serve both groups by making the default path simple while keeping the decision inspectable.

## 4. Desired Outcome

The user should feel:

```text
I can let the router choose most of the time, and I understand why it escalated or stayed cheap.
```

The router succeeds if it reduces conscious model-selection decisions without noticeably degrading work quality.

Early success signals:

* The user accepts most default routing decisions.
* Manual escalations decrease over time for routine tasks.
* Expensive targets are used less for low-value turns.
* Users can explain why a route happened after reading the router explanation.
* Switching or escalation does not surprise the user.

## 5. MVP Scope

The MVP includes:

1. One vendor ecosystem.
2. One integration surface inside that ecosystem.
3. A manually configured execution-target registry for that vendor.
4. A small set of user-facing target labels.
5. Minimal session state.
6. Rule-based task and mode classification.
7. Deterministic routing policy.
8. Capability and privacy filtering based on declared metadata.
9. Outcome-focused route explanations.
10. User-controlled escalation and return-to-auto.
11. Basic routing logs.
12. Manual handoff summary.

The MVP does not include:

* Learned routing.
* Automatic context packaging before every switch.
* Natural-language implementation approval inference.
* Cross-vendor routing.
* Multi-client support.
* Full gateway abstraction.
* Secret scanning or DLP.
* Rich dashboards.
* Automatic model benchmarking.
* Full success scoring.

## 6. First Workflow

The first workflow should be a tracer bullet through the whole system:

```text
User starts or continues a software-delivery session.
Router reads minimal session state and latest user turn.
Router classifies the turn.
Router filters targets by required capabilities and declared constraints.
Router chooses a target label.
Router explains the decision.
User may accept, escalate, downshift, or return to auto.
Router logs the decision and any override.
```

The long-term product workflow must put the router on the pre-execution path inside the selected vendor ecosystem:

```text
User writes prompt.
Router receives the prompt before a model or agent processes it.
Router chooses the vendor-scoped target or recommends a switch.
Selected execution target handles the prompt.
Router records the decision and outcome signals.
```

If the router only runs beside the user's primary tool after a prompt has already been processed, it can advise and learn, but it cannot fully remove model-choice fatigue.

The MVP may use advisory mode as validation scaffolding. In advisory mode, the router recommends a target and produces an explanation or handoff/context note, but the user or client performs the actual switch. This validates routing quality before investing in deeper execution integration.

Direct execution is deferred until the selected vendor ecosystem can support pre-execution routing cleanly without forcing the router to become an agent runtime.

## 7. UX Direction

The MVP should avoid exposing internal terms like `target_class` as the primary user language.

Use a small global set of outcome-oriented labels:

* `quick`
* `balanced`
* `deep reasoning`
* `best coder`

These labels should map to internal target classes and eligible execution targets. The vocabulary should remain consistent across users and documentation, while each user may configure which concrete execution targets sit behind each label.

In the MVP, those concrete targets should belong to one vendor ecosystem. For example, an OpenAI/Codex-scoped MVP might map `quick`, `balanced`, `deep reasoning`, and `best coder` to different OpenAI/Codex targets. An Anthropic/Claude-scoped MVP might map the same labels to different Anthropic/Claude targets.

Privacy and cost should usually appear as constraints or supporting metadata, not as primary route labels.

The UX should be outcome-focused:

```text
Chosen: best coder
Why: implementation approved; task touches multiple files; repo edit tools required.
Cost posture: higher cost accepted because quality risk is meaningful.
```

Instead of requiring protocol-heavy commands for every action, the MVP should support simple controls around outcomes:

* "Use stronger target for this."
* "Prefer cheaper unless quality is at risk."
* "Stay on this target for now."
* "Return to auto."
* "Explain the route."

Exact command syntax can exist underneath, but the product concept should not depend on users enjoying slash commands.

Cost should be shown qualitatively in the main route explanation. Exact cost estimates may appear in logs or expanded details, but the main flow should not feel like accounting software.

Advisory validation should use a recommendation-plus-action shape. The router should not merely report a passive suggestion, and it should not intercept every prompt before trust has been earned.

Compact route explanation should show:

```text
Recommended: best coder
Why: implementation + repo edits + tests.
```

Expanded explanation should be available on request and may show mode, required capabilities, blocked targets, cost posture, and continuity reasoning.

Compact UI should show the selected outcome label plus at most two supporting badges, such as:

```text
Recommended: best coder · repo tools · higher cost
```

Detailed configuration may expose internal fields such as `target_class`, `capabilities`, `privacy_tier`, `cost_tier`, and `latency_tier`.

## 8. MVP Routing Model

Start with a small mode set:

* `plan`
* `implement`
* `debug`
* `review`
* `summarize`
* `agent_workflow`
* `out_of_domain`

Start with a small internal target-class set:

* `cheap_fast`
* `medium_reasoning`
* `strong_reasoning`
* `strong_coding`

Initial default policy:

```yaml
routes:
  plan: medium_reasoning
  implement: strong_coding
  debug: strong_coding
  review: medium_reasoning
  summarize: cheap_fast
  agent_workflow: medium_reasoning
  out_of_domain: medium_reasoning

escalation:
  user_requests_stronger: strong_reasoning
  implementation_approved: strong_coding
  repeated_test_failure: strong_coding
  high_risk_paths: strong_coding
  low_classifier_confidence: strong_reasoning
```

The policy should prefer continuity when the current target is capable enough and the expected quality gain from switching is small.

Before outcome logs exist, the router should estimate "not meaningfully affected" using conservative heuristics:

* Prefer cheaper or faster targets when no file edits, tool execution, high-risk reasoning, or project-direction decisions are needed.
* Prefer stronger targets when the task involves implementation, debugging, multi-file work, high-risk areas, ambiguous architecture choices, repeated failure, or user correction.
* Preserve the current target when switching would be more disruptive than the expected quality or cost benefit.

The router should not twitch between targets for every trivial turn. If the current expensive target is active during implementation or debugging, the router may keep continuity unless the turn is clearly standalone or the user's cost posture strongly prefers cost savings.

## 9. Minimal Session State

The MVP session state should track only what routing needs:

* Session ID.
* Current mode.
* Current selected target.
* User cost posture.
* User privacy posture.
* Approval state.
* Last route decision.
* Recent user correction or dissatisfaction signal.
* Recent validation failure signal.
* Whether the user pinned, escalated, or downshifted the target.

Everything else should be deferred until it directly improves routing quality.

Cost posture should use three values:

* `prefer_cost`
* `balanced`
* `prefer_quality`

Precedence should be:

```text
session override > project preference > global default
```

Global default should exist first. Project preference is optional. Session override is useful for temporary intent, such as "keep this exploration cheap" or "bias quality for this task."

## 10. Execution Target Registry

The MVP can use manually declared target metadata.

Each target should declare:

* ID.
* User-facing label.
* Internal target class.
* Provider or client surface.
* Available capabilities.
* Privacy tier.
* Approximate cost tier.
* Latency tier.
* Availability status.

The router should not assume that a model name implies tool access. Capabilities belong to the execution target, not the abstract model.

Target metadata should stay coarse enough that users can maintain it by hand.

Initial capability vocabulary:

* `chat`
* `reasoning`
* `repo_context`
* `file_read`
* `file_edit`
* `shell_execution`
* `test_execution`
* `structured_output`

Example:

```yaml
id: codex-high
label: best coder
target_class: strong_coding
provider: openai
surface: codex
capabilities:
  - chat
  - reasoning
  - repo_context
  - file_read
  - file_edit
  - shell_execution
  - test_execution
privacy_tier: external
cost_tier: high
latency_tier: medium
availability: available
```

## 11. Integration Direction

The first vendor ecosystem and integration surface are not yet chosen.

The MVP should choose one vendor ecosystem and route among that vendor's available targets before attempting universal cross-vendor routing.

The product should be designed toward a vendor-scoped pre-execution entrypoint, hook, extension, or wrapper. The user should eventually send prompts through the router before the chosen vendor model or agent processes the prompt.

Advisory mode is still acceptable for MVP validation, but it should not be mistaken for the final product shape.

Selection criteria:

* Can the integration observe enough session state to make routing useful?
* Can the integration receive the user's prompt before a model or agent processes it?
* Can it expose or simulate multiple targets within one vendor ecosystem?
* Can it select or influence the model/profile/reasoning tier before execution?
* Can it support route explanation and override?
* Can it preserve enough context when switching?
* Can it be built without depending on unstable vendor internals?

Candidate paths:

* OpenAI/Codex-scoped router.
* Anthropic/Claude-scoped router.
* Vendor-owned CLI/workbench wrapper.
* Vendor hook or extension if it can influence pre-execution target choice.
* Advisory sidecar for vendor feasibility testing.

The first implementation should choose the vendor path that best supports pre-execution routing with the least brittle implementation, not the path that sounds most universal.

A repo-local advisory CLI may be useful as a lab bench for routing fixtures, explanations, target metadata, and logs. It should be treated as proof scaffolding, not the intended end-user workflow.

## 12. Acceptance Criteria

The MVP is acceptable when it can:

1. Load a configured target registry.
2. Classify a turn into one of the MVP modes.
3. Apply deterministic routing policy.
4. Refuse targets that lack required capabilities.
5. Choose a cheaper target for low-risk summary or acknowledgement work.
6. Escalate to a stronger target for implementation, debugging, or high-risk work.
7. Explain the route in user-facing language.
8. Let the user manually escalate or return to auto.
9. Log the route decision and any override.
10. Generate a manual handoff summary.
11. Support global cost posture with optional session override.
12. Preserve continuity when switching would be more disruptive than useful.

## 13. Example Acceptance Tests

Route behavior should be covered by fixture-style regression tests before the router becomes more automated. Fixtures should use realistic user turns and expected route decisions.

Suggested fixture shape:

```yaml
- name: debugging_requires_best_coder
  session:
    mode: plan
    cost_posture: balanced
  input: "The test suite is failing after the refactor. Fix it."
  expected:
    mode: debug
    label: best coder
    required_capabilities:
      - repo_context
      - file_read
      - shell_execution
      - test_execution
    explanation_contains:
      - tests
      - repo tools
```

### Low-Value Turn

Input:

```text
Thanks, that makes sense.
```

Expected:

* Mode remains unchanged or moves to `summarize` if the client asks for a response.
* Router chooses `cheap_fast` if a response is needed.
* Explanation says the turn does not require repo tools or deep reasoning.

### Architecture Discussion

Input:

```text
Compare the tradeoffs between a proxy integration and a CLI wrapper.
```

Expected:

* Mode is `plan`.
* Router chooses `medium_reasoning` or `strong_reasoning` depending on configured quality posture.
* Router does not require repo edit tools.

### Implementation

Input:

```text
Implement the plan.
```

Expected:

* MVP does not infer file-edit approval unless the integration has explicit approval semantics.
* If approval is explicit, mode becomes `implement`.
* Router requires repo context and file-edit capability.
* Router chooses `strong_coding` if eligible.

### Debugging

Input:

```text
The test suite is failing after the refactor. Fix it.
```

Expected:

* Mode becomes `debug`.
* Router requires shell/test capability if execution is expected.
* Router chooses `strong_coding`.

### Privacy Constraint

Input:

```text
Review this auth change.
```

Expected:

* Router applies declared path or project sensitivity metadata if available.
* Router excludes targets that violate the configured privacy posture.
* If no eligible target exists, router refuses clearly.

Additional regression fixtures should cover:

* Simple explanation.
* Planning.
* Ambiguous implementation approval.
* High-risk paths.
* User correction.
* Cheap target blocked by missing capabilities.
* Current expensive target receiving a trivial turn.

## 14. Manual Handoff Format

The first manual handoff format should be Markdown.

Markdown is human-readable, easy to edit, and portable across clients. A structured JSON form can be added later if machine-readability becomes important.

Suggested format:

```markdown
# Handoff

## Current Goal

## Current Mode

## User Intent / Approval

## Decisions Made

## Constraints

## Files Or Areas In Scope

## Known Failures

## Recommended Next Step
```

The handoff does not need to preserve all conversation history. It should preserve enough context for the receiving target to continue without asking the user to repeat settled intent, constraints, or known failures.

## 15. MVP Decisions

1. The long-term product requires pre-execution routing.
2. Advisory mode is acceptable only as MVP validation scaffolding.
3. Automatic target execution is deferred until a suitable pre-execution integration is chosen.
4. User-facing labels are global and outcome-oriented: `quick`, `balanced`, `deep reasoning`, and `best coder`.
5. Privacy is a constraint/filter, not usually a primary route label.
6. Cost posture has three values: `prefer_cost`, `balanced`, and `prefer_quality`.
7. Cost-preference precedence is session override, then project preference, then global default.
8. Main route explanations show qualitative cost posture, not exact cost by default.
9. Target metadata is manually configured and coarse.
10. The router avoids twitchy switching and preserves continuity when the current target is capable enough.
11. Manual handoff is Markdown first.
12. Advisory validation uses recommendation plus action.
13. Route explanations are compact by default and expandable on request.
14. Compact UI shows the selected outcome label plus at most two supporting badges.
15. Route behavior should be covered by YAML-style regression fixtures.
16. The MVP should be vendor-scoped at the product surface.
17. Cross-vendor routing is deferred until one vendor-scoped router proves the core value.

## 16. Remaining Open Questions

1. Which vendor ecosystem can support pre-execution routing with the least brittle implementation?
2. Within that vendor ecosystem, which integration surface can select or influence target choice before execution?

## 17. Relationship to Architecture Document

This MVP PRD defines the first product slice. The broader architecture, contracts, and future design options live in [Architecture and Design Document](PRD.md).

The MVP should not begin until the [PoC](POC.md) validates that at least one vendor ecosystem can support useful pre-execution routing without brittle integration.

The architecture document should not be treated as MVP scope unless this PRD explicitly includes the feature.
