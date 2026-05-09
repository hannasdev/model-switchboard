# Session-Aware AI Router PoC

## 1. Purpose

The PoC validates the riskiest assumptions before building the MVP.

The MVP assumes that a vendor-scoped router can reduce model-choice fatigue by routing software-delivery prompts among multiple targets inside one vendor ecosystem. The riskiest parts are not the local policy code. They are whether a chosen vendor ecosystem exposes enough pre-execution control, whether target choice can actually be influenced before processing, and whether the routing decisions feel useful instead of obtrusive.

The PoC should answer:

```text
Can we build a small vendor-scoped routing loop that receives a prompt before execution, chooses an appropriate target, explains the choice, and either executes or produces a realistic action path?
```

If the answer is no, the MVP should not proceed unchanged.

## 2. Critical Assumptions

### 2.1 Vendor Feasibility

At least one vendor ecosystem must expose a practical way to route before model execution.

The PoC should determine whether a candidate vendor can support:

* Seeing the user prompt before model or agent execution.
* Selecting or influencing model, profile, reasoning tier, or execution target before execution.
* Preserving enough session context for repeated turns.
* Reporting enough outcome data to log route decisions.
* Avoiding brittle terminal UI automation or undocumented internals.

### 2.2 Routing Usefulness

The router's decisions must feel reasonable for common software-delivery turns.

The PoC should determine whether a simple rule-based policy can distinguish:

* Low-value or low-risk turns.
* Planning and tradeoff discussion.
* Implementation.
* Debugging.
* Review.
* User correction or dissatisfaction.
* Capability misses.

### 2.3 UX Non-Obtrusiveness

The route explanation must build trust without becoming noise.

The PoC should determine whether compact route explanations are sufficient:

```text
Recommended: best coder
Why: implementation + repo edits + tests.
```

Expanded detail can exist, but should not be required for normal use.

### 2.4 Target Metadata Sufficiency

Coarse manually configured target metadata must be enough for useful first routing.

The PoC should determine whether this metadata is sufficient:

* Target ID.
* Label.
* Internal target class.
* Vendor/surface.
* Capabilities.
* Privacy tier.
* Cost tier.
* Latency tier.
* Availability.

## 3. PoC Scope

The PoC includes:

1. Evaluate two candidate vendor ecosystems.
2. Pick one candidate for a tiny implementation spike.
3. Define a target registry with at least three vendor-scoped targets.
4. Implement or simulate pre-execution routing.
5. Run fixture-based route tests.
6. Produce compact and expanded route explanations.
7. Log route decisions locally.
8. Document feasibility findings and MVP implications.

The PoC does not include:

* Cross-vendor routing.
* Automatic context packaging.
* Full handoff generation.
* Natural-language implementation approval inference.
* Rich UI.
* Learned routing.
* Production-grade persistence.
* Full tool execution.
* Multi-user support.

## 4. Candidate Vendor Evaluation

Evaluate at least:

* OpenAI/Codex ecosystem.
* Anthropic/Claude ecosystem.

Optional if time allows:

* Google/Gemini ecosystem.
* Cursor or other IDE-native ecosystem.

For each candidate, answer:

| Question | Notes |
| --- | --- |
| Can the router see prompts before execution? | Hook, SDK, extension, wrapper, API, or other supported path. |
| Can the router select a target before execution? | Model, reasoning tier, profile, agent config, or execution target. |
| Can repeated turns preserve session state? | Thread/session APIs, resumable sessions, or stable local state. |
| Can the router avoid brittle UI automation? | Prefer official SDKs, documented hooks, or supported config. |
| Can route decisions be explained to the user? | Direct UI, CLI output, hook message, or wrapper response. |
| Can outcomes be logged? | At minimum selected target, blocked targets, and result status. |
| What cannot be changed by the router? | Important vendor limitation. |
| What would force advisory-only mode? | Missing pre-execution control or target selection. |

## 5. Tiny Implementation Spike

After vendor evaluation, implement the smallest viable routing loop for the strongest candidate.

Required flow:

```text
Input prompt
  -> classify mode
  -> derive required capabilities
  -> filter vendor-scoped targets
  -> choose label
  -> explain route
  -> execute if supported, otherwise emit realistic next action
  -> log decision
```

The spike may be a local CLI if that is the fastest way to exercise the vendor integration, but the CLI is a test harness, not the intended product surface.

## 6. Minimal Target Set

Use at least three targets inside the chosen vendor ecosystem:

* `quick`
* `balanced`
* `best coder`

Add `deep reasoning` only if the candidate vendor exposes a meaningful distinction between reasoning and coding targets.

Example:

```yaml
targets:
  - id: vendor-fast
    label: quick
    target_class: cheap_fast
    capabilities:
      - chat
      - structured_output
    cost_tier: low
    latency_tier: low
    privacy_tier: external

  - id: vendor-balanced
    label: balanced
    target_class: medium_reasoning
    capabilities:
      - chat
      - reasoning
      - structured_output
    cost_tier: medium
    latency_tier: medium
    privacy_tier: external

  - id: vendor-coder
    label: best coder
    target_class: strong_coding
    capabilities:
      - chat
      - reasoning
      - repo_context
      - file_read
      - file_edit
      - shell_execution
      - test_execution
    cost_tier: high
    latency_tier: medium
    privacy_tier: external
```

## 7. Fixture Tests

The PoC should include route fixtures before expanding implementation.

Required fixtures:

* Low-value acknowledgement.
* Simple explanation.
* Architecture tradeoff.
* Planning.
* Explicit implementation.
* Ambiguous implementation approval.
* Debugging failing tests.
* Review of high-risk area.
* User correction.
* Capability miss.
* Current expensive target receiving a trivial turn.

Each fixture should assert:

* Resolved mode.
* Required capabilities.
* Chosen label or refusal.
* Explanation contains expected reason.
* Whether switching is recommended.

## 8. Go / No-Go Criteria

### 8.1 Go

Proceed to MVP if:

* At least one vendor ecosystem supports a credible pre-execution routing path.
* Target selection can be influenced before execution, or there is a near-term supported path to do so.
* The route fixtures produce sensible decisions with simple deterministic rules.
* Route explanations are understandable without reading logs.
* The integration does not depend on scraping or automating an interactive terminal UI.
* The remaining gaps are product/implementation work, not blocked external dependencies.

### 8.2 No-Go

Do not proceed to the current MVP if:

* No evaluated vendor can support pre-execution target influence.
* The best available integration is advisory-only with no plausible path to execution.
* The router would need brittle UI automation as the main execution path.
* Target metadata cannot be obtained or configured accurately enough.
* The policy decisions feel arbitrary or noisy on the fixture set.

### 8.3 Pivot

Consider a scoped pivot if:

* One vendor supports model routing but not agent/tool routing.
* Hooks can block or advise but cannot redirect.
* SDKs can execute prompts but do not match the user's preferred workflow.
* Vendor capabilities are strong but session continuity is weak.

Possible pivots:

* Start as a vendor-specific model/profile router rather than execution-target router.
* Start as a route advisor and logger for one vendor, with execution deferred.
* Build a router-owned entrypoint only for high-value workflows such as implementation and debugging.
* Narrow the product to cost-aware routing inside one API/gateway surface.

## 9. PoC Deliverables

The PoC should produce:

1. Vendor feasibility notes.
2. A selected candidate vendor recommendation.
3. A minimal target registry.
4. Fixture route tests.
5. A tiny routing implementation or executable simulation.
6. Example compact and expanded explanations.
7. Local route logs.
8. A recommendation to proceed, stop, or pivot.

## 10. Relationship to MVP

The PoC is the first milestone before the MVP.

The MVP should only begin after the PoC validates that the critical external dependency is viable: at least one vendor ecosystem can support useful pre-execution routing without brittle integration.

If the PoC fails, update the MVP scope before building product features around an integration path that cannot support the core workflow.

## 11. Current PoC Status

The current implementation validates the local routing loop, target registry shape, fixture harness, adapter profile mapping, SDK reachability checks, compact explanations, local decision logging, and a router-owned gateway entrypoint.

For a router-owned gateway-scoped MVP path, no blocking PoC confirmations remain. The gateway entrypoint receives request envelopes, routes before adapter dispatch, records hook timing evidence, and can execute scoped safe capability actions for routed `best coder` turns. Repeated-turn continuity is proven with local file-backed thread state.

The remaining uncertainty is about external vendor-owned UI/client runtimes. The PoC does not yet prove that an external vendor-owned surface can host the same pre-execution interception, target redirection, tool-capable execution controls, or thread continuity model.

Confirmed for the local gateway-scoped path:

1. Pre-execution routing happens before adapter dispatch.
2. Target selection affects the dispatched adapter profile.
3. Routed `best coder` turns can perform scoped safe file-read, file-edit, and test-command actions.
4. Session continuity works across repeated gateway turns using local file-backed thread state.
5. Fixture tests assert mode, required capabilities, selected label or refusal, route explanation snippets, switching behavior, and correction classification.
6. `deep reasoning` is intentionally out of scope as a standalone routed target for this PoC.
7. Model/profile mappings have automated consistency checks and live connection checks should be run in the target release environment.
