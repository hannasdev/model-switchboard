# Router Phase Plan

## Purpose

The Claude Code MVP has now validated the product wedge that matters most:

* pre-execution routing authority exists at the launch or resume boundary
* routed turns can preserve session continuity
* route decisions can be explained and audited
* wrapper and hook evidence can be correlated

The next phase should turn that validated workflow into a real router control plane.

The core objective is not to add more vendor integrations immediately. The core objective is to make the router boundary explicit, durable, and reusable so later integrations do not duplicate Claude-specific assumptions.

## Why This Phase Exists

The broader product definition in [PRD.md](PRD.md) describes a vendor-neutral, session-aware routing layer that owns session state, task classification, routing policy, execution-target eligibility, handoff, and routing logs.

The current MVP in [MVP-PRD.md](MVP-PRD.md) proves a narrower but valuable product slice: a Claude-scoped workflow integration with deterministic routing, continuity, explanation, and conservative governance.

That is strong progress, but the current implementation is still closer to a validated workflow product than a fully productized control plane.

The largest remaining gap is structural:

* the router contracts called for in the PRD do not yet exist as a canonical document
* session state is still relatively thin compared to the intended model
* routing is still mostly mode- and prompt-driven rather than session-controller-driven
* the Claude workflow remains the dominant product surface rather than one consumer of a stable router boundary

This phase closes that gap.

## Phase Goal

Define and implement router v1 as a first-class control-plane boundary while keeping the working Claude Code workflow intact.

At the end of this phase, the repository should have:

1. A canonical router contract set.
2. A richer session-aware routing policy.
3. A cleaner separation between router logic and Claude workflow mechanics.
4. Evidence and explainability shapes that support policy tuning.
5. One additional integration proof that exercises the router boundary without forcing a full second product launch.

## Non-Goals

This phase should not attempt to:

* ship a rich UI
* introduce learned routing
* build automatic in-session model switching
* broaden tool permission automation beyond current conservative policy
* add many new vendors before the router boundary is stable
* extract and publish `@model-switchboard/router` prematurely
* redesign the Claude workflow UX unless required by the router boundary

## Product Thesis For This Phase

The MVP has already shown that the user value is not "model switching everywhere."

The durable product value is:

```text
A session-aware control plane that chooses the right execution target before a turn,
preserves continuity when switching is not worth it,
and makes that decision inspectable.
```

That means the next step is to strengthen session-aware decision quality and abstraction boundaries before optimizing for surface-area expansion.

## Milestones

### Milestone 1: Router Contracts

Status: complete (2026-05-10)

Decision record: see `DEC-2026-05-10-milestone-1-router-contracts-closeout` in `docs/decision-log.md`.

Create the missing canonical contract document at:

```text
docs/contracts/router-contracts.md
```

The first contract release should be explicitly provisional, versioned as experimental, and intentionally minimal so it stays revision-friendly as non-Claude evidence grows.

For alignment details between this phase plan and the contract document, see the `Phase Alignment Notes` section in `docs/contracts/router-contracts.md`.

Use a two-part structure:

1. normative minimal core (versioned experimental)
2. vendor-specific mapping appendix (starting with Claude)

The minimal core should define the normative shapes for:

* `SessionState`
* `TaskClassification`
* `ExecutionTargetMetadata`
* `RoutingDecision`
* `ContextPackage`
* `RoutingLogEvent`
* `RouterConfig`

The vendor appendix should document how current Claude workflow evidence maps into the core contracts without implying universal behavior across all clients.

The minimal core must also define a handoff/context-transfer thread (initially lightweight) that can be reused by future surfaces without adopting Claude-specific semantics.

Minimum requirements:

* distinguish durable session mode from latest-turn task type
* represent hard constraints separately from soft preferences
* represent continuity cost explicitly
* represent manual overrides without allowing them to bypass hard constraints
* define persisted fields required for explanation and replay
* define schema versioning expectations for stored artifacts
* define minimal handoff/context-transfer fields that are stable enough for explain and replay

Acceptance criteria:

* the contracts document exists and is specific enough to implement against
* the contract version is labeled experimental and provisional
* the minimal normative core and Claude mapping appendix are both present
* current Claude workflow evidence can be mapped into the contract shapes
* target metadata is described as execution targets, not abstract models
* handoff/context-transfer is represented in the core contracts, not only in vendor appendix notes

### Milestone 2: Session Controller And Policy Upgrade

Status: complete (2026-05-11)

Decision record: see `DEC-2026-05-11-milestone-2-session-controller-policy-closeout` in `docs/decision-log.md`.

Move from mostly prompt-local routing to session-aware routing.

Required work:

* add a session controller that owns mode transitions
* separate task typing from resolved session mode
* derive capabilities from resolved mode plus task-specific needs
* add continuity-cost-aware switch decisions
* add explicit escalation rules for low confidence, user corrections, repeated failures, and high-risk implementation
* include privacy constraints, target availability, and client compatibility as named hard-constraint policy inputs
* include user preferences and project overrides as named soft-constraint policy inputs
* preserve clear refusal behavior when no target satisfies hard constraints

Implementation depth for new policy inputs can be staged, but each input must be represented explicitly in policy contracts and decision explanation.

Acceptance criteria:

* mode transition logic is deterministic and testable
* switching is less twitchy when the current target is good enough
* policy decisions are explainable in terms of session state, task type, hard constraints, soft constraints, and continuity cost
* existing route labels such as `quick`, `balanced`, and `best coder` still map cleanly onto the upgraded policy

### Milestone 3: Claude Workflow On Router Boundary

Refit the existing Claude workflow so it consumes the router as a client integration rather than embedding router assumptions directly.

Required work:

* make the Claude launch and resume path consume router contract outputs
* ensure route context persistence uses canonical routing-decision and session shapes
* ensure Claude-side context injection and route context writes map to the core handoff/context-transfer contract
* align `switchboard explain` with the contract-backed evidence model
* keep current continuity semantics and fail-closed behavior intact

Acceptance criteria:

* the Claude workflow remains fully functional
* the router can be exercised without depending on Claude-specific launch details
* logs distinguish router decision data from Claude workflow execution data
* handoff/context-transfer data in Claude flow matches core contract fields

### Milestone 4: Explainability And Outcome Attribution Foundation

Prioritize explainability and outcome attribution first, then support policy tuning on top of that foundation.

Required work:

* normalize routing log events around contract types
* ensure explain output can reconstruct why a route was chosen
* make outcome attribution fields explicit and consistent across routed turns
* keep handoff/context-transfer evidence visible in explain and logs
* preserve enough information to replay a decision offline against fixtures or captured sessions
* define a minimal outcome taxonomy for future evaluation

Acceptance criteria:

* a routed turn can be inspected after the fact without reading raw implementation details
* outcome attribution is queryable from contract-backed log fields
* fixture or recorded-session evaluation can compare expected and actual decisions
* policy changes can be tested against stored evidence without live Claude runs after explain and attribution foundations are stable

### Milestone 5: Second Surface Proof

Conditionally validate router-boundary reuse by exercising one additional integration path only after Milestones 1 through 4 are stable.

Preferred options:

1. an advisory integration that returns a recommended target class and explanation without direct execution control
2. a narrow adapter-backed execution path using the existing adapter layer

Selection rule:

Choose the smallest integration that proves the router boundary without creating a second full workflow product.

Decision gate:

Milestone 5 proceeds only if earlier milestones show stable contracts, stable explainability/attribution, and no unresolved regressions in the Claude workflow.

Acceptance criteria:

* the second surface consumes router contracts rather than Claude-specific shapes
* the router can make a decision for that surface without special-casing Claude semantics
* the result demonstrates that the boundary is reusable, not just abstractly documented

If the gate is not met, Milestone 5 is deferred without blocking phase completion.

## Suggested Build Order

1. Write `docs/contracts/router-contracts.md`.
2. Keep the first version experimental and revision-friendly while evidence broadens.
3. Refactor router internals around session state, task type, and routing decision contracts.
4. Upgrade router tests to cover mode transitions, continuity cost, escalation, refusal, and override behavior.
5. Adapt the Claude workflow and explain path to the new contracts.
6. Add replayable evidence fixtures.
7. If decision gate is met, prove the second integration surface.

This order matters.

If the second integration is attempted before the contracts and session-policy work, the repo will likely accumulate adapter-specific duplication rather than a real control plane.

## Engineering Principles

* Keep the current Claude workflow working throughout the phase.
* Prefer deterministic policy over heuristic sprawl.
* Treat continuity as a first-class cost, not a side effect.
* Preserve fail-closed behavior where routing trust is required.
* Avoid widening the target set until the contract boundary is stable.
* Build logs and explainability for replay, not only for human debugging.

## Early Commitments To Delay Pending Verification

The following commitments should remain intentionally deferred until assumptions are verified with evidence beyond the current Claude-first workflow.

1. Freeze of task taxonomy and mode set.
Reason: current evidence is strong for a subset of software-delivery tasks but not broad enough to lock a universal taxonomy.
Verification signal: repeated misclassification and override patterns are low across at least one non-Claude validation surface.
Interim default: keep current mode and task model deterministic, but allow taxonomy evolution in experimental versions.

2. Numeric continuity-cost scoring model.
Reason: weighted scoring can imply precision that current evidence does not support.
Verification signal: replay evidence shows categorical continuity decisions are insufficient for stable switching behavior.
Interim default: keep continuity cost categorical with transparent explanation fields.

3. Stable risk model ownership boundary.
Reason: it is not yet proven whether risk should be router-owned, adapter-provided, or hybrid.
Verification signal: at least one second surface demonstrates consistent risk signal quality and portability.
Interim default: treat risk as optional and explicitly sourced in logs.

4. Hard enforcement semantics for privacy, availability, and compatibility.
Reason: strict enforcement may over-refuse before policy inputs are reliable across clients.
Verification signal: policy replay shows low false-refusal rates with named hard-constraint inputs.
Interim default: represent these constraints in contracts now, stage enforcement depth by milestone.

5. Stable outcome attribution taxonomy.
Reason: early taxonomies often calcify around one workflow and become hard to migrate.
Verification signal: attribution labels remain actionable and low-ambiguity across fixture replay and live evidence.
Interim default: keep outcome attribution minimal and revision-friendly.

6. Mandatory second-surface implementation.
Reason: breadth can dilute focus if core explainability and attribution are not stable first.
Verification signal: Milestones 1 through 4 meet stability gates with no unresolved Claude regressions.
Interim default: keep Milestone 5 conditional and deferrable with explicit rationale.

7. Router package extraction timeline.
Reason: extraction before boundary hardening can lock unstable APIs and increase migration cost.
Verification signal: contract-backed boundary survives real usage with limited churn and clear adapter seams.
Interim default: keep extraction as a post-phase decision, not a phase commitment.

Review cadence:

* Re-evaluate this list at the end of each milestone.
* Promote a deferred item to a committed design decision only when its verification signal is met and documented.

Decision log template:

Use this template whenever a deferred commitment is reviewed, promoted, or explicitly kept deferred.

```text
Decision ID: DEC-YYYY-MM-DD-<slug>
Related deferred item: <item number and title>
Status: proposed | committed | deferred | rejected
Date: <YYYY-MM-DD>
Owners: <names>

Context:
- What was uncertain and why this decision is being reviewed now.

Options considered:
- Option A: <summary>
- Option B: <summary>
- Option C: <summary>

Tradeoffs:
- Option A: <key pros/cons>
- Option B: <key pros/cons>
- Option C: <key pros/cons>

Verification signal:
- Expected signal from this phase plan:
- Evidence observed:

Decision:
- Chosen option:
- Scope of commitment:
- What remains intentionally deferred:

Consequences:
- Near-term implementation impact:
- Test and replay impact:
- Migration impact:

Follow-up:
- Next review milestone:
- Linked artifacts (logs, fixtures, docs, PRs):
```

Storage guidance:

* Keep entries in a simple decision log file under docs (for example, `docs/decision-log.md`).
* Link each entry back to the affected milestone and deferred-item number in this plan.
* Do not treat a design as committed unless a completed decision entry exists.

## Exit Criteria

This phase is complete when all of the following are true:

1. The router contract document exists and matches implementation reality.
2. Session-aware routing decisions are controlled by a real session controller rather than only prompt keywords.
3. The Claude workflow is cleanly downstream of router outputs.
4. Explain and log artifacts use stable contract-backed shapes.
5. Handoff/context-transfer is represented and validated across contracts, Claude workflow mapping, and explain/log evidence.
6. If Milestone 5 gate is met and executed, a second integration path demonstrates boundary reuse; otherwise, deferral is explicitly documented with rationale.
7. The repo is in a credible position to decide whether to extract `@model-switchboard/router`.

## What Success Enables Next

If this phase succeeds, the project can make a high-confidence choice among the next strategic options:

1. extract and publish `@model-switchboard/router`
2. add a second workflow product on top of the same router boundary
3. build advisory integrations for surfaces where direct execution control is unavailable
4. invest in richer policy evaluation and eventually learned routing

Without this phase, expansion to more surfaces would likely increase complexity faster than product value.
