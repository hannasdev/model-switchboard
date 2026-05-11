# Decision Log

Use this log for deferred-to-committed design decisions referenced by [ROUTER-PHASE-PLAN.md](ROUTER-PHASE-PLAN.md).

A decision is not treated as committed unless a completed entry exists.

## Entry Template

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
- Expected signal from phase plan:
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

## Initial Placeholder

Decision ID: DEC-2026-05-10-router-phase-governance
Related deferred item: process bootstrap
Status: committed
Date: 2026-05-10
Owners: team

Context:
- Created baseline decision log structure so milestone reviews have a single durable record.

Options considered:
- Option A: keep decisions in ad hoc PR comments.
- Option B: keep decisions in a dedicated docs log.

Tradeoffs:
- Option A: lower setup overhead, weaker auditability.
- Option B: stronger auditability, slight process overhead.

Verification signal:
- Expected signal from phase plan: explicit evidence-backed promotion of deferred commitments.
- Evidence observed: decision template and storage guidance now present in phase plan and this log.

Decision:
- Chosen option: Option B.
- Scope of commitment: use this file for deferred-commitment reviews in current phase.
- What remains intentionally deferred: final long-term ADR format and automation.

Consequences:
- Near-term implementation impact: low.
- Test and replay impact: none.
- Migration impact: low; can be transformed into ADRs later.

Follow-up:
- Next review milestone: Milestone 1 closeout.
- Linked artifacts (logs, fixtures, docs, PRs): docs/ROUTER-PHASE-PLAN.md, docs/contracts/router-contracts.md

## Milestone 1 Closeout

Decision ID: DEC-2026-05-10-milestone-1-router-contracts-closeout
Related deferred item: milestone closeout governance
Status: committed
Date: 2026-05-10
Owners: team

Context:
- Milestone 1 required an experimental, minimal, revision-friendly contract baseline plus explicit Claude mapping without claiming universal behavior.

Options considered:
- Option A: treat Milestone 1 as complete after contract file creation only.
- Option B: treat Milestone 1 as complete only after acceptance criteria mapping and decision-log closeout.

Tradeoffs:
- Option A: faster progress marker, weaker audit trail and weaker governance enforcement.
- Option B: slightly more process overhead, stronger evidence and repeatable milestone governance.

Verification signal:
- Expected signal from phase plan: Milestone 1 acceptance criteria met and documented.
- Evidence observed:
  - `docs/contracts/router-contracts.md` exists and is implementation-usable.
  - Contract version is explicitly `0.1.0-experimental` and provisional.
  - Minimal normative core plus Claude mapping appendix are present.
  - Core contracts represent handoff/context-transfer.
  - Phase and contract docs both include deferred-commitment guardrails.

Decision:
- Chosen option: Option B.
- Scope of commitment: Milestone 1 is formally complete as of 2026-05-10.
- What remains intentionally deferred: taxonomy freeze, numeric continuity scoring, strict constraint enforcement depth, attribution ontology stabilization, and extraction timeline.

Consequences:
- Near-term implementation impact: proceed to Milestone 2 with a stable experimental contract baseline.
- Test and replay impact: enables contract-backed test and replay work in next milestones.
- Migration impact: low; experimental schema remains revision-friendly.

Follow-up:
- Next review milestone: Milestone 2 plan-to-implementation checkpoint.
- Linked artifacts (logs, fixtures, docs, PRs): docs/ROUTER-PHASE-PLAN.md, docs/contracts/router-contracts.md

## Milestone 2 Checkpoint (Slice 1)

Decision ID: DEC-2026-05-10-milestone-2-slice-1-session-policy
Related deferred item: Milestone 2 staged policy depth
Status: committed
Date: 2026-05-10
Owners: team

Context:
- Milestone 2 requires session-aware routing with explicit policy inputs, while keeping current behavior stable and deferring high-risk commitments until verification gates are met.

Options considered:
- Option A: implement full policy depth and enforcement in one large change.
- Option B: ship a scoped first slice with session-mode resolution, named hard/soft inputs, and continuity-aware switching plus focused tests.

Tradeoffs:
- Option A: faster feature completion on paper, higher regression and review risk.
- Option B: lower risk and clearer validation trail, requires additional follow-up slices.

Verification signal:
- Expected signal from phase plan: policy inputs represented explicitly and decision outputs explainable with session and continuity context.
- Evidence observed:
  - Router now exposes `modeResolution`, `policyInputs`, `taskType`, and continuity fields in route decisions.
  - Switchboard evidence summaries now carry these fields through workflow logs.
  - Tests cover staged hard constraints (availability, privacy, client compatibility) and continuity decisions.

Decision:
- Chosen option: Option B.
- Scope of commitment: complete Milestone 2 slice 1 with deterministic session-policy behavior and evidence propagation.
- What remains intentionally deferred: numeric continuity scoring, final taxonomy freeze, strict universal enforcement defaults, and cross-surface validation beyond current scope.

Consequences:
- Near-term implementation impact: improves explainability and policy shape with minimal API disruption.
- Test and replay impact: adds coverage for staged hard constraints and continuity cost behavior.
- Migration impact: low; fields are additive and aligned with experimental contracts.

Follow-up:
- Next review milestone: Milestone 2 slice 2 planning.
- Linked artifacts (logs, fixtures, docs, PRs): src/router/router.js, src/switchboard/workflow.js, test/router.test.js, test/switchboard-workflow.test.js

## Milestone 2 Closeout

Decision ID: DEC-2026-05-11-milestone-2-session-controller-policy-closeout
Related deferred item: Milestone 2 staged policy depth
Status: committed
Date: 2026-05-11
Owners: team

Context:
- Milestone 2 required a deterministic and testable session controller boundary, continuity-aware switching, and explicit hard/soft policy inputs in explainable router outputs.

Options considered:
- Option A: keep session mode transitions embedded in the router implementation.
- Option B: extract session mode transition ownership into a dedicated controller module and lock behavior with direct tests.

Tradeoffs:
- Option A: lower short-term change set, weaker boundary clarity and weaker transition-focused test surface.
- Option B: clearer boundary ownership and stronger deterministic validation, with small refactor overhead.

Verification signal:
- Expected signal from phase plan: mode transition logic deterministic and testable; policy decisions explainable with session/task/constraint/continuity context; route labels continue mapping cleanly.
- Evidence observed:
  - Session mode transition logic extracted to `src/router/session_controller.js` and consumed by router.
  - Dedicated transition tests added in `test/session-controller.test.js`.
  - Full suite passes (`npm test`) with continuity, escalation, override, and hard-constraint behavior preserved.

Decision:
- Chosen option: Option B.
- Scope of commitment: Milestone 2 is formally complete as of 2026-05-11.
- What remains intentionally deferred: numeric continuity scoring, taxonomy freeze, strict universal enforcement defaults, and cross-surface validation beyond Claude workflow.

Consequences:
- Near-term implementation impact: session-controller boundary is now explicit and reusable for Milestone 3 router-client integration work.
- Test and replay impact: transition behavior is isolated and easier to validate independently of broader router selection logic.
- Migration impact: low; external route output behavior remains stable.

Follow-up:
- Next review milestone: Milestone 3 plan-to-implementation checkpoint.
- Linked artifacts (logs, fixtures, docs, PRs): src/router/router.js, src/router/session_controller.js, test/session-controller.test.js, test/router.test.js, docs/ROUTER-PHASE-PLAN.md

## Milestone 3 Closeout

Decision ID: DEC-2026-05-11-milestone-3-claude-workflow-boundary-closeout
Related deferred item: Milestone 3 Claude workflow boundary refit
Status: committed
Date: 2026-05-11
Owners: team

Context:
- Milestone 3 required the Claude workflow to consume router contracts as a client integration, preserve continuity semantics, and separate router decision evidence from Claude execution evidence.

Options considered:
- Option A: keep the existing workflow-specific route context format and explain shape, and defer contract-backed persistence until Milestone 4.
- Option B: refit workflow persistence and explain now so Claude consumes and emits contract-aligned router/session/context shapes while keeping compatibility fields for existing consumers.

Tradeoffs:
- Option A: smaller short-term diff, but leaves Milestone 3 structurally incomplete and pushes risk into Milestone 4.
- Option B: slightly larger boundary refit now, but cleaner milestone ownership, stronger replay/explain foundation, and lower follow-on ambiguity.

Verification signal:
- Expected signal from phase plan: Claude workflow remains functional; router can be exercised independently of Claude launch details; logs distinguish router and Claude execution data; handoff/context fields match the core contract.
- Evidence observed:
  - `src/switchboard/workflow.js` now emits separated `router` and `claude` evidence blocks while retaining compatibility summaries.
  - `src/switchboard/route_context.js` now persists canonical `sessionState`, `routingDecision`, `contextPackage`, and `claudeExecution` fields.
  - `switchboard explain` now surfaces contract-backed router and Claude evidence.
  - Full suite passes (`npm test`) including new workflow and explain tests for contract-backed evidence.

Decision:
- Chosen option: Option B.
- Scope of commitment: Milestone 3 is formally complete as of 2026-05-11.
- What remains intentionally deferred: routing log-event normalization across all surfaces, outcome attribution taxonomy, replay-oriented evaluation tooling, and second-surface validation.

Consequences:
- Near-term implementation impact: Claude workflow is now a cleaner consumer of router outputs with a more explicit control-plane boundary.
- Test and replay impact: route context and explain data now carry contract-backed session and handoff fields suitable for Milestone 4 normalization.
- Migration impact: low; legacy route-context fields remain present for current hook correlation and explain consumers.

Follow-up:
- Next review milestone: Milestone 4 plan-to-implementation checkpoint.
- Linked artifacts (logs, fixtures, docs, PRs): src/switchboard/workflow.js, src/switchboard/route_context.js, src/switchboard/cli.js, src/switchboard/claude_hook_bridge.js, test/switchboard-workflow.test.js, test/switchboard-cli.test.js, docs/ROUTER-PHASE-PLAN.md

## Milestone 4 Closeout

Decision ID: DEC-2025-01-02-milestone-4-explainability-outcome-attribution-closeout
Related deferred item: Milestone 4 Explainability And Outcome Attribution Foundation
Status: committed
Date: 2025-01-02
Owners: team

Context:
- Milestone 4 required event normalization with contract-backed schemas, decision reasoning reconstruction, outcome attribution tracking, and offline replay capabilities so future policy work has solid observability and evaluation foundations.

Options considered:
- Option A: defer all outcome attribution until Milestone 5, focus explain on reconstructing existing evidence only.
- Option B: complete outcome attribution foundations now (RoutingLogEvent schema, attribution store, replay functions) so Milestone 5 can focus purely on new integrations without blocked dependencies.

Tradeoffs:
- Option A: smaller initial scope, but delays critical attribution infrastructure and leaves Milestone 5 at risk of structural debt.
- Option B: larger Milestone 4 scope, but delivers fully integrated explainability + attribution stack ready for policy tuning and second-surface reuse.

Verification signal:
- Expected signal from phase plan: routed turns can be inspected offline with full reasoning reconstruction; outcome attribution is queryable via contract fields; evidence can be replayed to test policy changes; documented replay workflow is available.
- Evidence observed:
  - `docs/contracts/router-contracts.md` now contains RoutingLogEvent schema (Section 7) and outcome taxonomy (Appendix A.5-A.6).
  - `src/router/outcome-constants.js` defines 3 enums (EXECUTION_STATUS, ERROR_SIGNAL, SWITCHING_REASON) with deterministic decision ID generation.
  - `src/switchboard/attribution_store.js` provides persistence (NDJSON) and querying for attribution records by sessionId, decisionId, errorSignal.
  - `src/switchboard/workflow.js` enhanced with event normalization (schemaVersion, sessionId, turnIndex, outcome, attribution inline) + reconstructReasoning() + replay functions (loadSessionEvidence, replayRoutingDecision, evaluatePolicyOnEvidence).
  - `src/switchboard/cli.js` printHumanExplain() now renders "Decision Reasoning:" section with constraint evaluation, continuity cost, confidence, and rationale.
  - `docs/REPLAY-GUIDE.md` documents complete workflow for testing policies against recorded evidence.
  - Full test suite passes: 80/80 tests (73 original + 7 attribution tests + existing flow coverage), 0 regressions.

Decision:
- Chosen option: Option B.
- Scope of commitment: Milestone 4 is formally complete as of 2026-05-11.
- What remains intentionally deferred: outcome feedback integration (success/failure attribution), statistical policy comparison (A/B testing), Milestone 5 second-surface validation.

Consequences:
- Near-term implementation impact: switchboard logs now carry normalized, contract-backed event data alongside legacy fields; explain output includes human-readable reasoning reconstruction; attribution queries enable offline analysis.
- Test and replay impact: 7 new attribution tests establish baseline; replay functions enable policy verification against stored evidence without live Claude runs.
- Migration impact: none; all changes maintain backward compatibility; legacy fields preserved in evidence objects.

Follow-up:
- Next review milestone: Milestone 5 second-surface proof conditional gate (review stability, integration readiness, contract reusability).
- Linked artifacts (logs, fixtures, docs, PRs): src/router/outcome-constants.js, src/switchboard/attribution_store.js, src/switchboard/workflow.js, src/switchboard/cli.js, test/attribution.test.js, docs/contracts/router-contracts.md, docs/REPLAY-GUIDE.md, docs/ROUTER-PHASE-PLAN.md
