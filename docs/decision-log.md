# Decision Log

Use this log for deferred-to-committed design decisions referenced by [ROUTER-PHASE-PLAN.md](product/ROUTER-PHASE-PLAN.md).

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
- Linked artifacts (logs, fixtures, docs, PRs): docs/product/ROUTER-PHASE-PLAN.md, docs/contracts/router-contracts.md

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
- Linked artifacts (logs, fixtures, docs, PRs): docs/product/ROUTER-PHASE-PLAN.md, docs/contracts/router-contracts.md

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
  - Session mode transition logic extracted to `src/router/session-controller.js` and consumed by router.
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
- Linked artifacts (logs, fixtures, docs, PRs): src/router/router.js, src/router/session-controller.js, test/session-controller.test.js, test/router.test.js, docs/product/ROUTER-PHASE-PLAN.md

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
  - `src/switchboard/route-context.js` now persists canonical `sessionState`, `routingDecision`, `contextPackage`, and `claudeExecution` fields.
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
- Linked artifacts (logs, fixtures, docs, PRs): src/switchboard/workflow.js, src/switchboard/route-context.js, src/switchboard/cli.js, src/switchboard/claude-hook-bridge.js, test/switchboard-workflow.test.js, test/switchboard-cli.test.js, docs/product/ROUTER-PHASE-PLAN.md

## Milestone 4 Closeout

Decision ID: DEC-2026-05-11-milestone-4-explainability-outcome-attribution-closeout
Related deferred item: Milestone 4 Explainability And Outcome Attribution Foundation
Status: committed
Date: 2026-05-11
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
  - `src/switchboard/attribution-store.js` provides persistence (NDJSON) and querying for attribution records by sessionId, decisionId, errorSignal.
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
- Linked artifacts (logs, fixtures, docs, PRs): src/router/outcome-constants.js, src/switchboard/attribution-store.js, src/switchboard/workflow.js, src/switchboard/cli.js, test/attribution.test.js, docs/contracts/router-contracts.md, docs/REPLAY-GUIDE.md, docs/product/ROUTER-PHASE-PLAN.md

## Open Product Risk: Per-Turn Routing UX Friction

Decision ID: DEC-2026-05-13-per-turn-routing-ux-friction
Related deferred item: MVP-PRD.md Assumption B (Claude Continuity) falsification criteria; PRODUCT-PRD.md Section 17.1 deferred items
Status: committed
Date: 2026-05-13
Owners: team

Context:
- Manual testing and review of interactive mode surfaced a gap between technical continuity and UX continuity. The continuity assumption (Assumption B in MVP-PRD.md) was verified against session-id persistence and chat history carry-over, but not against the workflow interaction pattern the user must follow to obtain per-turn routing.
- In practice, per-turn routing (the only path that gets automatic model/effort re-selection each turn) requires the user to: exit Claude, return to the terminal, invoke `switchboard "..."`, wait for routing, and re-enter Claude for each routed turn (typically by resuming the same Claude session id). This is materially different from the normal Claude Code usage pattern, where the user stays inside one interactive session.
- Interactive mode (`switchboard --interactive`) avoids this friction but fixes the model/effort at launch with no re-routing once inside Claude.
- There is currently no path that provides both: per-turn automatic re-routing and a natural stay-in-session experience. This trading of one cognitive cost (model selection) for another (repeated session cycling) risks limiting practical adoption among the stated target user: high-context engineers already comfortable with Claude Code.

Options considered:
- Option A: accept the current per-turn pattern as a known limitation and focus adoption documentation on making the friction explicit rather than eliminating it.
- Option B: invest in a hook-based advisory injection path that surfaces the next-turn route recommendation inside the running Claude session, so the user at least sees what routing would suggest without having to exit and re-enter.
- Option C: defer until Claude exposes a supported in-session model-switching API, at which point routing authority can move inside the session rather than at the launch boundary.
- Option D: redesign the primary usage pattern around `switchboard --interactive` with acceptance that model/effort is set once per session, and treat per-turn rerouting as an advanced or explicit-override use case rather than the default experience.

Tradeoffs:
- Option A: honest and low effort, but does not resolve the adoption risk and may position the tool as too operationally disruptive for daily use.
- Option B: provides routing visibility without forcing session cycling; feasible with the existing hook bridge advisory injection; does not require a new Claude API; does not actually change the model mid-session, but closes some of the perception gap. Requires clear UX language so users understand it is advisory, not authoritative.
- Option C: no product work needed now; entirely contingent on a vendor capability that does not currently exist. Appropriate as a deferred path but not a near-term strategy.
- Option D: reduces the scope of the routing promise to session-start only; aligns better with the natural Claude Code usage pattern; may feel like a weaker product but is more honest about what the current architecture delivers.

Verification signal:
- Expected signal: evidence that real users (or the product owner in daily use) find the per-turn cycling acceptable or unacceptable in practice.
- Evidence observed: manual testing and reasoning session on 2026-05-13 identified the friction clearly; no live adoption data yet as the product is pre-broad-release.

Decision:
- Chosen option: Option B — invest in hook-based advisory injection that surfaces the routing recommendation inside the running Claude session via `UserPromptSubmit` context injection. This is the best available path given current constraints: it requires no new Claude API, builds on existing hook infrastructure, and closes the perception gap without forcing session cycling.
- Scope of commitment: pursue Option B as the near-term direction. Separately, survey alternative client surfaces (e.g. Cursor, GitHub Copilot Chat, Gemini CLI, OpenClaw) to identify whether any expose an integration point that allows genuine per-turn routing authority within a running session, which would supersede the advisory approach.
- What remains intentionally deferred: Option C (true in-session model switching) remains deferred pending a supported Claude API. Option D (reframing the product promise) is kept as a fallback if client exploration yields no better interface. The client exploration work should inform a follow-up decision before broad adoption promotion.

Consequences:
- Near-term implementation impact: hook bridge advisory injection path needs to be hardened so that each `UserPromptSubmit` event surfaces a clear, low-noise routing recommendation the user can act on or ignore. This is distinct from current advisory context injection which is primarily for correlated logging.
- Test and replay impact: new advisory injection behavior should be covered by hook bridge tests to ensure recommendation accuracy and noise level are acceptable.
- Migration impact: low; existing hook correlation and logging behavior is preserved. Advisory injection is additive.

Follow-up:
- Next review milestone: (1) implement and live-verify improved advisory injection; (2) complete a client surface survey covering at minimum Cursor, GitHub Copilot Chat, Gemini CLI, and one gateway-backed path; (3) revisit Option C and Option D based on survey findings before broad adoption promotion.
- Linked artifacts (logs, fixtures, docs, PRs): docs/product/MVP-PRD.md (Assumption B, Section 8 MVP defer list), docs/product/PRODUCT-PRD.md (Section 17.1 deferred items updated 2026-05-13), README.md (Interactive Mode Clarification section added 2026-05-13), src/switchboard/claude-hook-bridge.js (advisory injection comment)

## Milestone 5 Spike: Codex CLI Feasibility

Decision ID: DEC-2026-05-13-codex-cli-feasibility-spike
Related deferred item: PRODUCT-PRD.md Section 17.1 deferred items; milestone 5 second-surface proof
Status: committed; app-server in-session probe implemented
Date: 2026-05-13
Owners: team

Context:
- The current committed near-term path remains advisory injection inside running Claude sessions, but this alone does not answer whether Codex CLI can provide a better route-authority boundary.
- The product question is not whether OpenAI SDK calls can change models. The question is whether the Codex CLI user surface exposes a supported boundary where Switchboard can choose the execution target with low UX friction while preserving session continuity.
- The primary differentiator beyond Claude parity is in-session model switching. A command-boundary `exec`/`resume` workflow is useful evidence, but it is not enough to justify a product-direction change by itself.

Options considered:
- Option A: continue advisory hardening only and postpone all Codex feasibility testing.
- Option B: run a Codex CLI command-surface spike first, focused on supported `codex exec` and `codex exec resume` route authority.
- Option C: use OpenAI SDK calls as a proxy for Codex feasibility.

Tradeoffs:
- Option A: lowest immediate effort, highest unresolved product-risk uncertainty.
- Option B: small incremental engineering overhead, answers the client-surface question directly, but initially proves command capability rather than live execution.
- Option C: easy to implement and live-test, but risks falsely validating the wrong surface because SDK calls do not represent Codex CLI session/tool/runtime behavior.

Verification signal:
- Expected signal: a reproducible probe that can show whether local Codex CLI exposes route-selected model authority at launch, non-interactive execution, or resume boundaries, and whether it should be treated as authoritative or advisory.
- Evidence observed: local Codex CLI help exposes `--model` for interactive launch, `codex exec --model`, and `codex exec resume --last --model`. The command-surface probe reports this as resume-boundary route authority, not in-session automatic switching.
- Live evidence observed on 2026-05-13: `npm run switchboard:spike:codex-cli:live` completed a two-turn probe. Turn 1 selected `openai-coder` / `codex-best-coder` / `gpt-5.5`; turn 2 resumed with `openai-quick` / `codex-fast` / `gpt-5.4-mini`; both turns reported shared thread/session evidence `019e21ad-1f30-72d0-bec0-08d275284eaf`.
- App-server evidence observed on 2026-05-13: generated Codex app-server protocol bindings expose `turn/start` with a `model` override documented as applying to "this turn and subsequent turns." A live stdio smoke test started one thread with `gpt-5.5`, completed a first turn, then completed a second `turn/start` on the same `threadId` / `sessionId` with `model: "gpt-5.4-mini"` and no `exec resume` boundary.
- Repeatable app-server probe: `npm run switchboard:spike:codex-app-server` now exercises the same one-thread, two-turn app-server path and records route-selected targets, requested models, thread/session IDs, turn completion, agent-message evidence, and any `model/rerouted` telemetry.
- Repeatable live app-server evidence observed on 2026-05-13: `npm run switchboard:spike:codex-app-server` returned `status: verified`. Turn 1 selected `openai-coder` / `codex-best-coder` / `gpt-5.5`; turn 2 selected `openai-quick` / `codex-fast` / `gpt-5.4-mini`; both turns completed on the same `threadId` / `sessionId` `019e21f7-0b2e-7730-9cbd-af5e5536ddbf`; `thread/read` returned `turnCount: 2`. No `model/rerouted` telemetry was emitted.

Decision:
- Chosen option: Option B.
- Scope of commitment: treat Codex CLI as verified for route authority at `exec`/`resume` boundaries and promising for in-session route authority through the experimental app-server protocol.
- What remains intentionally deferred: claims that the interactive Codex TUI itself can be hot-swapped; broad UX/product reframing decisions until the app-server protocol is judged supportable enough for a product surface.

Consequences:
- Near-term implementation impact: additive Codex CLI feasibility tooling; no change to Claude MVP promise.
- Test and replay impact: probe test coverage verifies that resume-boundary support is not misreported as in-session authority, and app-server probe coverage verifies the one-thread, two-turn model-override harness without requiring live Codex calls in CI.
- Migration impact: low; probe is additive and does not alter core Claude workflow contracts. Codex should not displace the Claude MVP path based only on command-boundary evidence, but the app-server protocol may justify a focused product-surface spike.

Follow-up:
- Next review milestone: decide whether the experimental Codex app-server protocol is supportable enough to be the Switchboard-controlled session surface. If no, keep Codex CLI in the deferred candidate bucket despite the positive protocol evidence.
- Linked artifacts (logs, fixtures, docs, PRs): docs/product/CODEX-CLI-SPIKE-SCOPE.md, scripts/codex-cli-feasibility-probe.js, scripts/codex-app-server-switch-probe.js, test/codex-cli-feasibility-probe.test.js, test/codex-app-server-switch-probe.test.js, README.md
